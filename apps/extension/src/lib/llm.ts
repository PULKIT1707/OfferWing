import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { modelFor, type Tier } from "@/lib/llm/models";
import { FriendlyError } from "./errors";
import type { PrivateKey } from "./private-key";

// Browser-side counterpart of the web app's generateStructured, used only in Private mode:
// requests go straight from this browser to the user's AI provider with their own key.

export async function verifyKey(key: PrivateKey): Promise<void> {
  try {
    if (key.provider === "anthropic") await new Anthropic({ apiKey: key.apiKey, dangerouslyAllowBrowser: true }).models.list({ limit: 1 });
    else if (key.provider === "openai") await new OpenAI({ apiKey: key.apiKey, dangerouslyAllowBrowser: true }).models.list();
    else await new GoogleGenAI({ apiKey: key.apiKey }).models.list();
  } catch (err) {
    const status = (err as { status?: number }).status;
    throw new FriendlyError(status === 401 || status === 403 || status === 400 ? "The provider rejected this key." : "Couldn't reach the provider to check the key.");
  }
}

export async function generateInBrowser<T extends z.ZodType>(r: {
  key: PrivateKey;
  tier: Tier;
  system: string;
  context: string;
  prompt: string;
  schema: T;
  schemaName: string;
}): Promise<{ data: z.infer<T>; model: string; inputTokens: number | null; outputTokens: number | null }> {
  const model = modelFor(r.key.provider, r.tier);
  try {
    if (r.key.provider === "anthropic") {
      const client = new Anthropic({ apiKey: r.key.apiKey, dangerouslyAllowBrowser: true });
      const isHaiku = model.startsWith("claude-haiku");
      const isOpus5 = model.startsWith("claude-opus-5");
      const res = await client.beta.messages.parse({
        model,
        max_tokens: 16000,
        system: r.system,
        messages: [{ role: "user", content: [{ type: "text", text: r.context, cache_control: { type: "ephemeral" } }, { type: "text", text: r.prompt }] }],
        output_config: { format: betaZodOutputFormat(r.schema), ...(isHaiku ? {} : { effort: "high" as const }) },
        ...(isOpus5 ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      if (res.stop_reason === "refusal") throw new FriendlyError("The AI model declined this request.");
      if (!res.parsed_output) throw new FriendlyError("The AI response was incomplete. Try again.");
      return { data: res.parsed_output as z.infer<T>, model: res.model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
    }
    if (r.key.provider === "openai") {
      const client = new OpenAI({ apiKey: r.key.apiKey, dangerouslyAllowBrowser: true });
      const res = await client.responses.parse({ model, instructions: r.system, input: `${r.context}\n\n${r.prompt}`, text: { format: zodTextFormat(r.schema, r.schemaName) } });
      if (!res.output_parsed) throw new FriendlyError("The AI response was incomplete. Try again.");
      return { data: res.output_parsed as z.infer<T>, model: res.model, inputTokens: res.usage?.input_tokens ?? null, outputTokens: res.usage?.output_tokens ?? null };
    }
    const client = new GoogleGenAI({ apiKey: r.key.apiKey });
    const res = await client.models.generateContent({
      model,
      contents: `${r.context}\n\n${r.prompt}`,
      config: { systemInstruction: r.system, responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(r.schema) },
    });
    const parsed = r.schema.safeParse(JSON.parse(res.text ?? "null"));
    if (!parsed.success) throw new FriendlyError("The AI response didn't match the expected format. Try again.");
    return { data: parsed.data, model, inputTokens: res.usageMetadata?.promptTokenCount ?? null, outputTokens: res.usageMetadata?.candidatesTokenCount ?? null };
  } catch (err) {
    if (err instanceof FriendlyError) throw err;
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) throw new FriendlyError("Your AI provider rejected the key. Update it in the extension settings.");
    if (status === 429) throw new FriendlyError("Your AI provider is rate-limiting requests or your credit ran out.");
    if (status === 404) throw new FriendlyError(`The model "${model}" isn't available on your AI account.`);
    throw new FriendlyError("Couldn't reach your AI provider. Check your connection and try again.");
  }
}
