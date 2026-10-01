import { afterEach, describe, expect, it, vi } from "vitest";
import { providerForKey, starterKey } from "./credentials";

describe("providerForKey", () => {
  it("recognizes each provider's key format", () => {
    expect(providerForKey("sk-ant-api03-abc")).toBe("anthropic");
    expect(providerForKey("sk-proj-abc")).toBe("openai");
    expect(providerForKey("sk-abc")).toBe("openai");
    expect(providerForKey("AIzaSyabc")).toBe("gemini");
    expect(providerForKey("nonsense")).toBeNull();
  });
});

describe("starterKey", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers the OpenAI variable and trims pasted quotes and spaces", () => {
    vi.stubEnv("OFFERWING_STARTER_OPENAI_API_KEY", ' "sk-proj-123" \n');
    vi.stubEnv("OFFERWING_STARTER_ANTHROPIC_API_KEY", "sk-ant-api03-xyz");
    expect(starterKey()).toEqual({ provider: "openai", apiKey: "sk-proj-123" });
  });

  it("uses the key's real provider even if it's in the Anthropic variable", () => {
    vi.stubEnv("OFFERWING_STARTER_OPENAI_API_KEY", "");
    vi.stubEnv("OFFERWING_STARTER_ANTHROPIC_API_KEY", "sk-proj-456");
    expect(starterKey()).toEqual({ provider: "openai", apiKey: "sk-proj-456" });
  });

  it("returns null when nothing usable is set", () => {
    vi.stubEnv("OFFERWING_STARTER_OPENAI_API_KEY", "");
    vi.stubEnv("OFFERWING_STARTER_ANTHROPIC_API_KEY", "not-a-key");
    expect(starterKey()).toBeNull();
  });
});
