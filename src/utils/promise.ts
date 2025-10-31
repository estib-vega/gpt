import { ReadableStreamDefaultReader } from "web-streams-polyfill/ponyfill";
/**
 * Genera un flujo de valores desde un ReadableStreamDefaultReader.
 *
 * @param reader El ReadableStreamDefaultReader desde el cual generar valores.
 * @yields Los valores leídos desde el reader.
 */
export async function* streamGenerator(
  reader: ReadableStreamDefaultReader<Uint8Array>
) {
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Convierte un ReadableStream a una Promesa que se resuelve a un Uint8Array.
 *
 * @param stream El ReadableStream a convertir a un Uint8Array.
 * @returns Una promesa que se resuelve a un Uint8Array.
 */
export async function streamToUint8Array(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for await (const chunk of streamGenerator(reader)) {
    chunks.push(chunk);
  }
  return new Uint8Array(
    chunks.reduce((acc, chunk) => acc + chunk.length, 0)
  );
}