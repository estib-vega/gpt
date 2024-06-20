import { ReadableStreamDefaultReader } from "web-streams-polyfill/ponyfill";
/**
 * Generates a stream of values from a ReadableStreamDefaultReader.
 *
 * @param reader The ReadableStreamDefaultReader to generate values from.
 * @yields The values read from the reader.
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
 * Converts a ReadableStream to a Promise that resolves to a Uint8Array.
 *
 * @param stream The ReadableStream to convert to a Uint8Array.
 * @returns A Promise that resolves to a Uint8Array.
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