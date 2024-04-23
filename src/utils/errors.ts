/**
 * Raises an error with the specified message.
 * @param message - The error message.
 * @returns This function never returns a value.
 * @throws {Error} - The error object with the specified message.
 */
export function raise(message: string): never {
  throw new Error(message);
}