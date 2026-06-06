import type { CuisineType } from "@/lib/api-types";

export const CUISINE_TYPES: { label: string; value: CuisineType }[] = [
  { label: "Beverages", value: "beverages" },
  { label: "Chinese", value: "chinese" },
  { label: "Continental", value: "continental" },
  { label: "Desserts", value: "desserts" },
  { label: "North Indian", value: "north-indian" },
  { label: "South Indian", value: "south-indian" },
];
