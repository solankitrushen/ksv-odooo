"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* Fix default marker icons in Next.js/webpack */
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Props {
  lat: number;
  lng: number;
  radiusMeters: number;
  onMapClick: (lat: number, lng: number) => void;
}

export default function LocationMapInner({
  lat,
  lng,
  radiusMeters,
  onMapClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const callbackRef = useRef(onMapClick);
  callbackRef.current = onMapClick;

  /* Initialize map once */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 15,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    const circle = L.circle([lat, lng], {
      radius: radiusMeters,
      color: "#6366f1",
      fillColor: "#6366f1",
      fillOpacity: 0.12,
      weight: 2,
    }).addTo(map);

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      circle.setLatLng(pos);
      callbackRef.current(pos.lat, pos.lng);
    });

    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      circle.setLatLng(e.latlng);
      callbackRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    /* Invalidate size after mount (fixes grey tiles) */
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Update position when props change */
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;
    const pos: L.LatLngExpression = [lat, lng];
    markerRef.current.setLatLng(pos);
    circleRef.current.setLatLng(pos);
    mapRef.current.setView(pos, mapRef.current.getZoom(), { animate: true });
  }, [lat, lng]);

  /* Update radius when props change */
  useEffect(() => {
    circleRef.current?.setRadius(radiusMeters);
  }, [radiusMeters]);

  return (
    <div
      ref={containerRef}
      className="h-[350px] w-full rounded-lg border border-border dark:border-[#2a2a2a]"
      style={{ zIndex: 0 }}
    />
  );
}
