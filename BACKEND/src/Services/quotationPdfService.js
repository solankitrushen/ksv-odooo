import PDFDocument from "pdfkit";

/**
 * Quotation PDF rendering service.
 *
 * MONEY CONTRACT (critical):
 *   All monetary values are integer paise. They are READ ONLY from
 *   `quotation.computed` (subtotal, taxTotal, discountTotal, grandTotal,
 *   coverage, partial) and from each line's `item.lineTotal` / `item.unitPrice`.
 *   This service NEVER recomputes money — totals are owned by the backend
 *   quotation totals service. Rendering divides paise by 100 for display only.
 *
 * No DB imports. Pure rendering from plain objects.
 */

const PAGE_MARGIN = 50;

/**
 * Format integer paise as a currency string, e.g. 123456 -> "1234.56 INR".
 * Defensive: non-finite / null values render as an em dash.
 * @param {number|null|undefined} paise integer minor units
 * @param {string} currency ISO currency code
 * @returns {string}
 */
function formatMoney(paise, currency) {
  if (paise === null || paise === undefined || !Number.isFinite(Number(paise))) {
    return "\u2014"; // em dash for unpriced / missing
  }
  const major = Number(paise) / 100;
  return `${major.toFixed(2)} ${currency}`;
}

/**
 * Safe string fallback.
 * @param {*} value
 * @param {string} fallback
 * @returns {string}
 */
function str(value, fallback = "\u2014") {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s.length ? s : fallback;
}

/**
 * Render a date defensively.
 * @param {*} value
 * @returns {string}
 */
function formatDate(value) {
  if (!value) return "\u2014";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toISOString().slice(0, 10);
}

/**
 * Draw a diagonal DRAFT watermark across the current page.
 * @param {PDFKit.PDFDocument} doc
 */
function drawDraftWatermark(doc) {
  const { width, height } = doc.page;
  doc.save();
  doc
    .rotate(-45, { origin: [width / 2, height / 2] })
    .fontSize(48)
    .fillColor("#cccccc")
    .opacity(0.4)
    .text("DRAFT \u2014 not submitted", 0, height / 2 - 24, {
      width,
      align: "center",
    });
  doc.opacity(1).fillColor("black").restore();
}

/**
 * Render the full quotation document into an already-constructed PDFDocument.
 * @param {PDFKit.PDFDocument} doc
 * @param {object} quotation
 * @param {{ rfq?: object, vendor?: object, audience?: 'vendor'|'staff' }} opts
 */
