import { isNonEmptyObject } from "../utils/typing";
import LLMHandler, { LLMChatRole } from "../llm";
import { raise } from "../utils/errors";

interface RateRelevanceResponse {
  relevance: number;
}

function isRateRelevanceResponse(
  response: unknown
): response is RateRelevanceResponse {
  if (!isNonEmptyObject(response)) {
    return false;
  }

  return typeof response.relevance === "number";
}

const RateRelevanceResponseSchema = `{
  type: "object",
  properties: {
    description: "The relevance of the text to the prompt.",
    relevance: { type: "number" },
  },
  required: ["relevance"],
}`;

/**
 * Rates the relevance of a given text to a provided prompt about a specific topic.
 *
 * @param prompt - The prompt for the text.
 * @param topic - The topic of the text.
 * @param text - The text to be rated for relevance.
 * @returns A promise that resolves to a number representing the relevance rating.
 */
export default async function rateRelevance(
  prompt: string,
  topic: string,
  text: string
): Promise<number> {
  const llm = LLMHandler.getInstance();
  const answer = await llm.chat([
    {
      role: LLMChatRole.System,
      content: `You are a helpful assistant that is able to intuitively understand the intention of prompts.
Please, rate the relevance (from 0 to 100) of the given TEXT to the provided PROMPT about the TOPIC.
Use the following JSON schema in your response:
${RateRelevanceResponseSchema}
`,
    },
    {
      role: LLMChatRole.User,
      content: JSON.stringify({
        prompt: "Tell me something about the location of the city",
        topic: "Mexico City",
        text: "Mexico City is the capital and largest city of Mexico.",
      }),
    },
    {
      role: LLMChatRole.Assistant,
      content: JSON.stringify({
        relevance: 50,
      }),
    },
    {
      role: LLMChatRole.User,
      content: JSON.stringify({
        prompt: "When was the Berlin Wall built?",
        topic: "History of Germany",
        text: "My favourite color is blue.",
      }),
    },
    {
      role: LLMChatRole.Assistant,
      content: JSON.stringify({
        relevance: 0,
      }),
    },
    {
      role: LLMChatRole.User,
      content: JSON.stringify({
        prompt: "What is the capital of France?",
        topic: "France",
        text: "Paris is the capital of France.",
      }),
    },
    {
      role: LLMChatRole.Assistant,
      content: JSON.stringify({
        relevance: 100,
      }),
    },
    {
      role: LLMChatRole.User,
      content: JSON.stringify({
        prompt,
        topic,
        text,
      }),
    },
  ]);

  const rawResponse = answer.message.content;
  const response = JSON.parse(rawResponse);
  if (!isRateRelevanceResponse(response)) {
    raise("Invalid response format: " + rawResponse);
  }

  return response.relevance;
}
