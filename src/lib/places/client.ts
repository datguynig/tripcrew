const BASE_URL = "https://places.googleapis.com";

export class PlacesError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "PlacesError";
  }
}

export interface PlacesRequestOptions {
  path: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  fieldMask: string;
  queryParams?: Record<string, string>;
}

export async function placesRequest<T>(
  options: PlacesRequestOptions,
): Promise<T> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new PlacesError("GOOGLE_PLACES_API_KEY not configured", 500, false);
  }

  const url = new URL(`${BASE_URL}${options.path}`);
  for (const [key, value] of Object.entries(options.queryParams ?? {})) {
    url.searchParams.set(key, value);
  }

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": options.fieldMask,
      "Content-Type": "application/json",
    },
  };

  if (options.body && options.method !== "GET") {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url.toString(), init);

  if (response.status === 429) {
    throw new PlacesError("Rate limited by Places API", 429, true);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new PlacesError(
      `Places ${options.path} failed: ${text}`,
      response.status,
      response.status >= 500,
    );
  }

  return (await response.json()) as T;
}

export async function placesRequestWithRetry<T>(
  options: PlacesRequestOptions,
  maxRetries = 2,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await placesRequest<T>(options);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof PlacesError && !err.retryable) throw err;
      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * 2 ** attempt),
        );
      }
    }
  }
  throw lastError ?? new Error("Places request failed after retries");
}
