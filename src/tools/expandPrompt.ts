import { isNonEmptyObject } from "../utils/typing";
import LLMHandler, { LLMChatRole } from "../llm";
import { raise } from "../utils/errors";

interface ExpandedPromptResponse {
  prompt: string;
}

function isExpandedPromptResponse(
  response: unknown
): response is ExpandedPromptResponse {
  if (!isNonEmptyObject(response)) {
    return false;
  }

  return typeof response.prompt === "string";
}

const ExpandedPromptResponseSchema = `{
  type: "object",
  properties: {
    description: "The expanded prompt.",
    prompt: { type: "string" },
  },
  required: ["prompt"],
}`;

/**
 * Expands a prompt using the provided topic.
 *
 * @param prompt - The prompt to be expanded.
 * @param topic - The topic to be used for expanding the prompt.
 * @returns A Promise that resolves to the expanded prompt.
 */
export default async function expandPrompt(
  prompt: string,
  topic: string
): Promise<string> {
  const llm = LLMHandler.getInstance();
  const answer = await llm.chat([
    {
      role: LLMChatRole.System,
      content: `You are a helpful assistant that is able to intuitively understand the intention of prompts.
Please, expand the following PROMPT using the provided TOPIC as if you were writing the prompt.
Don't change the meaning of the prompt, just add more information to it.
Be detailed but concise.
Don't change or add any new information like names or places.
Use the following JSON schema in your response:
${ExpandedPromptResponseSchema}
`,
    },
    {
      role: LLMChatRole.User,
      content: JSON.stringify({
        prompt: "Tell me something about the location of the city",
        topic: "Mexico City",
      }),
    },
    {
      role: LLMChatRole.Assistant,
      content: JSON.stringify({
        prompt: `Please, tell me more information about the location of Mexico City.
Give me some details about the geographical location in the conxtex of the country.
Be concise and to the point.
DON'T make up or infer information.
DON'T change information like names, locations or values.`,
      }),
    },
    {
      role: LLMChatRole.User,
      content: JSON.stringify({
        prompt,
        topic,
      }),
    },
  ]);

  const rawResponse = answer.message.content;
  const response = JSON.parse(rawResponse);
  if (!isExpandedPromptResponse(response)) {
    raise("Invalid response from LLM: " + rawResponse);
  }

  return response.prompt;
}
