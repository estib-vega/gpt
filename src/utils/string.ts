/**
 * Splits a given text into an array of paragraphs.
 *
 * @param text - The text to be split into paragraphs.
 * @returns An array of paragraphs.
 */
export function splitIntoParragraphs(text: string | undefined): string[] {
  if (!text) return [];
  return text.split("\n");
}
