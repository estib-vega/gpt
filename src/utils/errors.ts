/**
 * Lanza un error con el mensaje especificado.
 * @param message - El mensaje de error.
 * @returns Esta función nunca devuelve un valor.
 * @throws {Error} - El objeto de error con el mensaje especificado.
 */
export function raise(message: string): never {
  throw new Error(message);
}