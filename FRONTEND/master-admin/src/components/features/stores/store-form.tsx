"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateStore,
  type CreateStoreInput,
} from "@/hooks/use-stores";
import type { CuisineType, Store } from "@/lib/api-types";
import { ApiError } from "@/lib/backend-fetch";
import { CUISINE_TYPES } from "@/lib/cuisine-types";
import { generateStrongPassword } from "@/lib/password-utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, KeyRound, Sparkles } from "lucide-react";
import { LocationPicker, type PickedLocation } from "./location-picker";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  city: z.string().min(2, "City required"),
  cuisineTypes: z.array(z.string()).optional(),
  email: z.string().email("Valid email required"),
  latitude: z.coerce
    .number()
    .min(-90, "Latitude must be -90 to 90")
    .max(90, "Latitude must be -90 to 90"),
  longitude: z.coerce
    .number()
    .min(-180, "Longitude must be -180 to 180")
    .max(180, "Longitude must be -180 to 180"),
  name: z.string().min(3, "Min 3 chars").max(100, "Max 100 chars"),
  ownerName: z.string().min(2, "Owner name required").max(100),
  ownerPhone: z.string().regex(/^\d{10}$/, "Exactly 10 digits"),
  password: z
    .string()
    .min(8, "Min 8 chars")
    .regex(/[a-z]/, "Add a lowercase letter")
    .regex(/[A-Z]/, "Add an uppercase letter")
    .regex(/\d/, "Add a digit"),
  phone: z.string().regex(/^\d{10}$/, "Exactly 10 digits"),
  street: z.string().min(5, "Min 5 chars"),
  building: z.string().optional(),
  block: z.string().optional(),
  shopNumber: z.string().optional(),
  landmark: z.string().optional(),
  upiId: z
    .string()
    .regex(/^[\w.-]+@[\w.-]+$/, "Format like name@bank")
    .optional()
    .or(z.literal("")),
  zipCode: z.string().regex(/^\d{6}$/, "Exactly 6 digits"),
  commissionPercent: z.coerce
    .number()
    .min(0, "Min 0%")
    .max(100, "Max 100%"),
});

type FormValues = z.infer<typeof schema>;

interface CredentialsModalProps {
  credentials: { email: string; password: string } | null;
  onClose: () => void;
  store: Store | null;
}

