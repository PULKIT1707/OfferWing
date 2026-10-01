import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { Credential } from "./credentials";
import { UserFacingError } from "./errors";
import { modelFor, type Tier } from "./models";

type Request<T extends z.ZodType> = {
  credential: Credential;
  tier: Tier;
  system: string;
  // Stable per-user context (profile, resume). Sent before `prompt` so providers can cache it across a batch.
  context?: string;
  prompt: string;
  schema: T;
  schemaName: string;
};

export type Generated<T> = { data: T; model: string; inputTokens: number | null; outputTokens: number | null };

const fullPrompt = (r: { context?: string; prompt: string }) => (r.context ? `${r.context}\n\n${r.prompt}` : r.prompt);

async function viaAnthropic<T extends z.ZodType>(r: Request<T>, model: string): Promise<Generated<z.infer<T>>> {
  const client = new Anthropic({ apiKey: r.credential.apiKey });
  // Haiku 4.5 rejects `effort`; server-side fallbacks apply to the Opus 5 line.
  const isHaiku = model.startsWith("claude-haiku");
  const isOpus5 = model.startsWith("claude-opus-5");
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    system: r.system,
    messages: [
      {
        role: "user",
        content: r.context
          ? [
              { type: "text", text: r.context, cache_control: { type: "ephemeral" } },
              { type: "text", text: r.prompt },
            ]
          : r.prompt,
      },
    ],
    output_config: { format: betaZodOutputFormat(r.schema), ...(isHaiku ? {} : { effort: "high" as const }) },
    ...(isOpus5 ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });
  if (response.stop_reason === "refusal") throw new UserFacingError("The AI model declined this request. Try again, or contact support if it keeps happening.");
  if (response.stop_reason === "max_tokens") throw new UserFacingError("The AI response was cut off. Please try again.");
  if (!response.parsed_output) throw new Error("Anthropic returned no parsed output");
  return {
    data: response.parsed_output as z.infer<T>,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function viaOpenAI<T extends z.ZodType>(r: Request<T>, model: string): Promise<Generated<z.infer<T>>> {
  const client = new OpenAI({ apiKey: r.credential.apiKey });
  const response = await client.responses.parse({
    model,
    instructions: r.system,
    input: fullPrompt(r),
    text: { format: zodTextFormat(r.schema, r.schemaName) },
  });
  if (!response.output_parsed) throw new Error("OpenAI returned no parsed output");
  return {
    data: response.output_parsed as z.infer<T>,
    model: response.model,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
  };
}

async function viaGemini<T extends z.ZodType>(r: Request<T>, model: string): Promise<Generated<z.infer<T>>> {
  const client = new GoogleGenAI({ apiKey: r.credential.apiKey });
  const response = await client.models.generateContent({
    model,
    contents: fullPrompt(r),
    config: {
      systemInstruction: r.system,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(r.schema),
    },
  });
  const parsed = r.schema.safeParse(JSON.parse(response.text ?? "null"));
  if (!parsed.success) throw new Error("Gemini output didn't match the schema");
  return {
    data: parsed.data,
    model,
    inputTokens: response.usageMetadata?.promptTokenCount ?? null,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
  };
}

// Single entry point every agent uses: routes to the user's provider and returns schema-valid data.
export async function generateStructured<T extends z.ZodType>(r: Request<T>): Promise<Generated<z.infer<T>>> {
  const model = modelFor(r.credential.provider, r.tier);
  try {
    if (r.credential.provider === "anthropic") return await viaAnthropic(r, model);
    if (r.credential.provider === "openai") return await viaOpenAI(r, model);
    return await viaGemini(r, model);
  } catch (err) {
    if (err instanceof UserFacingError) throw err;
    const status = (err as { status?: number }).status;
    if (r.credential.source === "starter" && (status === 401 || status === 403 || status === 429)) {
      // Safe diagnostics: the provider's message plus the key's type prefix and length, never the key.
      const key = r.credential.apiKey;
      console.error("starter credential failed", status, {
        message: (err as Error).message?.slice(0, 300),
        keyType: key.match(/^sk-ant-[a-z]+\d*/)?.[0] ?? `unexpected prefix (${key.slice(0, 3)}…)`,
        keyLength: key.length,
      });
      throw new UserFacingError("Starter credits are temporarily unavailable. Try again later, or add your own AI key in Settings → AI & keys.");
    }
    if (status === 401 || status === 403) throw new UserFacingError("Your AI provider rejected the key. Update it in Settings → AI & keys.");
    if (status === 429) throw new UserFacingError("Your AI provider is rate-limiting requests or your credit ran out. Try again later.");
    if (status === 404) throw new UserFacingError(`The model "${model}" isn't available on your AI account.`);
    throw err;
  }
}
