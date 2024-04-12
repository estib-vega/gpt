/**
 * Generates a stream of values from a ReadableStreamDefaultReader.
 *
 * @param reader The ReadableStreamDefaultReader to generate values from.
 * @yields The values read from the reader.
 */
export async function* streamGenerator(reader: ReadableStreamDefaultReader<Uint8Array>) {
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