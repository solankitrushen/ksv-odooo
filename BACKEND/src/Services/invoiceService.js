import PDFDocument from "pdfkit";
import Invoice from "../Schema/Invoice.js";
import { nextReference } from "./referenceService.js";
import { INVOICE_STATUS } from "../../config/constants.js";

/**
 * Create an invoice from an approved quotation. Money is a frozen snapshot
 * (paise) copied from quotation.computed — never recomputed. Idempotent: if an
 * active invoice already exists for the quotation, it is returned as-is.
 */
export async function generateInvoiceForQuotation({ tenantId, rfq, quotation, issuedBy }) {
  const existing = await Invoice.findOne({
    tenantId,
    quotationId: quotation._id,
    status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PAID] },
  });
  if (existing) return existing;

  const number = await nextReference(tenantId, "invoice");
  const c = quotation.computed || {};
  const items = (quotation.items || [])
    .filter((it) => it.unitPrice !== null && it.unitPrice !== undefined)
    .map((it) => ({
      name: it.name,
      qty: it.qty,
      unit: it.unit,
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal,
    }));

  return Invoice.create({
    tenantId,
    number,
    rfqId: rfq._id,
    quotationId: quotation._id,
    vendorId: quotation.vendorId,
    currency: quotation.currency || "INR",
    items,
    subtotal: c.subtotal || 0,
    taxTotal: c.taxTotal || 0,
    discountTotal: c.discountTotal || 0,
    grandTotal: c.grandTotal || 0,
    status: INVOICE_STATUS.ISSUED,
    issuedBy,
    notes: `Auto-generated on approval of quotation ${quotation._id}.`,
  });
}

function money(paise, currency) {
  if (paise == null || !Number.isFinite(Number(paise))) return "\u2014";
  return `${(Number(paise) / 100).toFixed(2)} ${currency}`;
}

/** Render an invoice as a PDF Buffer (money read-only from the frozen record). */
export function buildInvoicePdfBuffer(invoice, { rfq = {}, vendor = {} } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const currency = invoice.currency || "INR";
      const right = doc.page.width - 50;

      doc.fontSize(20).fillColor("black").text("INVOICE", { align: "right" });
      doc.fontSize(10).fillColor("#444").text(invoice.number, { align: "right" });
      doc.moveDown(1);

      doc.fillColor("black").fontSize(11).text(`RFQ: ${rfq.reference || invoice.rfqId}`);
      doc.text(`Vendor: ${vendor.name || invoice.vendorId}`);
      doc.text(`Issued: ${new Date(invoice.issuedAt || Date.now()).toISOString().slice(0, 10)}`);
      doc.text(`Status: ${invoice.status}`);
      doc.moveDown(0.6);
      doc.strokeColor("#ccc").moveTo(50, doc.y).lineTo(right, doc.y).stroke();
      doc.moveDown(0.5);

      // line items
      const cols = { name: 50, qty: 300, unit: 350, price: 410, total: 490 };
      const header = (label, x, w, align) =>
        doc.fontSize(9).font("Helvetica-Bold").text(label, x, doc.y, { width: w, align, continued: false });
      const y0 = doc.y;
      doc.fontSize(9).font("Helvetica-Bold");
      doc.text("Item", cols.name, y0, { width: cols.qty - cols.name });
      doc.text("Qty", cols.qty, y0, { width: cols.unit - cols.qty });
      doc.text("Unit", cols.unit, y0, { width: cols.price - cols.unit });
      doc.text("Unit Price", cols.price, y0, { width: cols.total - cols.price, align: "right" });
      doc.text("Total", cols.total, y0, { width: right - cols.total, align: "right" });
      void header;
      doc.font("Helvetica");
      doc.moveDown(0.8);

      for (const it of invoice.items || []) {
        const y = doc.y;
        doc.fontSize(9);
        doc.text(String(it.name), cols.name, y, { width: cols.qty - cols.name - 4, ellipsis: true });
        doc.text(String(it.qty), cols.qty, y, { width: cols.unit - cols.qty - 4 });
        doc.text(String(it.unit || ""), cols.unit, y, { width: cols.price - cols.unit - 4 });
        doc.text(money(it.unitPrice, currency), cols.price, y, { width: cols.total - cols.price - 4, align: "right" });
        doc.text(money(it.lineTotal, currency), cols.total, y, { width: right - cols.total, align: "right" });
        doc.moveDown(0.6);
      }

      doc.moveDown(0.4);
      doc.strokeColor("#ccc").moveTo(50, doc.y).lineTo(right, doc.y).stroke();
      doc.moveDown(0.4);

      const totalRow = (label, paise, bold) => {
        const y = doc.y;
        if (bold) doc.font("Helvetica-Bold");
        doc.fontSize(10).text(label, cols.price - 60, y, { width: cols.total - (cols.price - 60) - 4, align: "right" });
        doc.text(money(paise, currency), cols.total, y, { width: right - cols.total, align: "right" });
        doc.font("Helvetica");
        doc.moveDown(0.3);
      };
      totalRow("Subtotal", invoice.subtotal);
      totalRow("Discount", invoice.discountTotal);
      totalRow("Tax", invoice.taxTotal);
      totalRow("Grand Total", invoice.grandTotal, true);

      doc.moveDown(1.5);
      doc.fontSize(8).fillColor("#888").text(
        "Auto-generated by VendorBridge on quotation approval.",
        50,
        doc.page.height - 60,
        { width: right - 50, align: "center" }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function streamInvoicePdf(res, invoice, opts = {}) {
  const buffer = await buildInvoicePdfBuffer(invoice, opts);
  const safe = String(invoice.number || "invoice").replace(/[^A-Za-z0-9._-]/g, "_");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}.pdf"`);
  res.setHeader("Content-Length", buffer.length);
  res.end(buffer);
}

export default { generateInvoiceForQuotation, buildInvoicePdfBuffer, streamInvoicePdf };
