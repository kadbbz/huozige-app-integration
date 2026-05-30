export function extractErrorMessage(responseText: string, fallback: string): string {
  if (!responseText) {
    return fallback || "Request failed.";
  }

  try {
    const parsed = JSON.parse(responseText) as Record<string, unknown>;
    const candidates = [parsed.error_description, parsed.error, parsed.Message, parsed.message];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.length > 0) {
        return candidate;
      }
    }
  } catch {
    return responseText;
  }

  return responseText;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}
