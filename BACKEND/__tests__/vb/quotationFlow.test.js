import { beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { getTestApp } from "../helpers/testApp.js";

const pwd = "VbPass@1234";
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const future = (ms) => new Date(Date.now() + ms).toISOString();

async function registerTenant(app, slug) {
  const res = await request(app)
    .post("/api/v1/vb/auth/register-tenant")
    .send({
      tenant: { name: `Org ${slug}`, slug },
      admin: { name: "Admin", email: `admin-${slug}@x.com`, password: pwd },
    });
  return res;
}

async function inviteActivateVendor(app, adminTok, email) {
  const v = await request(app)
    .post("/api/v1/vb/vendors")
    .set(bearer(adminTok))
    .send({ name: `V-${email}`, category: "Furniture", email });
  const vendorId = v.body.data.vendor._id;
  const token = new URL(v.body.data.inviteLink).searchParams.get("token");
  const act = await request(app)
    .post("/api/v1/vb/auth/vendor/activate")
    .send({ name: "Owner", password: pwd, token });
  return { vendorId, vendorTok: act.body.data.tokens.accessToken };
}

async function createRfq(app, adminTok, vendorIds, deadlineMs = 86400000) {
  const r = await request(app)
    .post("/api/v1/vb/rfq")
    .set(bearer(adminTok))
    .send({
      title: "Office Furniture",
      category: "Furniture",
      status: "active",
      deadline: future(deadlineMs),
      items: [
        { name: "Chair", qty: 10, unit: "pcs" },
        { name: "Desk", qty: 5, unit: "pcs" },
      ],
      assignedVendorIds: vendorIds,
    });
  return r.body.data.rfq;
}

describe("Quotation core + AI + download (SPEC-VB-003 / 003-AI)", () => {
  let app;
  beforeAll(async () => {
    app = await getTestApp();
  });

  it("vendor full flow: inbox → draft → patch (server totals) → submit → staff list + PDF", async () => {
    const slug = `q${Date.now().toString(36)}`;
    const reg = await registerTenant(app, slug);
    const adminTok = reg.body.data.tokens.accessToken;
    const { vendorTok } = await inviteActivateVendor(app, adminTok, `v1-${slug}@v.com`);
    const rfq = await createRfq(app, adminTok, [
      (await request(app).get("/api/v1/vb/vendors").set(bearer(adminTok))).body.data.items[0]._id,
    ]);

    // inbox
    const inbox = await request(app).get("/api/v1/vb/vendor/rfqs").set(bearer(vendorTok));
    expect(inbox.status).toBe(200);
    expect(inbox.body.data.items.length).toBe(1);

    // create draft + try to tamper totals (subtotal/grandTotal must be ignored)
    const create = await request(app)
      .post("/api/v1/vb/quotations")
      .set(bearer(vendorTok))
      .send({
        rfqId: rfq._id,
        items: [{ rfqItemId: "0", unitPrice: 50000, taxRatePct: 18 }],
        subtotal: 999999999,
        grandTotal: 1,
      });
    expect(create.status).toBe(201);
    const qid = create.body.data.quotation._id;
    // Chair: 10*50000=500000 subtotal, tax 18% = 90000, grand 590000
    expect(create.body.data.quotation.computed.subtotal).toBe(500000);
    expect(create.body.data.quotation.computed.grandTotal).toBe(590000);
    expect(create.body.data.quotation.computed.coverage).toBe(0.5); // 1 of 2 priced
    expect(create.body.data.quotation.computed.partial).toBe(true);

    // patch the second item
    const patch = await request(app)
      .patch(`/api/v1/vb/quotations/${qid}`)
      .set(bearer(vendorTok))
      .send({ items: [{ rfqItemId: "1", unitPrice: 120000 }], terms: { paymentDays: 30 } });
    expect(patch.status).toBe(200);
    expect(patch.body.data.quotation.computed.coverage).toBe(1);

    // submit
    const submit = await request(app).post(`/api/v1/vb/quotations/${qid}/submit`).set(bearer(vendorTok));
    expect(submit.status).toBe(200);
    expect(submit.body.data.quotation.status).toBe("submitted");

    // editing prices after submit → 409
    const lateEdit = await request(app)
      .patch(`/api/v1/vb/quotations/${qid}`)
      .set(bearer(vendorTok))
      .send({ items: [{ rfqItemId: "0", unitPrice: 1 }] });
    expect(lateEdit.status).toBe(409);

    // staff list shows it
    const list = await request(app).get(`/api/v1/vb/rfq/${rfq._id}/quotations`).set(bearer(adminTok));
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBe(1);

    // vendor downloads own PDF
    const vdl = await request(app).get(`/api/v1/vb/quotations/${qid}/download`).set(bearer(vendorTok));
    expect(vdl.status).toBe(200);
    expect(vdl.headers["content-type"]).toContain("application/pdf");

    // staff downloads submitted PDF
    const sdl = await request(app)
      .get(`/api/v1/vb/rfq/${rfq._id}/quotations/${qid}/download`)
      .set(bearer(adminTok));
    expect(sdl.status).toBe(200);
    expect(sdl.headers["content-type"]).toContain("application/pdf");
  });

  it("rejects float price (4xx), blocks zero-coverage submit (422)", async () => {
    const slug = `q2${Date.now().toString(36)}`;
    const reg = await registerTenant(app, slug);
    const adminTok = reg.body.data.tokens.accessToken;
    const { vendorId, vendorTok } = await inviteActivateVendor(app, adminTok, `v-${slug}@v.com`);
    const rfq = await createRfq(app, adminTok, [vendorId]);

    const float = await request(app)
      .post("/api/v1/vb/quotations")
      .set(bearer(vendorTok))
      .send({ rfqId: rfq._id, items: [{ rfqItemId: "0", unitPrice: 12.5 }] });
    expect(float.status).toBe(400);

    const empty = await request(app)
      .post("/api/v1/vb/quotations")
      .set(bearer(vendorTok))
      .send({ rfqId: rfq._id });
    const qid = empty.body.data.quotation._id;
    const submit = await request(app).post(`/api/v1/vb/quotations/${qid}/submit`).set(bearer(vendorTok));
    expect(submit.status).toBe(422);
    expect(submit.body.error).toBe("coverage_zero");
  });

  it("concurrent double-submit yields exactly one success", async () => {
    const slug = `q3${Date.now().toString(36)}`;
    const reg = await registerTenant(app, slug);
    const adminTok = reg.body.data.tokens.accessToken;
    const { vendorId, vendorTok } = await inviteActivateVendor(app, adminTok, `v-${slug}@v.com`);
    const rfq = await createRfq(app, adminTok, [vendorId]);
    const create = await request(app)
      .post("/api/v1/vb/quotations")
      .set(bearer(vendorTok))
      .send({ rfqId: rfq._id, items: [{ rfqItemId: "0", unitPrice: 50000 }] });
    const qid = create.body.data.quotation._id;

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post(`/api/v1/vb/quotations/${qid}/submit`).set(bearer(vendorTok))
      )
    );
    const ok = results.filter((r) => r.status === 200);
    const conflict = results.filter((r) => r.status === 409);
    expect(ok.length).toBe(1);
    expect(conflict.length).toBe(4);
  });

  it("cross-vendor + cross-tenant IDOR → 404", async () => {
    const slug = `q4${Date.now().toString(36)}`;
    const reg = await registerTenant(app, slug);
    const adminTok = reg.body.data.tokens.accessToken;
    const a = await inviteActivateVendor(app, adminTok, `va-${slug}@v.com`);
    const b = await inviteActivateVendor(app, adminTok, `vb-${slug}@v.com`);
    const rfq = await createRfq(app, adminTok, [a.vendorId, b.vendorId]);

    const create = await request(app)
      .post("/api/v1/vb/quotations")
      .set(bearer(a.vendorTok))
      .send({ rfqId: rfq._id, items: [{ rfqItemId: "0", unitPrice: 50000 }] });
    const qidA = create.body.data.quotation._id;

    // vendor B cannot read/patch/download A's quotation
    expect((await request(app).get(`/api/v1/vb/quotations/${qidA}`).set(bearer(b.vendorTok))).status).toBe(404);
    expect(
      (await request(app).patch(`/api/v1/vb/quotations/${qidA}`).set(bearer(b.vendorTok)).send({ items: [] })).status
    ).toBe(404);
    expect((await request(app).get(`/api/v1/vb/quotations/${qidA}/download`).set(bearer(b.vendorTok))).status).toBe(404);

    // cross-tenant admin cannot list/download
    const slug2 = `q4b${Date.now().toString(36)}`;
    const reg2 = await registerTenant(app, slug2);
    const admin2 = reg2.body.data.tokens.accessToken;
    const cross = await request(app).get(`/api/v1/vb/rfq/${rfq._id}/quotations`).set(bearer(admin2));
    expect(cross.status).toBe(404);
  });

  it("AI generate flow: session → answers → generate draft (server totals, source ai-generated)", async () => {
    const slug = `q5${Date.now().toString(36)}`;
    const reg = await registerTenant(app, slug);
    const adminTok = reg.body.data.tokens.accessToken;
    const { vendorId, vendorTok } = await inviteActivateVendor(app, adminTok, `v-${slug}@v.com`);
    const rfq = await createRfq(app, adminTok, [vendorId]);

    const start = await request(app)
      .post("/api/v1/vb/quotations/ai/sessions")
      .set(bearer(vendorTok))
      .send({ rfqId: rfq._id });
    expect(start.status).toBe(201);
    const sid = start.body.data.session._id;
    const qIds = start.body.data.session.questions.map((q) => q.id);
    expect(qIds).toContain("price_0");
    expect(qIds).toContain("price_1");

    const answers = await request(app)
      .post(`/api/v1/vb/quotations/ai/sessions/${sid}/answers`)
      .set(bearer(vendorTok))
      .send({
        answers: [
          { questionId: "supply_0", value: true },
          { questionId: "price_0", value: 50000 },
          { questionId: "supply_1", value: true },
          { questionId: "price_1", value: 120000 },
          { questionId: "paymentDays", value: 30 },
          // attempted tamper — not a real question id, filtered out
          { questionId: "grandTotal", value: 1 },
        ],
      });
    expect(answers.status).toBe(200);

    const gen = await request(app)
      .post(`/api/v1/vb/quotations/ai/sessions/${sid}/generate`)
      .set(bearer(vendorTok));
    expect(gen.status).toBe(200);
    const q = gen.body.data.quotation;
    expect(q.source).toBe("ai-generated");
    expect(q.computed.subtotal).toBe(500000 + 600000); // 10*50000 + 5*120000
    expect(q.computed.coverage).toBe(1);
  });

  it("AI enhance + apply: late delivery suggestion applied via core PATCH", async () => {
    const slug = `q6${Date.now().toString(36)}`;
    const reg = await registerTenant(app, slug);
    const adminTok = reg.body.data.tokens.accessToken;
    const { vendorId, vendorTok } = await inviteActivateVendor(app, adminTok, `v-${slug}@v.com`);
    const rfq = await createRfq(app, adminTok, [vendorId], 2 * 86400000); // deadline +2d

    const create = await request(app)
      .post("/api/v1/vb/quotations")
      .set(bearer(vendorTok))
      .send({
        rfqId: rfq._id,
        items: [
          { rfqItemId: "0", unitPrice: 50000 },
          { rfqItemId: "1", unitPrice: 120000 },
        ],
        terms: { deliveryDate: future(10 * 86400000) }, // 10 days out → past deadline
      });
    const qid = create.body.data.quotation._id;

    const enhance = await request(app).post(`/api/v1/vb/quotations/${qid}/ai/enhance`).set(bearer(vendorTok));
    expect(enhance.status).toBe(200);
    expect(enhance.body.data.score).toBeLessThanOrEqual(100);
    const late = enhance.body.data.suggestions.find((s) => s.type === "late_delivery");
    expect(late).toBeTruthy();

    // unknown suggestion → 422
    const bad = await request(app)
      .post(`/api/v1/vb/quotations/${qid}/ai/apply`)
      .set(bearer(vendorTok))
      .send({ suggestionIds: ["nope_999"] });
    expect(bad.status).toBe(422);

    // apply the late_delivery fix
    const apply = await request(app)
      .post(`/api/v1/vb/quotations/${qid}/ai/apply`)
      .set(bearer(vendorTok))
      .send({ suggestionIds: [late.id] });
    expect(apply.status).toBe(200);
    expect(apply.body.data.quotation.source).toBe("ai-enhanced");
  });

  it("staff cannot download a draft (404); vendor can download own draft", async () => {
    const slug = `q7${Date.now().toString(36)}`;
    const reg = await registerTenant(app, slug);
    const adminTok = reg.body.data.tokens.accessToken;
    const { vendorId, vendorTok } = await inviteActivateVendor(app, adminTok, `v-${slug}@v.com`);
    const rfq = await createRfq(app, adminTok, [vendorId]);
    const create = await request(app)
      .post("/api/v1/vb/quotations")
      .set(bearer(vendorTok))
      .send({ rfqId: rfq._id, items: [{ rfqItemId: "0", unitPrice: 50000 }] });
    const qid = create.body.data.quotation._id;

    // vendor can download own draft
    const vdl = await request(app).get(`/api/v1/vb/quotations/${qid}/download`).set(bearer(vendorTok));
    expect(vdl.status).toBe(200);

    // staff download of a DRAFT → 404 (drafts staff-invisible)
    const sdl = await request(app)
      .get(`/api/v1/vb/rfq/${rfq._id}/quotations/${qid}/download`)
      .set(bearer(adminTok));
    expect(sdl.status).toBe(404);
  });

  it("idempotent create replay returns same result; mismatch body → 422", async () => {
    const slug = `q8${Date.now().toString(36)}`;
    const reg = await registerTenant(app, slug);
    const adminTok = reg.body.data.tokens.accessToken;
    const { vendorId, vendorTok } = await inviteActivateVendor(app, adminTok, `v-${slug}@v.com`);
    const rfq = await createRfq(app, adminTok, [vendorId]);
    const body = { rfqId: rfq._id, items: [{ rfqItemId: "0", unitPrice: 50000 }] };
    const key = `idem-${slug}`;

    const r1 = await request(app)
      .post("/api/v1/vb/quotations")
      .set(bearer(vendorTok))
      .set("Idempotency-Key", key)
      .send(body);
    const r2 = await request(app)
      .post("/api/v1/vb/quotations")
      .set(bearer(vendorTok))
      .set("Idempotency-Key", key)
      .send(body);
    expect(r1.body.data.quotation._id).toBe(r2.body.data.quotation._id);

    const mismatch = await request(app)
      .post("/api/v1/vb/quotations")
      .set(bearer(vendorTok))
      .set("Idempotency-Key", key)
      .send({ rfqId: rfq._id, items: [{ rfqItemId: "0", unitPrice: 99999 }] });
    expect(mismatch.status).toBe(422);
    expect(mismatch.body.error).toBe("fingerprint_mismatch");
  });
});
