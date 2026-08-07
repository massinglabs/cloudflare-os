import type { AiModelConfig, AiChatAuthorInfo } from "@gadgets/workshop-shared/api";
import type { UserAiModelRecord } from "./user.js";

const PLATFORM_MODEL_ENV_KEYS = [
  "PLATFORM_AI_MODEL_NAME",
  "PLATFORM_AI_MODEL_BASE_URL",
  "PLATFORM_AI_MODEL_API_TOKEN",
] as const;

/**
 * Resolve the optional deployment-funded OpenAI-compatible model from Worker environment values.
 * The returned credential remains inside backend capabilities and is never exposed by a public RPC.
 */
export function getPlatformAiModel(env: Cloudflare.Env): UserAiModelRecord | undefined {
  const modelId = env.PLATFORM_AI_MODEL_ID;
  const hasPartialConfig = PLATFORM_MODEL_ENV_KEYS.some((key) => env[key] !== undefined);
  if (!modelId) {
    if (hasPartialConfig) {
      throw new Error("PLATFORM_AI_MODEL_ID is required when platform AI model values are set.");
    }
    return undefined;
  }
  if (env.CF_AI_GATEWAY) {
    throw new Error("PLATFORM_AI_MODEL_ID and CF_AI_GATEWAY cannot be enabled together.");
  }
  if (!env.PLATFORM_AI_MODEL_BASE_URL || !env.PLATFORM_AI_MODEL_API_TOKEN) {
    throw new Error(
        "PLATFORM_AI_MODEL_BASE_URL and PLATFORM_AI_MODEL_API_TOKEN are required when " +
        "PLATFORM_AI_MODEL_ID is set.");
  }

  const profile: AiChatAuthorInfo = {
    type: "agent",
    id: modelId,
    name: env.PLATFORM_AI_MODEL_NAME || modelId,
  };
  const config: AiModelConfig = {
    provider: "openai",
    model: modelId,
    apiToken: env.PLATFORM_AI_MODEL_API_TOKEN,
    apiUrl: env.PLATFORM_AI_MODEL_BASE_URL.replace(/\/+$/, ""),
  };
  return { profile, config };
}
