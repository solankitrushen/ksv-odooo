import { getOcrProvider } from "../Integrations/ocr/index.js";

const PRICE_RX = /(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)?\s*(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)?\s*$/i;
const COMBO_HINT_RX = /\b(combo|meal|set|thali|platter|family pack|includes?|with|\+)\b/i;
const CATEGORY_HINT_RX = /^[A-Z][A-Z\s&'/-]{2,40}$/;
const STRIP_DOTS_RX = /[.·•⋯⸱…\-—–]{2,}/g;

function normalizePrice(token) {
  const cleaned = String(token).replace(/[, ]/g, "");
  const n = Number(cleaned);
  if (Number.isNaN(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function extractPriceTail(line) {
  const stripped = line.replace(STRIP_DOTS_RX, " ").trim();
  const m = stripped.match(PRICE_RX);
  if (!m) return null;
  const price = normalizePrice(m[1]);
  if (price === null) return null;
  if (price < 1 || price > 100000) return null;
  const name = stripped.slice(0, m.index).replace(/[\s·.…\-—–]+$/g, "").trim();
  return { name, price };
}

function looksLikeCategory(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length < 3 || trimmed.length > 40) return false;
  if (PRICE_RX.test(trimmed)) return false;
  if (CATEGORY_HINT_RX.test(trimmed)) return true;
  return false;
}

function looksLikeCombo(line, name) {
  const subject = (name || line).trim();
  return COMBO_HINT_RX.test(subject) || /\bcombo\b/i.test(line);
}

export async function parseImage({ buffer, mimeType }) {
  const provider = getOcrProvider();
  const detected = await provider.detect(buffer, mimeType);
  const rawText = detected.rawText || "";
  const blocks = detected.blocks || [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items = [];
  const combos = [];
  const unmatched = [];
  let currentCategory = "Uncategorized";

  for (const block of blocks) {
    const innerLines = block.text.split(/\n|;/).map((l) => l.trim()).filter(Boolean);
    for (const rawLine of innerLines) {
      if (looksLikeCategory(rawLine)) {
        currentCategory = titleCase(rawLine);
        continue;
      }

      const tail = extractPriceTail(rawLine);
      if (!tail) {
        if (rawLine.length > 2) unmatched.push(rawLine);
        continue;
      }

      const cleanName = sanitizeName(tail.name);
      if (!cleanName) {
        unmatched.push(rawLine);
        continue;
      }

      const parserScore = scoreLine(rawLine, cleanName, tail.price);
      const confidence = Math.min(block.confidence ?? 0.8, parserScore);

      if (looksLikeCombo(rawLine, cleanName)) {
        combos.push({
          name: cleanName,
          description: "",
          comboPrice: tail.price,
          itemNames: extractComboParts(rawLine),
          confidence,
        });
      } else {
        items.push({
          name: cleanName,
          description: "",
          price: tail.price,
          category: currentCategory,
          tags: [],
          confidence,
        });
      }
    }
  }

  if (items.length === 0 && combos.length === 0 && lines.length > 0) {
    for (const rawLine of lines) {
      if (looksLikeCategory(rawLine)) {
        currentCategory = titleCase(rawLine);
        continue;
      }
      const tail = extractPriceTail(rawLine);
      if (!tail) {
        unmatched.push(rawLine);
        continue;
      }
      const cleanName = sanitizeName(tail.name);
      if (!cleanName) {
        unmatched.push(rawLine);
        continue;
      }
      if (looksLikeCombo(rawLine, cleanName)) {
        combos.push({
          name: cleanName,
          description: "",
          comboPrice: tail.price,
          itemNames: extractComboParts(rawLine),
          confidence: 0.55,
        });
      } else {
        items.push({
          name: cleanName,
          description: "",
          price: tail.price,
          category: currentCategory,
          tags: [],
          confidence: 0.55,
        });
      }
    }
  }

  return { items, combos, unmatched, rawText };
}

function titleCase(s) {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
}

function sanitizeName(s) {
  return s
    .replace(/^\d+[.)]\s*/, "")
    .replace(/[^\w\s&',./()-]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 120);
}

function scoreLine(line, name, price) {
  let score = 0.6;
  if (/[a-z]/i.test(name)) score += 0.15;
  if (name.length >= 3) score += 0.1;
  if (price >= 5 && price <= 5000) score += 0.1;
  if (line.length < 80) score += 0.05;
  return Math.min(score, 0.95);
}

function extractComboParts(line) {
  const withRx = /(?:with|includes?|and|\+)/i;
  const cleaned = line.replace(/\b(combo|meal|set|thali|platter)\b/gi, "").trim();
  if (!withRx.test(cleaned)) return [];
  const parts = cleaned
    .split(withRx)
    .slice(1)
    .join(" ")
    .split(/[,&+]|\band\b/i)
    .map((p) => sanitizeName(p))
    .filter((p) => p.length >= 2);
  return parts.slice(0, 10);
}