function renderQuotation(doc, quotation, { rfq = {}, vendor = {}, audience = "vendor" } = {}) {
  const q = quotation || {};
  const currency = str(q.currency, "INR");
  const computed = q.computed || {};
  const terms = q.terms || {};
  const items = Array.isArray(q.items) ? q.items : [];
  const status = str(q.status, "draft");

  // Watermark first (drawn behind content) for draft quotations.
  if (q.status === "draft") {
    drawDraftWatermark(doc);
  }

  // ---- Header ----
  doc
    .fillColor("black")
    .fontSize(18)
    .text(`Quotation \u2014 ${str(rfq.reference, str(q._id, "N/A"))}`, { align: "left" });
  doc.moveDown(0.2);
  doc.fontSize(12).fillColor("#444444").text(str(rfq.title, "Untitled RFQ"));
  doc.moveDown(0.4);
  doc
    .fontSize(10)
    .fillColor("black")
    .text(`Vendor: ${str(vendor.name || vendor.companyName, "Vendor")}`);
  doc.text(`Status: ${status}    Currency: ${currency}`);
  doc.moveDown(0.6);

  // Divider
  doc
    .strokeColor("#cccccc")
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
    .stroke();
  doc.moveDown(0.5);

  // ---- Line-item table ----
  const tableTop = doc.y;
  const cols = {
    name: PAGE_MARGIN,
    qty: 280,
    unit: 330,
    unitPrice: 390,
    lineTotal: 480,
  };
  const rightEdge = doc.page.width - PAGE_MARGIN;

  function drawRow(y, cells, opts2 = {}) {
    const { bold = false, color = "black" } = opts2;
    doc.fontSize(9).fillColor(color);
    if (bold) doc.font("Helvetica-Bold");
    else doc.font("Helvetica");
    doc.text(cells.name, cols.name, y, { width: cols.qty - cols.name - 4, ellipsis: true });
    doc.text(cells.qty, cols.qty, y, { width: cols.unit - cols.qty - 4 });
    doc.text(cells.unit, cols.unit, y, { width: cols.unitPrice - cols.unit - 4, ellipsis: true });
    doc.text(cells.unitPrice, cols.unitPrice, y, {
      width: cols.lineTotal - cols.unitPrice - 4,
      align: "right",
    });
    doc.text(cells.lineTotal, cols.lineTotal, y, {
      width: rightEdge - cols.lineTotal,
      align: "right",
    });
    doc.font("Helvetica");
  }

  drawRow(tableTop, {
    name: "Item",
    qty: "Qty",
    unit: "Unit",
    unitPrice: "Unit Price",
    lineTotal: "Line Total",
  }, { bold: true });

  doc.moveDown(1);
  let y = doc.y;
  const rowHeight = 16;
  const bottomLimit = doc.page.height - 80;

  for (const item of items) {
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = doc.y;
    }
    const priced = item && item.unitPrice !== null && item.unitPrice !== undefined;
    drawRow(y, {
      name: str(item && item.name, "(unnamed)"),
      qty: str(item && item.qty, "0"),
      unit: str(item && item.unit, "\u2014"),
      unitPrice: priced ? formatMoney(item.unitPrice, currency) : "\u2014",
      lineTotal:
        item && item.lineTotal !== null && item.lineTotal !== undefined && priced
          ? formatMoney(item.lineTotal, currency)
          : "\u2014",
    });
    y += rowHeight;
  }

  doc.y = y;
  doc.moveDown(0.5);
  if (doc.y + 120 > bottomLimit) doc.addPage();

  // Divider
  doc
    .strokeColor("#cccccc")
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(rightEdge, doc.y)
    .stroke();
  doc.moveDown(0.5);

  // ---- Totals block (READ ONLY from computed) ----
  function totalLine(label, paise, opts2 = {}) {
    const { bold = false } = opts2;
    const ty = doc.y;
    if (bold) doc.font("Helvetica-Bold");
    doc.fontSize(10).fillColor("black");
    doc.text(label, cols.unitPrice, ty, { width: cols.lineTotal - cols.unitPrice - 4, align: "right" });
    doc.text(formatMoney(paise, currency), cols.lineTotal, ty, {
      width: rightEdge - cols.lineTotal,
      align: "right",
    });
    doc.font("Helvetica");
    doc.moveDown(0.3);
  }

  totalLine("Subtotal", computed.subtotal);
  totalLine("Discount", computed.discountTotal);
  totalLine("Tax", computed.taxTotal);
  totalLine("Grand Total", computed.grandTotal, { bold: true });

  if (computed.partial) {
    const coveragePct =
      Number.isFinite(Number(computed.coverage)) ? Math.round(Number(computed.coverage) * 100) : 0;
    doc.moveDown(0.2);
    doc
      .fontSize(9)
      .fillColor("#aa6600")
      .text(`Partial quotation \u2014 coverage ${coveragePct}% of requested items.`, PAGE_MARGIN, doc.y);
    doc.fillColor("black");
  }

  doc.moveDown(1);

  // ---- Terms ----
  doc.fontSize(12).fillColor("black").text("Terms", PAGE_MARGIN, doc.y);
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#333333");
  doc.text(`Payment days: ${str(terms.paymentDays)}`);
  doc.text(`Delivery date: ${formatDate(terms.deliveryDate)}`);
  doc.text(`Warranty (months): ${str(terms.warrantyMonths)}`);
  if (str(terms.deliveryWindowText, "") !== "") {
    doc.text(`Delivery window: ${str(terms.deliveryWindowText)}`);
  }
  if (str(terms.freeText, "") !== "") {
    doc.moveDown(0.2);
    doc.text(`Notes: ${str(terms.freeText)}`, { width: rightEdge - PAGE_MARGIN });
  }

  doc.moveDown(1.5);

  // ---- Footer (audience-specific) ----
  doc.fontSize(8).fillColor("#888888");
  if (audience === "staff") {
    doc.text(
      "Internal copy \u2014 for tenant review only. Do not distribute to the vendor.",
      PAGE_MARGIN,
      doc.page.height - 60,
      { width: rightEdge - PAGE_MARGIN, align: "center" }
    );
  } else {
    doc.text("Your quotation", PAGE_MARGIN, doc.page.height - 60, {
      width: rightEdge - PAGE_MARGIN,
      align: "center",
    });
  }
  doc.fillColor("black");
}

/**
 * Build a quotation PDF as a Buffer.
 * @param {object} quotation
 * @param {{ rfq?: object, vendor?: object, audience?: 'vendor'|'staff' }} opts
 * @returns {Promise<Buffer>}
 */
export function buildQuotationPdfBuffer(quotation, opts = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      renderQuotation(doc, quotation, opts);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Build the PDF and send it on an Express response as an attachment.
 * Builds a Buffer first (safer than piping) then ends the response.
 * @param {import('express').Response} res
 * @param {object} quotation
 * @param {{ rfq?: object, vendor?: object, audience?: 'vendor'|'staff' }} opts
 * @returns {Promise<void>}
 */
export async function streamQuotationPdf(res, quotation, opts = {}) {
  const { rfq = {} } = opts;
  const filenameKey = str(rfq.reference, str(quotation && quotation._id, "quotation"));
  const safeKey = String(filenameKey).replace(/[^A-Za-z0-9._-]/g, "_");
  const buffer = await buildQuotationPdfBuffer(quotation, opts);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="quotation-${safeKey}.pdf"`);
  res.setHeader("Content-Length", buffer.length);
  res.end(buffer);
}

export default { buildQuotationPdfBuffer, streamQuotationPdf };
