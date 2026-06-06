import { beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";

const pwd = "VbPass@1234";
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

async function registerTenant(app, slug) {
  // Arrange + Act
  const res = await request(app)
    .post("/api/v1/vb/auth/register-tenant")
    .send({
      tenant: { name: `Org ${slug}`, slug },
      admin: { name: "Admin", email: `admin-${slug}@x.com`, password: pwd },
    });
  return res;
}

describe("VendorBridge flow /api/v1/vb", () => {
  let app;
  beforeAll(async () => {
    app = await getTestApp();
  });

  it("runs RFQ lifecycle: register → invite vendor → activate → create RFQ → vendor sees it", async () => {
    // Arrange: tenant + admin
    const slug = `a${Date.now().toString(36)}`;
    const reg = await registerTenant(app, slug);
    expect(reg.status).toBe(201);
    expect(reg.body.data.roles).toEqual(["admin"]);
    const adminTok = reg.body.data.tokens.accessToken;

    // Act: invite vendor
    const vend = await request(app)
      .post("/api/v1/vb/vendors")
      .set(bearer(adminTok))
      .send({ name: "Acme", category: "IT", email: `acme-${slug}@v.com` });
    expect(vend.status).toBe(201);
    const vendorId = vend.body.data.vendor._id;
    const token = new URL(vend.body.data.inviteLink).searchParams.get("token");

    // Act: activate vendor
    const act = await request(app)
      .post("/api/v1/vb/auth/vendor/activate")
      .send({ name: "Acme Owner", password: pwd, token });
    expect(act.status).toBe(201);
    expect(act.body.data.roles).toEqual(["vendor"]);
    const vendorTok = act.body.data.tokens.accessToken;

    // Act: create active RFQ assigning the now-active vendor
    const rfq = await request(app)
      .post("/api/v1/vb/rfq")
      .set(bearer(adminTok))
      .send({
        title: "Office Chairs",
        category: "Furniture",
        status: "active",
        deadline: new Date(Date.now() + 86400000).toISOString(),
        items: [{ name: "Chair", qty: 10, unit: "pcs" }],
        assignedVendorIds: [vendorId],
      });
    expect(rfq.status).toBe(201);
    expect(rfq.body.data.rfq.reference).toMatch(/^RFQ-\d{4}-0001$/);

    // Assert: vendor sees only the assigned active RFQ
    const vendorList = await request(app)
      .get("/api/v1/vb/rfq")
      .set(bearer(vendorTok));
    expect(vendorList.status).toBe(200);
    expect(vendorList.body.data.total).toBe(1);
  });

  it("isolates tenants and enforces roles", async () => {
    // Arrange: two tenants, each with a vendor
    const sa = `b${Date.now().toString(36)}`;
    const ra = await registerTenant(app, sa);
    const adminA = ra.body.data.tokens.accessToken;
    const va = await request(app)
      .post("/api/v1/vb/vendors")
      .set(bearer(adminA))
      .send({ name: "VenA", category: "IT", email: `vena-${sa}@v.com` });
    const vendorAId = va.body.data.vendor._id;

    const sb = `c${Date.now().toString(36)}`;
    const rb = await registerTenant(app, sb);
    const adminB = rb.body.data.tokens.accessToken;

    // Assert: tenant B cannot see tenant A vendors
    const listB = await request(app)
      .get("/api/v1/vb/vendors")
      .set(bearer(adminB));
    expect(listB.body.data.items.find((v) => v._id === vendorAId)).toBeUndefined();

    // Assert: cross-tenant get → 404
    const cross = await request(app)
      .get(`/api/v1/vb/vendors/${vendorAId}`)
      .set(bearer(adminB));
    expect(cross.status).toBe(404);

    // Assert: vendor role cannot create vendors → 403
    const vAct = await request(app)
      .post("/api/v1/vb/vendors")
      .set(bearer(adminA))
      .send({ name: "VenA2", category: "IT", email: `vena2-${sa}@v.com` });
    const tok = new URL(vAct.body.data.inviteLink).searchParams.get("token");
    const actA = await request(app)
      .post("/api/v1/vb/auth/vendor/activate")
      .send({ name: "Owner", password: pwd, token: tok });
    const vendorTokA = actA.body.data.tokens.accessToken;

    const denied = await request(app)
      .post("/api/v1/vb/vendors")
      .set(bearer(vendorTokA))
      .send({ name: "Nope", category: "IT", email: `nope-${sa}@v.com` });
    expect(denied.status).toBe(403);

    // Assert: unauthenticated mutation → 401
    const noAuth = await request(app).post("/api/v1/vb/rfq").send({});
    expect(noAuth.status).toBe(401);
  });

  it("lets one email belong to multiple tenants with a tenant chooser", async () => {
    // Arrange: same vendor email invited by two tenants
    const stamp = Date.now().toString(36);
    const email = `multi-${stamp}@v.com`;

    const ra = await registerTenant(app, `d${stamp}`);
    const adminA = ra.body.data.tokens.accessToken;
    const tenantA = ra.body.data.tenantId;
    const rb = await registerTenant(app, `e${stamp}`);
    const adminB = rb.body.data.tokens.accessToken;

    const inviteAndToken = async (adminTok) => {
      const v = await request(app)
        .post("/api/v1/vb/vendors")
        .set(bearer(adminTok))
        .send({ name: "Multi", category: "IT", email });
      return new URL(v.body.data.inviteLink).searchParams.get("token");
    };

    // Act: activate in A (new account), then accept invite in B (reused account)
    const tokA = await inviteAndToken(adminA);
    const actA = await request(app)
      .post("/api/v1/vb/auth/vendor/activate")
      .send({ name: "Multi Owner", password: pwd, token: tokA });
    expect(actA.status).toBe(201);

    const tokB = await inviteAndToken(adminB);
    const actB = await request(app)
      .post("/api/v1/vb/auth/vendor/activate")
      .send({ name: "Multi Owner", password: pwd, token: tokB });
    expect(actB.status).toBe(200);
    expect(actB.body.data.reusedAccount).toBe(true);

    // Assert: login without tenant → chooser with both tenants
    const choose = await request(app)
      .post("/api/v1/vb/auth/login")
      .send({ email, password: pwd });
    expect(choose.status).toBe(200);
    expect(choose.body.data.needsTenantSelection).toBe(true);
    expect(choose.body.data.tenants.length).toBe(2);

    // Assert: login with tenantId issues a scoped token
    const scoped = await request(app)
      .post("/api/v1/vb/auth/login")
      .send({ email, password: pwd, tenantId: tenantA });
    expect(scoped.status).toBe(200);
    expect(scoped.body.data.tenantId).toBe(tenantA);
    expect(scoped.body.data.tokens.accessToken).toBeDefined();
  });
});
