// ---------------------------------------------------------------------------
// Money helpers. The backend stores all money as INTEGER PAISE. The UI works
// in rupees for display/input, but every value sent over the wire must be a
// whole-paise integer (floats are rejected by the API).
// ---------------------------------------------------------------------------

/** Convert integer paise → rupees (number). 12345 → 123.45 */
export function paiseToRupees(paise: number | null | undefined): number {
  if (paise == null || Number.isNaN(paise)) return 0;
  return paise / 100;
}

/**
 * Convert a rupee input (number or string) → whole integer paise.
 * Returns null for empty input so an unpriced line stays unpriced.
 */
export function rupeesToPaise(
  rupees: number | string | null | undefined
): number | null {
  if (rupees === "" || rupees == null) return null;
  const n = typeof rupees === "string" ? Number(rupees) : rupees;
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/** Format integer paise as an INR currency string. 12345 → "₹123.45" */
export function formatPaise(
  paise: number | null | undefined,
  currency = "INR"
): string {
  const rupees = paiseToRupees(paise);
  if (currency === "INR") return INR.format(rupees);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(rupees);
  } catch {
    return `${currency} ${rupees.toFixed(2)}`;
  }
}

/** Display string for a rupee text input bound to a paise value. */
export function paiseToInput(paise: number | null | undefined): string {
  if (paise == null) return "";
  return String(paiseToRupees(paise));
}
