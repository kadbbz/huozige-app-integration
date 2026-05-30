export function parseJsonObject(responseText: string): Record<string, unknown> {
  const parsed = JSON.parse(responseText) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Response is not a JSON object.");
  }

  return parsed;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
