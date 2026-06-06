import "dotenv/config";
import mongoose from "mongoose";

import Tenant from "../src/Schema/Tenant.js";
import VbUser from "../src/Schema/VbUser.js";
import VbMembership from "../src/Schema/VbMembership.js";
import Vendor from "../src/Schema/Vendor.js";
import Rfq from "../src/Schema/Rfq.js";
import Quotation from "../src/Schema/Quotation.js";
import Admin from "../src/Schema/Admin.js";

import { applyComputed } from "../src/Services/quotationService.js";
import { nextRfqReference } from "../src/Services/rfqReferenceService.js";
import {
  RFQ_PRIORITY,
  RFQ_STATUS,
  QUOTATION_STATUS,
  QUOTATION_SOURCE,
  VB_ROLES,
  VENDOR_STATUS,
} from "../config/constants.js";

// ---------------------------------------------------------------------------
// Config — change passwords after first login. Money is INTEGER PAISE.
// ---------------------------------------------------------------------------
const TENANT = { name: "VendorBridge Demo", slug: "vendorbridge", contactEmail: "ops@vendorbridge.test" };

const STAFF = [
  { role: VB_ROLES.ADMIN, name: "Aarav Admin", email: "admin@vendorbridge.test", password: "Admin@1234" },
  { role: VB_ROLES.OFFICER, name: "Ola Officer", email: "officer@vendorbridge.test", password: "Officer@1234" },
  { role: VB_ROLES.MANAGER, name: "Maya Manager", email: "manager@vendorbridge.test", password: "Manager@1234" },
];

const VENDORS = [
  {
    name: "Acme Furniture Pvt Ltd",
    category: "Furniture",
    contactPerson: "Priya Sharma",
    email: "sales@acmefurniture.test",
    phone: "9876500001",
    gstNumber: "27AAACA1111A1Z5",
    login: { name: "Priya Sharma", email: "vendor.acme@vendorbridge.test", password: "Vendor@1234" },
  },
  {
    name: "BrightTech Electronics",
    category: "Electronics",
    contactPerson: "Rahul Verma",
    email: "rahul@brighttech.test",
    phone: "9876500002",
    gstNumber: "29AAACB2222B1Z4",
    login: { name: "Rahul Verma", email: "vendor.brighttech@vendorbridge.test", password: "Vendor@1234" },
  },
  {
    name: "Stationery Hub",
    category: "Stationery",
    contactPerson: "Neha Gupta",
    email: "neha@stationeryhub.test",
    phone: "9876500003",
    gstNumber: "24AAACS3333C1Z3",
    // no login → stays INVITED
  },
];

const log = (...a) => console.log(...a);

async function upsertVbUser({ name, email, password }) {
  let user = await VbUser.findOne({ email: email.toLowerCase() }).select("+password");
  if (user) {
    user.name = name;
    user.password = password; // re-hashed by pre-save hook
    user.isVerified = true;
    user.isActive = true;
    await user.save();
  } else {
    user = await VbUser.create({ name, email, password, isVerified: true, isActive: true });
  }
  return user;
}

