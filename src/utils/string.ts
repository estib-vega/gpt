/**
 * Divide un texto dado en un arreglo de párrafos.
 *
 * @param text - El texto a dividir en párrafos.
 * @returns Un arreglo de párrafos.
 */
export function splitIntoParragraphs(text: string | undefined): string[] {
  if (!text) return [];
  return text.split("\n");
}
