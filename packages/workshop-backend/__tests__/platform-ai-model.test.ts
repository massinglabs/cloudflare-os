import { describe, expect, it } from "vitest";
import { getPlatformAiModel, getPlatformAiModels } from "../src/platform-ai-model.js";

function env(overrides: Partial<Cloudflare.Env> = {}): Cloudflare.Env {
  return overrides as Cloudflare.Env;
}

const catalog = JSON.stringify({
  models: [
    { id: "terra", name: "Terra (Azure)" },
    { id: "luna", name: "Luna (Azure)" },
    { id: "sol", name: "Sol (Azure)" },
  ],
  quickModelId: "luna",
});

describe("getPlatformAiModels", () => {
  it("is absent when no platform model is configured", () => {
    expect(getPlatformAiModels(env())).toBeUndefined();
    expect(getPlatformAiModels(env({
      PLATFORM_AI_MODEL_API_TOKEN: "stale-secret",
      CF_AI_GATEWAY: "platform-gateway",
    }))).toBeUndefined();
  });

  it("builds the ordered catalog with shared credentials and base URL", () => {
    const result = getPlatformAiModels(env({
      PLATFORM_AI_MODEL_CATALOG: catalog,
      PLATFORM_AI_MODEL_ID: "terra",
      PLATFORM_AI_MODEL_NAME: "Terra (Azure)",
      PLATFORM_AI_MODEL_BASE_URL: "https://resource.example/openai/v1/",
      PLATFORM_AI_MODEL_API_TOKEN: "secret-token",
    }));

    expect(result).toEqual({
      quickModelId: "luna",
      models: [
        {
          profile: { type: "agent", id: "terra", name: "Terra (Azure)" },
          config: {
            provider: "openai",
            model: "terra",
            apiToken: "secret-token",
            apiUrl: "https://resource.example/openai/v1",
          },
        },
        {
          profile: { type: "agent", id: "luna", name: "Luna (Azure)" },
          config: {
            provider: "openai",
            model: "luna",
            apiToken: "secret-token",
            apiUrl: "https://resource.example/openai/v1",
          },
        },
        {
          profile: { type: "agent", id: "sol", name: "Sol (Azure)" },
          config: {
            provider: "openai",
            model: "sol",
            apiToken: "secret-token",
            apiUrl: "https://resource.example/openai/v1",
          },
        },
      ],
    });
    expect(getPlatformAiModel(env({
      PLATFORM_AI_MODEL_CATALOG: catalog,
      PLATFORM_AI_MODEL_BASE_URL: "https://resource.example/openai/v1",
      PLATFORM_AI_MODEL_API_TOKEN: "secret-token",
    }))?.profile.id).toBe("terra");
  });

  it("retains the scalar one-model fallback", () => {
    expect(getPlatformAiModels(env({
      PLATFORM_AI_MODEL_ID: "deployment-name",
      PLATFORM_AI_MODEL_NAME: "Company model",
      PLATFORM_AI_MODEL_BASE_URL: "https://resource.example/openai/v1/",
      PLATFORM_AI_MODEL_API_TOKEN: "secret-token",
    }))).toEqual({
      quickModelId: "deployment-name",
      models: [{
        profile: { type: "agent", id: "deployment-name", name: "Company model" },
        config: {
          provider: "openai",
          model: "deployment-name",
          apiToken: "secret-token",
          apiUrl: "https://resource.example/openai/v1",
        },
      }],
    });
  });

  it("rejects partial, malformed, duplicate, and conflicting configuration", () => {
    expect(() => getPlatformAiModels(env({
      PLATFORM_AI_MODEL_CATALOG: "{}",
      PLATFORM_AI_MODEL_BASE_URL: "https://resource.example/openai/v1",
      PLATFORM_AI_MODEL_API_TOKEN: "secret-token",
    }))).toThrow("models must be a non-empty array");

    expect(() => getPlatformAiModels(env({
      PLATFORM_AI_MODEL_CATALOG: JSON.stringify({
        models: [{ id: "duplicate", name: "One" }, { id: "duplicate", name: "Two" }],
        quickModelId: "duplicate",
      }),
      PLATFORM_AI_MODEL_BASE_URL: "https://resource.example/openai/v1",
      PLATFORM_AI_MODEL_API_TOKEN: "secret-token",
    }))).toThrow("duplicate");

    expect(() => getPlatformAiModels(env({
      PLATFORM_AI_MODEL_CATALOG: JSON.stringify({
        models: [{ id: " padded", name: "Padded" }],
        quickModelId: " padded",
      }),
      PLATFORM_AI_MODEL_BASE_URL: "https://resource.example/openai/v1",
      PLATFORM_AI_MODEL_API_TOKEN: "secret-token",
    }))).toThrow("unpadded");

    expect(() => getPlatformAiModels(env({
      PLATFORM_AI_MODEL_CATALOG: JSON.stringify({
        models: [{ id: "terra", name: "Terra" }],
        quickModelId: "luna",
      }),
      PLATFORM_AI_MODEL_BASE_URL: "https://resource.example/openai/v1",
      PLATFORM_AI_MODEL_API_TOKEN: "secret-token",
    }))).toThrow("quickModelId");

    expect(() => getPlatformAiModels(env({
      PLATFORM_AI_MODEL_CATALOG: catalog,
      PLATFORM_AI_MODEL_BASE_URL: "http://resource.example/openai/v1",
      PLATFORM_AI_MODEL_API_TOKEN: "secret-token",
    }))).toThrow("HTTPS");

    expect(() => getPlatformAiModels(env({
      PLATFORM_AI_MODEL_CATALOG: catalog,
      PLATFORM_AI_MODEL_BASE_URL: "https://user:password@resource.example/openai/v1",
      PLATFORM_AI_MODEL_API_TOKEN: "secret-token",
    }))).toThrow("without credentials");

    expect(() => getPlatformAiModels(env({
      PLATFORM_AI_MODEL_ID: "deployment-name",
      PLATFORM_AI_MODEL_BASE_URL: "https://resource.example/openai/v1",
    }))).toThrow("API_TOKEN");

    expect(() => getPlatformAiModels(env({
      PLATFORM_AI_MODEL_CATALOG: catalog,
      PLATFORM_AI_MODEL_BASE_URL: "https://resource.example/openai/v1",
      PLATFORM_AI_MODEL_API_TOKEN: "secret-token",
      CF_AI_GATEWAY: "platform-gateway",
    }))).toThrow("cannot be enabled together");
  });
});
