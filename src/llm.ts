import { streamGenerator } from "./utils/promise";
import { isNonEmptyObject } from "./utils/typing";

const LLM_ENDPOINT = "http://localhost:11434/api/generate";
const LLM_MODEL = "llama2:13b";
const LLM_TEMP = 0.15;

interface BaseLLMResponse {
  created_at: string;
  done: boolean;
  model: string;
  response: string;
}

function isBaseLLMResponse(response: unknown): response is LLMResponseOngoing {
  if (!isNonEmptyObject(response)) {
    return false;
  }
  return (
    typeof response.created_at === "string" &&
    typeof response.done === "boolean" &&
    typeof response.model === "string" &&
    typeof response.response === "string"
  );
}

interface LLMResponseOngoing extends BaseLLMResponse {
  done: false;
}

function isLLMResponseOngoing(
  response: unknown
): response is LLMResponseOngoing {
  return isBaseLLMResponse(response) && !response.done;
}

interface LLMResponseCompleted extends BaseLLMResponse {
  done: true;
  context: number[];
  eval_count: number;
  eval_duration: number;
  load_duration: number;
  prompt_eval_duration: number;
  total_duration: number;
}

function isLLMResponseCompleted(
  response: unknown
): response is LLMResponseCompleted {
  if (!isBaseLLMResponse(response) || !isNonEmptyObject(response)) {
    return false;
  }

  return (
    typeof response.eval_count === "number" &&
    typeof response.eval_duration === "number" &&
    typeof response.load_duration === "number" &&
    typeof response.prompt_eval_duration === "number" &&
    typeof response.total_duration === "number" &&
    Array.isArray(response.context) &&
    response.context.every((value) => typeof value === "number") &&
    response.done
  );
}

type LLMResponse = LLMResponseOngoing | LLMResponseCompleted;

interface LLMRequestOptions {
  /**
   * The temperature of the model. Increasing the temperature will make the model answer more creatively. (Default: 0.8)
   */
  temperature: number;
}

interface LLMRequest {
  model: string;
  prompt: string;
  stream: boolean;
  context?: number[];
  options?: LLMRequestOptions;
}

export default class LLMHandler {
  private static instance: LLMHandler;
  private generationInProgress: boolean;

  private constructor() {
    this.generationInProgress = false;
  }

  public static getInstance(): LLMHandler {
    if (!LLMHandler.instance) {
      LLMHandler.instance = new LLMHandler();
    }

    return LLMHandler.instance;
  }

  /**
   * Returns the request body as a JSON string.
   *
   * @param request - The LLMRequest object.
   * @returns The request body as a JSON string.
   */
  private getRequestBody(request: LLMRequest): string {
    return JSON.stringify(request);
  }

  /**
   * Decodes a Uint8Array value into an LLMResponse object.
   *
   * @param value - The Uint8Array value to decode.
   * @returns The decoded LLMResponse object.
   * @throws Error if the response is invalid.
   */
  private decodeStream(value: Uint8Array): LLMResponse {
    const text = new TextDecoder().decode(value);
    const parsed = JSON.parse(text);

    if (isLLMResponseOngoing(parsed)) {
      return parsed;
    }

    if (isLLMResponseCompleted(parsed)) {
      return parsed;
    }

    throw new Error("Invalid response");
  }

  /**
   * Generates a stream of responses based on the given prompt using the LLM model.
   *
   * @param prompt - The prompt to generate the stream from.
   * @param callback - A callback function that will be called with each response in the stream.
   * @param onDone - A callback function that will be called when the stream generation is complete.
   * @returns A promise that resolves when the stream generation is complete.
   */
  async generateStream(
    prompt: string,
    callback: (value: string) => void,
    onDone?: (value: string, context: number[]) => void,
    context?: number[]
  ): Promise<void> {
    if (this.generationInProgress) {
      console.log("Generation in progress");
      return;
    }

    this.generationInProgress = true;
    const response = await fetch(LLM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: this.getRequestBody({
        model: LLM_MODEL,
        prompt,
        stream: true,
        context,
        options: {
          temperature: LLM_TEMP,
        },
      }),
    }).then((response) => response.body);

    if (!response) {
      return;
    }

    const buffer: string[] = [];

    for await (const value of streamGenerator(response.getReader())) {
      const parsed = this.decodeStream(value);
      buffer.push(parsed.response);
      callback(parsed.response);

      if (parsed.done) {
        const completed = buffer.join("");
        onDone?.(completed, parsed.context);
        this.generationInProgress = false;
      }
    }
  }
}
