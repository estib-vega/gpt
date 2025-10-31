/**
 * Verifica si el valor dado es una cadena.
 *
 * @param something - El valor a verificar.
 * @returns `true` si el valor es una cadena, `false` en caso contrario.
 */
export function isStr(something: unknown): something is string {
  return typeof something === "string";
}

export function isEnumEntry<T extends string>(
  something: unknown,
  enumeration: Record<string, T>
): something is T {
  return (
    isStr(something) &&
    Object.values(enumeration).find((value) => value === something) !==
      undefined
  );
}

export type UnknownObject = Record<string, unknown>;

/**
 * Verifica si el valor dado es un objeto.
 *
 * @param something - El valor a verificar.
 * @returns `true` si el valor es un objeto, `false` en caso contrario.
 */
export function isNonEmptyObject(something: unknown): something is UnknownObject {
  return (
    typeof something === "object" &&
    something !== null &&
    !Array.isArray(something) &&
    (Object.keys(something).length > 0 || Object.getOwnPropertySymbols(something).length > 0)
  );
}
