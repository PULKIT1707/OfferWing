import { buildJobPrompt, JOB_MATCH_SYSTEM, jobMatchSchema } from "@/lib/agents/job-match";
import { api } from "./api";
import { FriendlyError } from "./errors";
import { getPrivateKey } from "./private-key";

// Private mode: score a saved job in the browser with the user's own key, then store the result.
export async function scoreJobPrivately(job: { id: string; title: string; company: string; location: string | null; description: string }, peopleAtCompany: number) {
  const key = await getPrivateKey();
  if (!key) throw new FriendlyError("Add your AI key in the extension settings to score jobs in Private mode.");
  const { context } = await api<{ context: string }>("/api/ext/context");
  // The AI SDKs are loaded only when Private mode actually needs them.
  const { generateInBrowser } = await import("./llm");
  const result = await generateInBrowser({
    key,
    tier: "fast",
    system: JOB_MATCH_SYSTEM,
    context,
    prompt: buildJobPrompt({ ...job, description: job.description.slice(0, 20_000) }, peopleAtCompany),
    schema: jobMatchSchema,
    schemaName: "job_match",
  });
  await api("/api/ext/matches", {
    body: { jobId: job.id, provider: key.provider, model: result.model, result: result.data, inputTokens: result.inputTokens, outputTokens: result.outputTokens },
  });
}
