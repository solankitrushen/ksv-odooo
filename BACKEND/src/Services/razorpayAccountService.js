import { logger } from "../Utils/logger.js";

const RAZORPAY_HOST = "https://api.razorpay.com";

function authHeader() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) return null;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function rzFetch(path, init = {}) {
  const auth = authHeader();
  if (!auth) {
    return { ok: false, status: 503, message: "Razorpay not configured" };
  }
  const res = await fetch(`${RAZORPAY_HOST}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: auth,
      "Content-Type": "application/json",
    },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg =
      body?.error?.description || body?.error?.reason || `HTTP ${res.status}`;
    return { ok: false, status: res.status, message: msg, body };
  }
  return { ok: true, status: res.status, body };
}

/**
 * Map Mongo Store doc → Razorpay POST /v2/accounts body.
 * Required by Razorpay: email, phone, legal_business_name, business_type, profile, type=route
 */
function buildAccountPayload(store) {
  const rp = store.razorpay || {};
  const addr = rp.address || {};
  return {
    email: rp.contactEmail || store.email,
    phone: rp.contactPhone || store.phone,
    type: "route",
    reference_id: rp.referenceId || String(store._id),
    legal_business_name: rp.legalBusinessName || store.name,
    customer_facing_business_name: store.name,
    business_type: rp.businessType || "proprietorship",
    contact_name: rp.contactName || rp.beneficiaryName || store.owner?.name,
    profile: {
      category: rp.profileCategory || "food",
      subcategory: rp.profileSubcategory || "restaurant",
      addresses: {
        registered: {
          street1: addr.street1 || store.address?.street || "Unknown",
          street2: addr.street2 || store.address?.building || undefined,
          city: addr.city || store.address?.city || "Unknown",
          state: addr.state || "KARNATAKA",
          postal_code: addr.postalCode || store.address?.zipCode || "560001",
          country: addr.country || "IN",
        },
      },
    },
    ...(rp.pan || rp.gst
      ? {
          legal_info: {
            ...(rp.pan ? { pan: rp.pan } : {}),
            ...(rp.gst ? { gst: rp.gst } : {}),
          },
        }
      : {}),
  };
}

const STATUS_MAP = {
  created: "created",
  activated: "active",
  needs_clarification: "needs_clarification",
  under_review: "under_review",
  suspended: "suspended",
  rejected: "rejected",
};

export function mapRazorpayAccountStatus(rzStatus) {
  return STATUS_MAP[rzStatus] || "pending";
}

export async function createLinkedAccount(store) {
  const payload = buildAccountPayload(store);
  const res = await rzFetch("/v2/accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    logger.error("Razorpay LinkedAccount create failed", {
      storeId: String(store._id),
      status: res.status,
      message: res.message,
    });
    return res;
  }
  return { ok: true, account: res.body };
}

export async function fetchLinkedAccount(accountId) {
  return rzFetch(`/v2/accounts/${accountId}`, { method: "GET" });
}

/**
 * After /v2/accounts the linked account needs Route product configured before payouts.
 * POST /v2/accounts/{id}/products with product_name=route_marketplace.
 * Bank account is supplied here under settlements.
 */
export async function requestRouteProduct(accountId, { bankAccountNumber, ifscCode, beneficiaryName }) {
  const payload = {
    product_name: "route_marketplace",
    tnc_accepted: true,
    ...(bankAccountNumber && ifscCode
      ? {
          settlements: {
            account_number: bankAccountNumber,
            ifsc_code: ifscCode,
            beneficiary_name: beneficiaryName || "Account holder",
          },
        }
      : {}),
  };
  return rzFetch(`/v2/accounts/${accountId}/products`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