function CredentialsModal({
  credentials,
  onClose,
  store,
}: CredentialsModalProps) {
  const router = useRouter();
  const open = Boolean(credentials && store);

  if (!credentials || !store) return null;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const copyAll = () => {
    const text = `Store: ${store.name}\nLogin URL: ${
      typeof window !== "undefined" ? window.location.origin : ""
    }\nEmail: ${credentials.email}\nTemp password: ${credentials.password}`;
    navigator.clipboard.writeText(text);
    toast.success("Credentials copied");
  };

  return (
    <Dialog
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          router.push(`/stores/${store._id}`);
        }
      }}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Store provisioned</DialogTitle>
          <DialogDescription>
            Share these credentials with the owner. They will not be shown
            again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/30 p-3 dark:border-[#2a2a2a]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Email</span>
              <Button
                onClick={() => copy(credentials.email, "Email")}
                size="sm"
                variant="ghost"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="font-mono text-sm">{credentials.email}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3 dark:border-[#2a2a2a]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Temporary password
              </span>
              <Button
                onClick={() => copy(credentials.password, "Password")}
                size="sm"
                variant="ghost"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="font-mono text-sm">{credentials.password}</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={copyAll} variant="outline">
            <Copy className="h-4 w-4" />
            Copy all
          </Button>
          <Button
            onClick={() => {
              onClose();
              router.push(`/stores/${store._id}`);
            }}
          >
            Go to store
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StoreForm() {
  const [selectedCuisines, setSelectedCuisines] = useState<CuisineType[]>([]);
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [createdStore, setCreatedStore] = useState<Store | null>(null);
  const createStore = useCreateStore();

  const {
    formState: { errors },
    handleSubmit,
    register,
    setError,
    setValue,
    watch,
  } = useForm<FormValues>({
    defaultValues: {
      commissionPercent: 15,
      cuisineTypes: [],
      email: "",
      name: "",
      ownerName: "",
      ownerPhone: "",
      password: "",
      phone: "",
      building: "",
      block: "",
      shopNumber: "",
      landmark: "",
      upiId: "",
    },
    resolver: zodResolver(schema),
  });

  const passwordValue = watch("password");
  const streetValue = watch("street");
  const cityValue = watch("city");
  const zipValue = watch("zipCode");
  const latValue = watch("latitude");
  const lngValue = watch("longitude");

  // Combined address for forward geocoding (address fields → map)
  const addressQuery = [streetValue, cityValue, zipValue]
    .filter(Boolean)
    .join(", ");

  const onSubmit = handleSubmit(async (values) => {
    const payload: CreateStoreInput = {
      address: {
        city: values.city,
        street: values.street,
        zipCode: values.zipCode,
        building: values.building || undefined,
        block: values.block || undefined,
        shopNumber: values.shopNumber || undefined,
        landmark: values.landmark || undefined,
      },
      commissionPercent: values.commissionPercent,
      cuisineTypes: selectedCuisines,
      email: values.email,
      location: {
        latitude: values.latitude,
        longitude: values.longitude,
      },
      name: values.name,
      owner: {
        name: values.ownerName,
        phone: values.ownerPhone,
      },
      password: values.password,
      phone: values.phone,
      upiId: values.upiId || undefined,
    };

    try {
      const result = await createStore.mutateAsync(payload);
      toast.success(result.message || "Store provisioned");
      setCredentials({
        email: values.email,
        password: values.password,
      });
      setCreatedStore(result.store);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const msg = err.message || "Already registered";
        setError("email", { message: msg, type: "manual" });
        setError("phone", { message: msg, type: "manual" });
        toast.error(msg);
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to create");
    }
  });

  const fillStrongPassword = () => {
    const pwd = generateStrongPassword(14);
    setValue("password", pwd, { shouldValidate: true });
    navigator.clipboard.writeText(pwd);
    toast.success("Password generated and copied");
  };

  const toggleCuisine = (value: CuisineType) => {
    setSelectedCuisines((curr) =>
      curr.includes(value)
        ? curr.filter((v) => v !== value)
        : [...curr, value]
    );
  };

  const handleLocationPick = useCallback(
    (loc: PickedLocation) => {
      setValue("latitude", loc.latitude, { shouldValidate: true });
      setValue("longitude", loc.longitude, { shouldValidate: true });
      if (loc.street) setValue("street", loc.street, { shouldValidate: true });
      if (loc.city) setValue("city", loc.city, { shouldValidate: true });
      if (loc.zipCode) setValue("zipCode", loc.zipCode, { shouldValidate: true });
      if (loc.building) setValue("building", loc.building);
      if (loc.block) setValue("block", loc.block);
    },
    [setValue]
  );

  return (
    <>
      <form className="space-y-8" onSubmit={onSubmit}>
        <section className="rounded-xl border border-border bg-card p-6 dark:border-[#2a2a2a] dark:bg-panel">
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Owner account
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Credentials the store owner will use to sign in to their admin
            app.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block" htmlFor="email">
                Email
              </Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="phone">
                Phone (10 digits)
              </Label>
              <Input id="phone" maxLength={10} {...register("phone")} />
              {errors.phone && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="password">Temporary password</Label>
                <Button
                  onClick={fillStrongPassword}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Sparkles className="h-3 w-3" />
                  Generate
                </Button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 font-mono"
                  id="password"
                  type="text"
                  {...register("password")}
                  value={passwordValue || ""}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 dark:border-[#2a2a2a] dark:bg-panel">
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Store details
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Public store information shown to customers.
          </p>
          <div>
            <Label className="mb-1.5 block" htmlFor="name">
              Store name
            </Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="mt-1 text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 dark:border-[#2a2a2a] dark:bg-panel">
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Owner details
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Point of contact for the cafe owner. Used for billing and support.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block" htmlFor="ownerName">
                Owner full name
              </Label>
              <Input id="ownerName" {...register("ownerName")} />
              {errors.ownerName && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.ownerName.message}
                </p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="ownerPhone">
                Owner phone (10 digits)
              </Label>
              <Input
                id="ownerPhone"
                maxLength={10}
                {...register("ownerPhone")}
              />
              {errors.ownerPhone && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.ownerPhone.message}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 dark:border-[#2a2a2a] dark:bg-panel">
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Address &amp; Location
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Search or click the map to set store location. 1km delivery radius shown. Address fields auto-fill from map.
          </p>

          {/* Interactive map picker */}
          <LocationPicker
            radiusMeters={1000}
            onLocationChange={handleLocationPick}
            externalLat={latValue ? Number(latValue) : undefined}
            externalLng={lngValue ? Number(lngValue) : undefined}
            addressQuery={addressQuery}
          />

          {/* Direct address fields */}
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block" htmlFor="building">
                Building / mall name <span className="text-muted-foreground">(auto)</span>
              </Label>
              <Input id="building" {...register("building")} />
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="block">
                Block / wing <span className="text-muted-foreground">(auto)</span>
              </Label>
              <Input id="block" {...register("block")} />
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="shopNumber">
                Shop / unit number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="shopNumber"
                placeholder="e.g. G-12"
                {...register("shopNumber")}
              />
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="landmark">
                Landmark <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="landmark"
                placeholder="Near metro / opposite ATM"
                {...register("landmark")}
              />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-1.5 block" htmlFor="street">
                Street
              </Label>
              <Textarea id="street" rows={2} {...register("street")} />
              {errors.street && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.street.message}
                </p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="city">
                City
              </Label>
              <Input id="city" {...register("city")} />
              {errors.city && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.city.message}
                </p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="zipCode">
                ZIP (6 digits)
              </Label>
              <Input id="zipCode" maxLength={6} {...register("zipCode")} />
              {errors.zipCode && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.zipCode.message}
                </p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="latitude">
                Latitude
              </Label>
              <Input
                id="latitude"
                step="any"
                type="number"
                {...register("latitude")}
              />
              {errors.latitude && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.latitude.message}
                </p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="longitude">
                Longitude
              </Label>
              <Input
                id="longitude"
                step="any"
                type="number"
                {...register("longitude")}
              />
              {errors.longitude && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.longitude.message}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 dark:border-[#2a2a2a] dark:bg-panel">
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Cuisine
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Optional. Helps customers filter and discover the store.
          </p>
          <div className="flex flex-wrap gap-2">
            {CUISINE_TYPES.map((c) => {
              const active = selectedCuisines.includes(c.value);
              return (
                <button
                  className={
                    active
                      ? "rounded-full border border-foreground bg-foreground px-3 py-1 text-xs font-medium text-background"
                      : "rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:border-foreground/40 hover:text-foreground dark:border-[#2a2a2a] dark:bg-panel"
                  }
                  key={c.value}
                  onClick={() => toggleCuisine(c.value)}
                  type="button"
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          {selectedCuisines.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {selectedCuisines.length} selected
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6 dark:border-[#2a2a2a] dark:bg-panel">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Banking
            </h2>
            <Badge variant="outline">Optional</Badge>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            UPI ID for payouts. Owner can fill this from their admin panel
            later.
          </p>
          <div>
            <Label className="mb-1.5 block" htmlFor="upiId">
              UPI ID
            </Label>
            <Input
              id="upiId"
              placeholder="name@bank"
              {...register("upiId")}
            />
            {errors.upiId && (
              <p className="mt-1 text-xs text-destructive">
                {errors.upiId.message}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 dark:border-[#2a2a2a] dark:bg-panel">
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Platform fee
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Commission percentage charged on every order subtotal. Added to the
            customer&apos;s cart at checkout. Default 15%. Minimum order is
            ₹200.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block" htmlFor="commissionPercent">
                Commission (%)
              </Label>
              <Input
                id="commissionPercent"
                max={100}
                min={0}
                step="0.01"
                type="number"
                {...register("commissionPercent")}
              />
              {errors.commissionPercent && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.commissionPercent.message}
                </p>
              )}
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Button disabled={createStore.isPending} type="submit">
            {createStore.isPending ? "Provisioning..." : "Provision store"}
          </Button>
        </div>
      </form>

      <CredentialsModal
        credentials={credentials}
        onClose={() => {
          setCredentials(null);
          setCreatedStore(null);
        }}
        store={createdStore}
      />
    </>
  );
}