async function upsertMembership({ userId, tenantId, roles, vendorId = null }) {
  return VbMembership.findOneAndUpdate(
    { userId, tenantId },
    { $set: { userId, tenantId, roles, vendorId, status: "active" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!uri) throw new Error("Set MONGODB_URI or MONGO_URL in BACKEND/.env");
  await mongoose.connect(uri);
  log("✓ Mongo connected:", mongoose.connection.name);

  // --- 1. Remove the old legacy admin creds being seeded -------------------
  const legacyEmail = (process.env.ADMIN_EMAIL || "admin@instacafe.com").toLowerCase();
  const removed = await Admin.deleteMany({ email: legacyEmail });
  log(`✓ Removed legacy admin (${legacyEmail}): ${removed.deletedCount} doc(s)`);

  // --- 2. Tenant -----------------------------------------------------------
  let tenant = await Tenant.findOne({ slug: TENANT.slug });
  if (!tenant) {
    tenant = await Tenant.create({ ...TENANT });
    log("✓ Tenant created:", tenant.slug);
  } else {
    tenant.name = TENANT.name;
    tenant.contactEmail = TENANT.contactEmail;
    await tenant.save();
    log("✓ Tenant updated:", tenant.slug);
  }
  const tenantId = tenant._id;

  // --- 3. Staff users (admin / officer / manager) --------------------------
  const staffByRole = {};
  for (const s of STAFF) {
    const user = await upsertVbUser(s);
    await upsertMembership({ userId: user._id, tenantId, roles: [s.role] });
    staffByRole[s.role] = user;
    log(`✓ Staff ${s.role}: ${s.email}`);
  }
  const adminUser = staffByRole[VB_ROLES.ADMIN];
  tenant.createdBy = adminUser._id;
  await tenant.save();

  // --- 4. Vendors (+ vendor login users) -----------------------------------
  const activeVendors = [];
  for (const v of VENDORS) {
    const status = v.login ? VENDOR_STATUS.ACTIVE : VENDOR_STATUS.INVITED;
    let vendorUserId = null;

    if (v.login) {
      const vu = await upsertVbUser(v.login);
      vendorUserId = vu._id;
    }

    let vendor = await Vendor.findOne({ tenantId, email: v.email.toLowerCase() });
    const data = {
      tenantId,
      name: v.name,
      category: v.category,
      contactPerson: v.contactPerson,
      email: v.email,
      phone: v.phone,
      gstNumber: v.gstNumber,
      status,
      userId: vendorUserId,
      createdBy: adminUser._id,
    };
    if (!vendor) {
      vendor = await Vendor.create(data);
    } else {
      Object.assign(vendor, data);
      await vendor.save();
    }

    if (v.login && vendorUserId) {
      await upsertMembership({
        userId: vendorUserId,
        tenantId,
        roles: [VB_ROLES.VENDOR],
        vendorId: vendor._id,
      });
    }
    if (status === VENDOR_STATUS.ACTIVE) activeVendors.push(vendor);
    log(`✓ Vendor ${status}: ${v.name}${v.login ? ` (login ${v.login.email})` : ""}`);
  }

  // --- 5. RFQs (active, assigned to active vendors) ------------------------
  const in14Days = () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const rfqSeeds = [
    {
      title: "Office furniture refresh — Q3",
      category: "Furniture",
      priority: RFQ_PRIORITY.HIGH,
      items: [
        { name: "Ergonomic office chair", qty: 50, unit: "pcs" },
        { name: "Height-adjustable desk", qty: 25, unit: "pcs" },
        { name: "Meeting room table (8-seat)", qty: 4, unit: "pcs" },
      ],
      description: "Replacing furniture across the new floor. Delivery + installation expected.",
    },
    {
      title: "Laptop & peripherals procurement",
      category: "Electronics",
      priority: RFQ_PRIORITY.MEDIUM,
      items: [
        { name: "14-inch business laptop (16GB/512GB)", qty: 30, unit: "pcs" },
        { name: "USB-C docking station", qty: 30, unit: "pcs" },
        { name: "27-inch monitor", qty: 30, unit: "pcs" },
      ],
      description: "Standard developer kit for new hires. Onsite warranty preferred.",
    },
  ];

  const createdRfqs = [];
  for (const r of rfqSeeds) {
    let rfq = await Rfq.findOne({ tenantId, title: r.title });
    if (!rfq) {
      const reference = await nextRfqReference(tenantId);
      rfq = await Rfq.create({
        tenantId,
        reference,
        title: r.title,
        category: r.category,
        deadline: in14Days(),
        items: r.items,
        description: r.description,
        priority: r.priority,
        status: RFQ_STATUS.ACTIVE,
        assignedVendors: activeVendors.map((v) => v._id),
        createdBy: adminUser._id,
      });
      log(`✓ RFQ created: ${rfq.reference} — ${rfq.title}`);
    } else {
      rfq.deadline = in14Days();
      rfq.status = RFQ_STATUS.ACTIVE;
      rfq.assignedVendors = activeVendors.map((v) => v._id);
      await rfq.save();
      log(`✓ RFQ updated: ${rfq.reference} — ${rfq.title}`);
    }
    createdRfqs.push(rfq);
  }

  // --- 6. Sample quotations (1 partial DRAFT + fully-priced SUBMITTED) ------
  // Gives the admin dashboard real numbers: submitted count, total quoted value,
  // top vendors. unitPrice is paise.
  const PRICEBOOK = {
    "Office furniture refresh — Q3": [750000, 1850000, 4200000], // ₹7,500 / ₹18,500 / ₹42,000
    "Laptop & peripherals procurement": [6500000, 950000, 1450000], // ₹65,000 / ₹9,500 / ₹14,500
  };

  async function makeQuotation({ rfq, vendor, status, priceMode }) {
    if (!vendor.userId) return null;
    const existing = await Quotation.findOne({
      tenantId,
      rfqId: rfq._id,
      vendorId: vendor._id,
      status: { $in: [QUOTATION_STATUS.DRAFT, QUOTATION_STATUS.SUBMITTED] },
    });
    if (existing) return existing;

    const book = PRICEBOOK[rfq.title] || rfq.items.map(() => 100000);
    const items = rfq.items.map((it, i) => {
      // "partial" mode leaves the last item unpriced
      const leaveUnpriced = priceMode === "partial" && i === rfq.items.length - 1;
      return {
        rfqItemId: String(i),
        name: it.name,
        qty: it.qty,
        unit: it.unit,
        unitPrice: leaveUnpriced ? null : int(book[i] ?? 100000),
        taxRatePct: 18,
        discountPct: i === 0 ? 5 : 0,
      };
    });
    const q = new Quotation({
      tenantId,
      rfqId: rfq._id,
      vendorId: vendor._id,
      vendorUserId: vendor.userId,
      status,
      currency: "INR",
      items,
      terms: { paymentDays: 30, warrantyMonths: 12, deliveryWindowText: "3–4 weeks from PO" },
      deadline: rfq.deadline,
      rfqVersionNumber: 1,
      source: QUOTATION_SOURCE.MANUAL,
      submittedAt: status === QUOTATION_STATUS.SUBMITTED ? new Date() : null,
    });
    applyComputed(q);
    await q.save();
    return q;
  }

  if (activeVendors.length >= 1 && createdRfqs.length >= 1) {
    const [rfq1, rfq2] = createdRfqs;
    const [v1, v2] = activeVendors;

    // v1: partial DRAFT on RFQ #1 (demo of coverage < 100%)
    const draft = await makeQuotation({ rfq: rfq1, vendor: v1, status: QUOTATION_STATUS.DRAFT, priceMode: "partial" });
    if (draft) log(`✓ Draft quotation by ${v1.name} on ${rfq1.reference} (coverage ${Math.round(draft.computed.coverage * 100)}%)`);

    // v2: SUBMITTED on RFQ #1
    if (v2) {
      const s = await makeQuotation({ rfq: rfq1, vendor: v2, status: QUOTATION_STATUS.SUBMITTED, priceMode: "full" });
      if (s) log(`✓ Submitted quotation by ${v2.name} on ${rfq1.reference} (${formatINR(s.computed.grandTotal)})`);
    }

    // both vendors: SUBMITTED on RFQ #2
    if (rfq2) {
      for (const v of activeVendors) {
        const s = await makeQuotation({ rfq: rfq2, vendor: v, status: QUOTATION_STATUS.SUBMITTED, priceMode: "full" });
        if (s) log(`✓ Submitted quotation by ${v.name} on ${rfq2.reference} (${formatINR(s.computed.grandTotal)})`);
      }
    }
  }

  // --- 7. Validate ---------------------------------------------------------
  await validate(tenantId, legacyEmail);

  await mongoose.disconnect();
  log("\n=== Seed complete ===");
  printCredentials();
}

function int(n) {
  return Math.round(n);
}

function formatINR(paise) {
  return `₹${(Number(paise || 0) / 100).toLocaleString("en-IN")}`;
}

async function validate(tenantId, legacyEmail) {
  log("\n--- Validation ---");
  const [tenants, users, memberships, vendors, activeVendors, rfqs, quotations, legacy] =
    await Promise.all([
      Tenant.countDocuments({ _id: tenantId }),
      VbUser.countDocuments({}),
      VbMembership.countDocuments({ tenantId }),
      Vendor.countDocuments({ tenantId }),
      Vendor.countDocuments({ tenantId, status: VENDOR_STATUS.ACTIVE }),
      Rfq.countDocuments({ tenantId }),
      Quotation.countDocuments({ tenantId }),
      Admin.countDocuments({ email: legacyEmail }),
    ]);

  const checks = [
    ["tenant exists", tenants === 1],
    ["staff memberships ≥ 3", memberships >= 3],
    ["active vendors ≥ 2", activeVendors >= 2],
    ["RFQs ≥ 2", rfqs >= 2],
    ["legacy admin removed", legacy === 0],
  ];
  log({ tenants, users, memberships, vendors, activeVendors, rfqs, quotations, legacyAdmin: legacy });
  let ok = true;
  for (const [label, pass] of checks) {
    log(`${pass ? "✓" : "✗"} ${label}`);
    if (!pass) ok = false;
  }
  if (!ok) {
    throw new Error("Validation failed — see ✗ above");
  }
  log("✓ All validation checks passed");
}

function printCredentials() {
  log("\nLogin credentials (change after first login):");
  log(`  Tenant slug : ${TENANT.slug}`);
  for (const s of STAFF) log(`  ${s.role.padEnd(8)}: ${s.email} / ${s.password}`);
  for (const v of VENDORS)
    if (v.login) log(`  vendor  : ${v.login.email} / ${v.login.password}  (${v.name})`);
}

run().catch(async (err) => {
  console.error("\n✗ Seed failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
