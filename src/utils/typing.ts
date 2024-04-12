/**
 * Checks if the given value is a string.
 *
 * @param something - The value to check.
 * @returns `true` if the value is a string, `false` otherwise.
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
 * Checks if the given value is an object.
 *
 * @param something - The value to check.
 * @returns `true` if the value is an object, `false` otherwise.
 */
export function isNonEmptyObject(something: unknown): something is UnknownObject {
  return (
    typeof something === "object" &&
    something !== null &&
    !Array.isArray(something) &&
    (Object.keys(something).length > 0 || Object.getOwnPropertySymbols(something).length > 0)
  );
}
