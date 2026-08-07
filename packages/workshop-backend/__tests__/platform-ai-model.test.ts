import { describe, expect, it } from "vitest";
import { getPlatformAiModel } from "../src/platform-ai-model.js";

function env(overrides: Partial<Cloudflare.Env> = {}): Cloudflare.Env {
  return overrides as Cloudflare.Env;
}

describe("getPlatformAiModel", () => {
  it("is absent when no platform model is configured", () => {
    expect(getPlatformAiModel(env())).toBeUndefined();
  });

  it("builds one OpenAI-compatible model and normalizes its base URL", () => {
    expect(getPlatformAiModel(env({
      PLATFORM_AI_MODEL_ID: "deployment-name",
      PLATFORM_AI_MODEL_NAME: "Company model",
      PLATFORM_AI_MODEL_BASE_URL: "https://resource.example/openai/v1/",
      PLATFORM_AI_MODEL_API_TOKEN: "secret-token",
    }))).toEqual({
      profile: { type: "agent", id: "deployment-name", name: "Company model" },
      config: {
        provider: "openai",
        model: "deployment-name",
        apiToken: "secret-token",
        apiUrl: "https://resource.example/openai/v1",
      },
    });
  });

  it("rejects partial or conflicting configuration", () => {
    expect(() => getPlatformAiModel(env({
      PLATFORM_AI_MODEL_BASE_URL: "https://resource.example/openai/v1",
    }))).toThrow("PLATFORM_AI_MODEL_ID is required");

    expect(() => getPlatformAiModel(env({
      PLATFORM_AI_MODEL_ID: "deployment-name",
    }))).toThrow("PLATFORM_AI_MODEL_BASE_URL and PLATFORM_AI_MODEL_API_TOKEN are required");

    expect(() => getPlatformAiModel(env({
      PLATFORM_AI_MODEL_ID: "deployment-name",
      PLATFORM_AI_MODEL_BASE_URL: "https://resource.example/openai/v1",
      PLATFORM_AI_MODEL_API_TOKEN: "secret-token",
      CF_AI_GATEWAY: "platform-gateway",
    }))).toThrow("PLATFORM_AI_MODEL_ID and CF_AI_GATEWAY cannot be enabled together");
  });
});
