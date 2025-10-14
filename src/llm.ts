import path from "path";
import { raise } from "./utils/errors";
import { initLog } from "./utils/log";
import { streamGenerator } from "./utils/promise";
import { isNonEmptyObject } from "./utils/typing";

const l = initLog("rag");

const DEFAULT_LLM_ENDPOINT = "http://127.0.0.1:11434/api/";
const LLM_MODEL = "llama3";
const LLM_TEMP = 0;

enum LLMAPEndpoint {
  Generate = "generate",
  Chat = "chat",
  Embed = "embeddings",
}

interface LLMRequestOptions {
  /**
   * The temperature of the model. Increasing the temperature will make the model answer more creatively. (Default: 0.8)
   */
  temperature: number;
}

interface BaseLLMResponse {
  created_at: string;
  done: boolean;
  model: string;
}

// Another

function isBaseLLMResponse(response: unknown): response is BaseLLMResponse {
  if (!isNonEmptyObject(response)) {
    return false;
  }
  return (
    typeof response.created_at === "string" &&
    typeof response.done === "boolean" &&
    typeof response.model === "string"
  );
}

// =====
// GENERATE
// =====

interface LLMGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  context?: number[];
  options?: LLMRequestOptions;
}

interface LLMGenerateResponseOngoing extends BaseLLMResponse {
  response: string;
  done: false;
}

function isLLMGenerateResponseOngoing(
  response: unknown
): response is LLMGenerateResponseOngoing {
  if (!isBaseLLMResponse(response) || !isNonEmptyObject(response)) {
    return false;
  }

  return !response.done && typeof response.response === "string";
}

interface LLMGenerateResponseCompleted extends BaseLLMResponse {
  done: true;
  response: string;
  context: number[];
  eval_count: number;
  eval_duration: number;
  load_duration: number;
  prompt_eval_duration: number;
  total_duration: number;
}

function isLLMGenerateResponseCompleted(
  response: unknown
): response is LLMGenerateResponseCompleted {
  if (!isBaseLLMResponse(response) || !isNonEmptyObject(response)) {
    return false;
  }

  return (
    typeof response.response === "string" &&
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

type LLMGenerateResponse =
  | LLMGenerateResponseOngoing
  | LLMGenerateResponseCompleted;

// =====
// CHAT hello there
// =====

export enum LLMChatRole {
  System = "system",
  User = "user",
  Assistant = "assistant",
}

export interface LLMChatMessage {
  role: LLMChatRole;
  content: string;
}

interface LLMChatRequest {
  model: string;
  messages: LLMChatMessage[];
  stream: boolean;
  format?: "json";
  options?: LLMRequestOptions;
}

interface LLMChatResponse extends BaseLLMResponse {
  message: LLMChatMessage;
  done: true;
}

function isLLMChatResponse(response: unknown): response is LLMChatResponse {
  if (!isBaseLLMResponse(response) || !isNonEmptyObject(response)) {
    return false;
  }

  return (
    isNonEmptyObject(response.message) &&
    typeof response.message.role === "string" &&
    typeof response.message.content === "string"
  );
}

//

interface LLMGenerateParams {
  prompt: string;
  temperature?: number;
  callback: (value: string) => void;
  onDone?: (value: string, context: number[]) => void;
  context?: number[];
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

  // Another 3
  /**
   * Returns the request body as a JSON string.
   *
   * @param request - The LLMRequest object.
   * @returns The request body as a JSON string.
   */
  private getRequestBody(request: LLMGenerateRequest | LLMChatRequest): string {
    return JSON.stringify(request);
  }

  /**
   * Decodes a Uint8Array value into an LLMResponse object.
   *
   * @param value - The Uint8Array value to decode.
   * @returns The decoded LLMResponse object.
   * @throws Error if the response is invalid.
   */
  private decodeStream(value: Uint8Array): LLMGenerateResponse {
    const text = new TextDecoder().decode(value);
    const parsed = JSON.parse(text);

    if (isLLMGenerateResponseOngoing(parsed)) {
      return parsed;
    }

    if (isLLMGenerateResponseCompleted(parsed)) {
      return parsed;
    }

    throw new Error("Invalid response");
  }

  private fetchChat(request: LLMChatRequest): Promise<Response> {
    const url = path.join(DEFAULT_LLM_ENDPOINT, LLMAPEndpoint.Chat);
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: this.getRequestBody(request),
    });
  }

  /**
   * Fetches data from the server by sending a POST request to the LLMAPEndpoint.Generate endpoint.
   *
   * @param request - The LLMGenerateRequest object containing the request data.
   * @returns A Promise that resolves to a Response object representing the server's response.
   */
  private fetchGenerate(request: LLMGenerateRequest): Promise<Response> {
    const url = path.join(DEFAULT_LLM_ENDPOINT, LLMAPEndpoint.Generate);
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: this.getRequestBody(request),
    });
  }

  /**
   * Sends a chat message to the LLM model and returns the response.
   *
   * @param messages - An array of LLMChatMessage objects representing the chat messages.
   * @param options - Optional LLMRequestOptions object for specifying additional options.
   * @throws Error if the response is invalid.
   * @returns A Promise that resolves to an LLMResponse object representing the response from the LLM model.
   */
  chat(
    messages: LLMChatMessage[],
    options?: LLMRequestOptions
  ): Promise<LLMChatResponse> {
    return this.fetchChat({
      model: LLM_MODEL,
      stream: false,
      messages,
      options,
      format: "json",
    })
      .then((response) => response.json())
      .then((json) =>
        isLLMChatResponse(json)
          ? json
          : raise("Invalid response\n" + JSON.stringify(json))
      );
  }

  // four

  /**
   * Generates a stream of responses based on the given prompt using the LLM model.
   *
   * @param prompt - The prompt to generate the stream from.
   * @param callback - A callback function that will be called with each response in the stream.
   * @param onDone - A callback function that will be called when the stream generation is complete.
   * @returns A promise that resolves when the stream generation is complete.
   */
  async generateStream(params: LLMGenerateParams): Promise<void> {
    if (this.generationInProgress) {
      l.log("Generation in progress");
      return;
    }

    this.generationInProgress = true;
    const response = await this.fetchGenerate({
      model: LLM_MODEL,
      prompt: params.prompt,
      stream: true,
      context: params.context,
      options: {
        temperature: params.temperature ?? LLM_TEMP,
      },
    }).then((response) => response.body as ReadableStream<Uint8Array> | null);

    if (!response) {
      return;
    }

    const buffer: string[] = [];

    for await (const value of streamGenerator(response.getReader())) {
      const parsed = this.decodeStream(value);
      buffer.push(parsed.response);
      params.callback(parsed.response);

      if (parsed.done) {
        const completed = buffer.join("");
        params.onDone?.(completed, parsed.context);
        this.generationInProgress = false;
      }
    }
  }
}
