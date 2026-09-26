import { NextResponse } from "next/server";
import { buildCandidateContext } from "@/lib/agents/job-match";
import { requireBearerUser } from "@/lib/api-auth";
import { DOCUMENT_COLUMNS, pickDocument, readDocumentText } from "@/lib/documents";
import { UserFacingError } from "@/lib/llm/errors";
import { withDefaults } from "@/lib/onboarding";

// Candidate context for Private mode: the extension sends it to the user's AI provider with their own key.
export async function GET(req: Request) {
  const auth = await requireBearerUser(req);
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId } = auth;
  try {
    const [{ data: search }, { data: docs }] = await Promise.all([
      supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("career_documents").select(DOCUMENT_COLUMNS).in("kind", ["resume", "linkedin_pdf"]).order("created_at", { ascending: false }),
    ]);
    const doc = pickDocument(docs, "resume", "linkedin_pdf");
    const careerText = doc ? await readDocumentText(supabase, doc) : null;
    return NextResponse.json({ context: buildCandidateContext(withDefaults(search), careerText) });
  } catch (err) {
    if (err instanceof UserFacingError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
