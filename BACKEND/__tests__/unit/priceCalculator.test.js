import { describe, it, expect } from "@jest/globals";
import {
  roundMoney,
  applyDiscountRule,
  resolveFinalPrice,
  isDiscountActive,
} from "../../src/Utils/priceCalculator.js";

describe("priceCalculator", () => {
  it("rounds to 2 decimals", () => {
    expect(roundMoney(10.126)).toBe(10.13);
    expect(roundMoney(10.124)).toBe(10.12);
  });

  it("applies percentage discount", () => {
    expect(applyDiscountRule(100, { type: "percentage", value: 20 })).toBe(80);
  });

  it("floors fixed discount at zero", () => {
    expect(applyDiscountRule(5, { type: "fixed", value: 99 })).toBe(0);
  });

  it("picks lowest price among rules", () => {
    const now = new Date("2026-06-01");
    const rules = [
      {
        type: "percentage",
        value: 10,
        validFrom: new Date("2026-01-01"),
        validUntil: new Date("2026-12-31"),
      },
      {
        type: "fixed",
        value: 25,
        validFrom: new Date("2026-01-01"),
        validUntil: new Date("2026-12-31"),
      },
    ];
    const out = resolveFinalPrice(100, rules, now);
    expect(out.appliedPrice).toBe(75);
    expect(out.discountApplied).toBe(true);
  });

  it("ignores expired discount", () => {
    const now = new Date("2027-01-01");
    const rule = {
      type: "percentage",
      value: 50,
      validFrom: new Date("2026-01-01"),
      validUntil: new Date("2026-06-01"),
      isActive: true,
    };
    expect(isDiscountActive(rule, now)).toBe(false);
  });
});
