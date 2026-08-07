import type { AiModelConfig, AiChatAuthorInfo } from "@gadgets/workshop-shared/api";
import type { UserAiModelRecord } from "./user.js";

type PlatformAiModelEntry = {
  id: string;
  name: string;
};

type PlatformAiModelCatalog = {
  models: PlatformAiModelEntry[];
  quickModelId: string;
};

export type PlatformAiModels = {
  models: UserAiModelRecord[];
  quickModelId: string;
};

function requireBaseUrl(env: Cloudflare.Env): string {
  const baseUrl = env.PLATFORM_AI_MODEL_BASE_URL;
  if (!baseUrl) {
    throw new Error("PLATFORM_AI_MODEL_BASE_URL is required for platform AI models.");
  }
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("PLATFORM_AI_MODEL_BASE_URL must be a valid HTTPS URL.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
      parsed.search || parsed.hash) {
    throw new Error(
        "PLATFORM_AI_MODEL_BASE_URL must be an HTTPS URL without credentials, query, or fragment.");
  }
  return baseUrl.replace(/\/+$/, "");
}

function requireApiToken(env: Cloudflare.Env): string {
  if (!env.PLATFORM_AI_MODEL_API_TOKEN) {
    throw new Error("PLATFORM_AI_MODEL_API_TOKEN is required for platform AI models.");
  }
  return env.PLATFORM_AI_MODEL_API_TOKEN;
}

function parseCatalog(raw: string): PlatformAiModelCatalog {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("PLATFORM_AI_MODEL_CATALOG must be valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("PLATFORM_AI_MODEL_CATALOG must be an object.");
  }
  const catalog = value as Partial<PlatformAiModelCatalog>;
  if (!Array.isArray(catalog.models) || catalog.models.length === 0) {
    throw new Error("PLATFORM_AI_MODEL_CATALOG.models must be a non-empty array.");
  }
  const ids = new Set<string>();
  for (const model of catalog.models) {
    if (!model || typeof model !== "object" ||
        typeof model.id !== "string" || !model.id.trim() || model.id !== model.id.trim() ||
        typeof model.name !== "string" || !model.name.trim() || model.name !== model.name.trim()) {
      throw new Error("Every platform AI catalog model must have a non-empty, unpadded id and name.");
    }
    if (ids.has(model.id)) {
      throw new Error(`PLATFORM_AI_MODEL_CATALOG contains duplicate model ID: ${model.id}.`);
    }
    ids.add(model.id);
  }
  if (typeof catalog.quickModelId !== "string" || !ids.has(catalog.quickModelId)) {
    throw new Error("PLATFORM_AI_MODEL_CATALOG.quickModelId must identify a catalog model.");
  }
  return { models: catalog.models, quickModelId: catalog.quickModelId };
}

function makeModels(catalog: PlatformAiModelCatalog, baseUrl: string,
                    apiToken: string): PlatformAiModels {
  return {
    models: catalog.models.map((entry): UserAiModelRecord => {
      const profile: AiChatAuthorInfo = { type: "agent", id: entry.id, name: entry.name };
      const config: AiModelConfig = {
        provider: "openai",
        model: entry.id,
        apiToken,
        apiUrl: baseUrl,
      };
      return { profile, config };
    }),
    quickModelId: catalog.quickModelId,
  };
}

/**
 * Resolve all optional deployment-funded OpenAI-compatible models from Worker environment values.
 * Credentials remain inside backend capabilities and are never exposed by a public RPC.
 */
export function getPlatformAiModels(env: Cloudflare.Env): PlatformAiModels | undefined {
  const hasCatalog = env.PLATFORM_AI_MODEL_CATALOG !== undefined;
  // Wrangler secrets persist until explicitly deleted. A token left behind after platform mode is
  // disabled must not activate a partial model configuration or block AI Gateway mode.
  const hasLegacyModel = env.PLATFORM_AI_MODEL_ID !== undefined;
  if (!hasCatalog && !hasLegacyModel) return undefined;

  if (env.CF_AI_GATEWAY) {
    throw new Error("Platform AI models and CF_AI_GATEWAY cannot be enabled together.");
  }

  const baseUrl = requireBaseUrl(env);
  const apiToken = requireApiToken(env);

  if (hasCatalog) {
    if (!env.PLATFORM_AI_MODEL_CATALOG) {
      throw new Error("PLATFORM_AI_MODEL_CATALOG must not be empty.");
    }
    const catalog = parseCatalog(env.PLATFORM_AI_MODEL_CATALOG);
    const legacyId = env.PLATFORM_AI_MODEL_ID;
    const legacyName = env.PLATFORM_AI_MODEL_NAME;
    if ((legacyId === undefined) !== (legacyName === undefined)) {
      throw new Error("Legacy platform AI model ID and name must be configured together.");
    }
    if (legacyId !== undefined &&
        (legacyId !== catalog.models[0].id || legacyName !== catalog.models[0].name)) {
      throw new Error("Legacy platform AI model values must match the first catalog model.");
    }
    return makeModels(catalog, baseUrl, apiToken);
  }

  const modelId = env.PLATFORM_AI_MODEL_ID;
  if (!modelId) {
    throw new Error("PLATFORM_AI_MODEL_ID is required when platform AI model values are set.");
  }
  const catalog: PlatformAiModelCatalog = {
    models: [{ id: modelId, name: env.PLATFORM_AI_MODEL_NAME || modelId }],
    quickModelId: modelId,
  };
  return makeModels(catalog, baseUrl, apiToken);
}

/** Resolve the first deployment-funded model for callers retaining the legacy scalar API. */
export function getPlatformAiModel(env: Cloudflare.Env): UserAiModelRecord | undefined {
  return getPlatformAiModels(env)?.models[0];
}
