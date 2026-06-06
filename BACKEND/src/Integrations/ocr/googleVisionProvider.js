import axios from "axios";

const DEFAULT_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

export function isConfigured() {
  return Boolean(process.env.GCV_API_KEY);
}

export async function detect(buffer, mimeType = "image/jpeg") {
  if (!isConfigured()) {
    const err = new Error("GCV_API_KEY missing");
    err.code = "OCR_PROVIDER_NOT_CONFIGURED";
    throw err;
  }
  const endpoint = process.env.GCV_ENDPOINT || DEFAULT_ENDPOINT;
  const url = `${endpoint}?key=${process.env.GCV_API_KEY}`;

  const content = Buffer.isBuffer(buffer)
    ? buffer.toString("base64")
    : Buffer.from(buffer).toString("base64");

  const payload = {
    requests: [
      {
        image: { content },
        features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
        imageContext: { languageHints: ["en", "hi"] },
      },
    ],
  };

  try {
    const { data } = await axios.post(url, payload, {
      timeout: 25_000,
      headers: { "Content-Type": "application/json" },
      maxBodyLength: 20 * 1024 * 1024,
    });

    const ann = data?.responses?.[0];
    if (!ann) {
      return { rawText: "", blocks: [] };
    }
    if (ann.error) {
      const err = new Error(ann.error.message || "GCV error");
      err.code = "OCR_PROVIDER_ERROR";
      err.status = ann.error.code || 500;
      throw err;
    }

    const rawText = ann.fullTextAnnotation?.text || "";
    const blocks = flattenBlocks(ann.fullTextAnnotation);

    return { rawText, blocks, _mimeType: mimeType };
  } catch (err) {
    if (err.response) {
      const e = new Error(err.response.data?.error?.message || "GCV HTTP error");
      e.code = "OCR_PROVIDER_HTTP";
      e.status = err.response.status;
      throw e;
    }
    throw err;
  }
}

function flattenBlocks(fullText) {
  if (!fullText?.pages) return [];
  const out = [];
  for (const page of fullText.pages) {
    for (const block of page.blocks || []) {
      for (const para of block.paragraphs || []) {
        const words = [];
        for (const word of para.words || []) {
          const w = (word.symbols || []).map((s) => s.text || "").join("");
          if (w) words.push(w);
        }
        const text = words.join(" ").trim();
        if (text) {
          out.push({
            text,
            confidence: para.confidence ?? block.confidence ?? 0.8,
            bbox: para.boundingBox || block.boundingBox || null,
          });
        }
      }
    }
  }
  return out;
}
