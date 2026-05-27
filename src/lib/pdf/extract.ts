import { extractText, getDocumentProxy } from "unpdf";

/** Extracts the full text of a PDF (merged across pages) using unpdf. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}
