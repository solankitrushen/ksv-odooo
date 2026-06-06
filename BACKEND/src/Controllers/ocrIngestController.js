import crypto from "crypto";
import MenuItem from "../Schema/MenuItem.js";
import Combo from "../Schema/Combo.js";
import OcrIngestEvent from "../Schema/OcrIngestEvent.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { parseImage } from "../Services/ocrIngestService.js";
import {
  recordCategoryUse,
} from "../Services/menuCategoryService.js";
import { invalidateSortCache } from "../Services/inventorySortService.js";

const PARSE_TTL_MS = 10 * 60 * 1000;
const parseCache = new Map();

const RATE_WINDOW_MS = 60 * 60 * 1000;
const rateBuckets = new Map();

function rateLimitOk(storeId) {
  const limit = Number(process.env.OCR_PARSE_RATE_PER_HOUR) || 10;
  const key = String(storeId || "anon");
  const now = Date.now();
  const bucket = rateBuckets.get(key) || [];
  const fresh = bucket.filter((t) => now - t < RATE_WINDOW_MS);
  if (fresh.length >= limit) {
    rateBuckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  rateBuckets.set(key, fresh);
  return true;
}

function hashBuffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function cacheGet(hash) {
  const hit = parseCache.get(hash);
  if (!hit) return null;
  if (Date.now() - hit.at > PARSE_TTL_MS) {
    parseCache.delete(hash);
    return null;
  }
  return hit.draft;
}

function cacheSet(hash, draft) {
  parseCache.set(hash, { draft, at: Date.now() });
  if (parseCache.size > 100) {
    const oldestKey = parseCache.keys().next().value;
    parseCache.delete(oldestKey);
  }
}

export async function parseOcrUpload(req, res) {
  const started = Date.now();
  const storeId = req.userId || null;

  if (!req.file) {
    return sendError(res, 400, "Validation failed", "Image file required");
  }

  if (!rateLimitOk(storeId)) {
    return res.status(429).json({
      success: false,
      error: "Rate limit",
      message: "Too many OCR parses this hour. Try again later.",
    });
  }

  const hash = hashBuffer(req.file.buffer);
  const cached = cacheGet(hash);
  if (cached) {
    res.set("x-ocr-cache", "hit");
    await OcrIngestEvent.create({
      storeId,
      actorId: storeId,
      imageHash: hash,
      bytes: req.file.size,
      mimeType: req.file.mimetype,
      stage: "parse",
      status: "cached",
      itemCount: cached.items.length,
      comboCount: cached.combos.length,
      durationMs: Date.now() - started,
    }).catch(() => null);
    return sendSuccess(res, 200, { draft: cached, cached: true });
  }

  try {
    const draft = await parseImage({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });
    cacheSet(hash, draft);

    await OcrIngestEvent.create({
      storeId,
      actorId: storeId,
      imageHash: hash,
      bytes: req.file.size,
      mimeType: req.file.mimetype,
      stage: "parse",
      status: "ok",
      itemCount: draft.items.length,
      comboCount: draft.combos.length,
      durationMs: Date.now() - started,
    }).catch(() => null);

    res.set("x-ocr-cache", "miss");
    return sendSuccess(res, 200, { draft, cached: false });
  } catch (err) {
    await OcrIngestEvent.create({
      storeId,
      actorId: storeId,
      imageHash: hash,
      bytes: req.file.size,
      mimeType: req.file.mimetype,
      stage: "parse",
      status: "error",
      durationMs: Date.now() - started,
      errorCode: err.code || "OCR_UNKNOWN",
    }).catch(() => null);

    if (err.code === "OCR_PROVIDER_NOT_CONFIGURED") {
      return sendError(
        res,
        503,
        "OCR unavailable",
        "Vision provider not configured"
      );
    }
    if (err.code === "OCR_PROVIDER_HTTP" || err.code === "OCR_PROVIDER_ERROR") {
      return sendError(
        res,
        502,
        "OCR provider error",
        err.message || "Upstream OCR failed"
      );
    }
    throw err;
  }
}

function matchItemId(name, lookup) {
  const key = String(name).trim().toLowerCase();
  return lookup.get(key) || null;
}

export async function commitOcrDraft(req, res) {
  const started = Date.now();
  const storeId = req.userId || null;
  const { items = [], combos = [], currency } = req.validated;

  const created = { items: [], combos: [] };
  const skipped = [];

  for (const it of items) {
    const exists = await MenuItem.exists({
      name: { $regex: `^${escapeRegex(it.name)}$`, $options: "i" },
    });
    if (exists) {
      skipped.push({ name: it.name, reason: "duplicate" });
      continue;
    }
    const doc = await MenuItem.create({
      name: it.name,
      description: it.description || "",
      price: it.price,
      category: it.category,
      tags: it.tags || [],
    });
    await recordCategoryUse(doc.category);
    created.items.push(doc.toPublicJSON());
  }

  const lookup = new Map();
  const allItems = await MenuItem.find({}).select("_id name").lean();
  for (const it of allItems) {
    lookup.set(it.name.toLowerCase(), String(it._id));
  }

  for (const c of combos) {
    const refs = [];
    let allFound = true;
    for (const n of c.itemNames) {
      const id = matchItemId(n, lookup);
      if (!id) {
        allFound = false;
        skipped.push({ name: c.name, reason: `combo line not found: ${n}` });
        break;
      }
      refs.push({ itemId: id, qty: 1 });
    }
    if (!allFound) continue;
    if (refs.length < 2) {
      skipped.push({ name: c.name, reason: "combo needs >=2 items" });
      continue;
    }
    const doc = await Combo.create({
      name: c.name,
      description: c.description || "",
      comboPrice: c.comboPrice,
      items: refs,
    });
    created.combos.push(doc.toObject());
  }

  invalidateSortCache();

  await OcrIngestEvent.create({
    storeId,
    actorId: storeId,
    stage: "commit",
    status: "ok",
    itemCount: created.items.length,
    comboCount: created.combos.length,
    durationMs: Date.now() - started,
  }).catch(() => null);

  return sendSuccess(res, 201, {
    created,
    skipped,
    currency: currency || "INR",
  });
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
