import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { UserFacingError } from "@/lib/llm/errors";

const MAX_CHARS = 60_000;

export type StoredDocument = { id: string; kind: string; storage_path: string; file_name: string; extracted_text: string | null };
export const DOCUMENT_COLUMNS = "id, kind, storage_path, file_name, extracted_text";

// Returns a document's plain text, extracting it once and caching it on the row for every later agent run.
export async function readDocumentText(supabase: SupabaseClient, doc: StoredDocument): Promise<string> {
  if (doc.extracted_text) return doc.extracted_text;

  const { data, error } = await supabase.storage.from("career-docs").download(doc.storage_path);
  if (error || !data) throw new UserFacingError(`Couldn't open ${doc.file_name}. Try uploading it again.`);
  const bytes = new Uint8Array(await data.arrayBuffer());

  let text: string;
  if (doc.file_name.toLowerCase().endsWith(".docx")) {
    text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
  } else {
    try {
      text = (await extractText(bytes, { mergePages: true })).text;
    } catch {
      throw new UserFacingError(`${doc.file_name} doesn't look like a readable PDF. Try re-exporting it.`);
    }
  }

  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 200) {
    throw new UserFacingError(`We couldn't read enough text from ${doc.file_name}. If it's a scanned image, upload a text-based PDF instead.`);
  }
  text = text.slice(0, MAX_CHARS);
  await supabase.from("career_documents").update({ extracted_text: text }).eq("id", doc.id);
  return text;
}

// Newest document of the first kind that exists, in order of preference.
export function pickDocument(docs: StoredDocument[] | null, ...kinds: string[]): StoredDocument | undefined {
  for (const kind of kinds) {
    const doc = docs?.find((d) => d.kind === kind);
    if (doc) return doc;
  }
}
