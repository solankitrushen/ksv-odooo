import * as googleVision from "./googleVisionProvider.js";

const PROVIDERS = {
  googleVision,
};

export function getOcrProvider() {
  const name = process.env.OCR_PROVIDER || "googleVision";
  const provider = PROVIDERS[name];
  if (!provider) {
    const err = new Error(`Unknown OCR provider: ${name}`);
    err.code = "OCR_UNKNOWN_PROVIDER";
    throw err;
  }
  return provider;
}
