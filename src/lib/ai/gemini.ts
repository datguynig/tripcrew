import { GoogleGenAI } from "@google/genai";

export interface GeminiResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  model: string;
}

export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";

export function getGeminiModelName(): string {
  return process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
}

const COST_PER_M_INPUT_GBP = 0.06;
const COST_PER_M_OUTPUT_GBP = 0.24;

export function estimateGeminiCostGBP(
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens / 1_000_000) * COST_PER_M_INPUT_GBP +
    (outputTokens / 1_000_000) * COST_PER_M_OUTPUT_GBP
  );
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  return new GoogleGenAI({ apiKey });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Gemini returned non-JSON response: ${text.slice(0, 200)}`);
    }
    return JSON.parse(match[0]);
  }
}

export async function generateJson<T>(
  prompt: string,
  validator: (raw: unknown) => T,
): Promise<GeminiResult<T>> {
  const start = Date.now();
  const model = getGeminiModelName();
  const client = getClient();

  const result = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      temperature: 0.7,
    },
  });

  const text = result.text ?? "";
  const data = validator(parseJson(text));
  const usage = result.usageMetadata;

  return {
    data,
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
    durationMs: Date.now() - start,
    model,
  };
}
