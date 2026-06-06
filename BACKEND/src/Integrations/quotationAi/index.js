// Pluggable AI quotation provider selector.
//
// Mirrors src/Integrations/ocr/index.js. Reads QUOTATION_AI_PROVIDER
// (default "heuristic"). If "llm" is selected but not configured
// (missing QUOTATION_AI_LLM_BASE_URL / QUOTATION_AI_LLM_API_KEY), gracefully
// falls back to the heuristic provider (NFR-8).
//
// Callers MUST await provider methods: the heuristic provider is synchronous
// while the llm provider is async — `await` works for both.

import * as heuristic from "./heuristicProvider.js";
import * as llm from "./llmProvider.js";

const PROVIDERS = {
  heuristic,
  llm,
};

export function getQuotationAiProvider() {
  const name = process.env.QUOTATION_AI_PROVIDER || "heuristic";
  const provider = PROVIDERS[name];

  if (!provider) {
    // Unknown provider name — fail safe to the deterministic heuristic.
    return heuristic;
  }

  if (name === "llm" && !llm.isConfigured()) {
    // Graceful fallback when LLM is selected but env is not configured.
    return heuristic;
  }

  return provider;
}
