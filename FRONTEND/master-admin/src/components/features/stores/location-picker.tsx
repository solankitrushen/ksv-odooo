"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search, Crosshair, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
export interface PickedLocation {
  latitude: number;
  longitude: number;
  street?: string;
  city?: string;
  zipCode?: string;
  building?: string;
  block?: string;
  displayName?: string;
}

interface LocationPickerProps {
  /** Controlled position from parent (e.g. when address fields change) */
  externalLat?: number;
  externalLng?: number;
  /** Combined address string for forward geocoding */
  addressQuery?: string;
  radiusMeters?: number;
  onLocationChange: (loc: PickedLocation) => void;
}

/* ------------------------------------------------------------------ */
/* Lazy-loaded map (Leaflet needs window)                              */
/* ------------------------------------------------------------------ */
const MapInner = dynamic(() => import("./location-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[350px] items-center justify-center rounded-lg border border-border bg-muted/30 dark:border-[#2a2a2a]">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

/* ------------------------------------------------------------------ */
/* Reverse geocode via Nominatim (free, no key)                        */
/* ------------------------------------------------------------------ */
async function reverseGeocode(
  lat: number,
  lng: number
): Promise<Partial<PickedLocation>> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    const a = data.address ?? {};
    return {
      street: [a.road, a.pedestrian].filter(Boolean).join(", "),
      city:
        a.city || a.town || a.village || a.state_district || a.state || "",
      zipCode: a.postcode || "",
      building: a.building || a.house_name || a.amenity || a.shop || "",
      block: a.block || a.quarter || a.neighbourhood || a.suburb || "",
      displayName: data.display_name || "",
    };
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Forward geocode — address string → coords                           */
/* ------------------------------------------------------------------ */
async function forwardGeocode(
  address: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        address
      )}&format=json&limit=1&countrycodes=in`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (data.length === 0) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Search results type                                                 */
/* ------------------------------------------------------------------ */
interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
export function LocationPicker({
  externalLat,
  externalLng,
  addressQuery,
  radiusMeters = 1000,
  onLocationChange,
}: LocationPickerProps) {
  const defaultCenter: [number, number] = [20.5937, 78.9629]; // India center
  const [position, setPosition] = useState<[number, number]>(
    externalLat && externalLng
      ? [externalLat, externalLng]
      : defaultCenter
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const addressGeoRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Track whether location was set from map interaction (to skip address→map geocode loop)
  const fromMapRef = useRef(false);
  const lastGeocodedAddressRef = useRef("");

  /* Sync external lat/lng from parent */
  useEffect(() => {
    if (
      externalLat !== undefined &&
      externalLng !== undefined &&
      !Number.isNaN(externalLat) &&
      !Number.isNaN(externalLng) &&
      externalLat !== 0 &&
      externalLng !== 0
    ) {
      setPosition([externalLat, externalLng]);
    }
  }, [externalLat, externalLng]);

  /* Forward geocode when parent address changes */
  useEffect(() => {
    if (!addressQuery || addressQuery.length < 5) return;
    // Skip if this address came from a map interaction
    if (fromMapRef.current) {
      fromMapRef.current = false;
      return;
    }
    // Skip if same address already geocoded
    if (addressQuery === lastGeocodedAddressRef.current) return;

    clearTimeout(addressGeoRef.current);
    addressGeoRef.current = setTimeout(async () => {
      setGeocoding(true);
      const result = await forwardGeocode(addressQuery);
      if (result) {
        lastGeocodedAddressRef.current = addressQuery;
        setPosition([result.lat, result.lng]);
        setQuery(result.displayName);
        // Don't call onLocationChange here — only update map position.
        // Avoid overwriting user-typed address fields.
      }
      setGeocoding(false);
    }, 800);

    return () => clearTimeout(addressGeoRef.current);
  }, [addressQuery]);

  /* Auto-search on type in search bar */
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          q
        )}&format=json&limit=5&countrycodes=in`,
        { headers: { "Accept-Language": "en" } }
      );
      setResults(await res.json());
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const onQueryChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  /* Pick from search result */
  const pickResult = async (r: NominatimResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    fromMapRef.current = true;
    setPosition([lat, lng]);
    setQuery(r.display_name);
    setResults([]);
    const geo = await reverseGeocode(lat, lng);
    lastGeocodedAddressRef.current = [geo.street, geo.city, geo.zipCode].filter(Boolean).join(", ");
    onLocationChange({ latitude: lat, longitude: lng, ...geo });
  };

  /* Map click / drag handler */
  const onMapClick = useCallback(
    async (lat: number, lng: number) => {
      fromMapRef.current = true;
      setPosition([lat, lng]);
      const geo = await reverseGeocode(lat, lng);
      setQuery(geo.displayName || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      lastGeocodedAddressRef.current = [geo.street, geo.city, geo.zipCode].filter(Boolean).join(", ");
      onLocationChange({ latitude: lat, longitude: lng, ...geo });
    },
    [onLocationChange]
  );

  /* Geolocate user */
  const geolocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        fromMapRef.current = true;
        setPosition([lat, lng]);
        const geo = await reverseGeocode(lat, lng);
        setQuery(
          geo.displayName || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        );
        lastGeocodedAddressRef.current = [geo.street, geo.city, geo.zipCode].filter(Boolean).join(", ");
        onLocationChange({ latitude: lat, longitude: lng, ...geo });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search address…"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
            {(searching || geocoding) && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={geolocate}
            disabled={locating}
            title="Use my location"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crosshair className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Search results dropdown */}
        {results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover p-1 shadow-lg dark:border-[#2a2a2a]">
            {results.map((r, i) => (
              <button
                key={`${r.lat}-${r.lon}-${i}`}
                type="button"
                className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => pickResult(r)}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2 text-foreground">
                  {r.display_name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <MapInner
        lat={position[0]}
        lng={position[1]}
        radiusMeters={radiusMeters}
        onMapClick={onMapClick}
      />

      {/* Coordinates badge */}
      <p className="text-xs text-muted-foreground">
        <MapPin className="mr-1 inline h-3 w-3" />
        {position[0].toFixed(6)}, {position[1].toFixed(6)} ·{" "}
        {radiusMeters / 1000}km delivery radius shown
      </p>
    </div>
  );
}
