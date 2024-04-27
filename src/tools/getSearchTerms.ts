import { isNonEmptyObject } from "../utils/typing";
import LLMHandler, { LLMChatRole } from "../llm";
import { raise } from "../utils/errors";

interface SearchTermsResponse {
  searchTerms: string[];
}

function isSearchTermsResponse(
  response: unknown
): response is SearchTermsResponse {
  if (!isNonEmptyObject(response)) {
    return false;
  }

  return (
    Array.isArray(response.searchTerms) &&
    response.searchTerms.every((term) => typeof term === "string")
  );
}

const SearchTermsResponseSchema = `{
  type: "object",
  properties: {
    description: "The list of search terms.",
    searchTerms: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["searchTerms"],
}`;

/**
 * Retrieves a list of search terms based on the given prompt and topic.
 * @param prompt - The prompt for which search terms are requested.
 * @param topic - The topic related to the prompt.
 * @returns A promise that resolves to an array of search terms.
 */
export default async function getSearchTerms(
  prompt: string,
  topic: string
): Promise<string[]> {
  const llm = LLMHandler.getInstance();
  const answer = await llm.chat([
    {
      role: LLMChatRole.System,
      content: `You are a helpful expert in semantic search.
Please, provide a list of 3 search terms that could be used to find information about the given PROMT and TOPIC.
Don't focus on a single aspect of the prompt, try to cover a wide range of topics.
Don't include any specific names or places unless they are mentioned.
Use rephrasing and synonyms to cover different aspects of the topic.
Use the following JSON schema in your response:
${SearchTermsResponseSchema}
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
        searchTerms: ["location", "geography", "capital"],
      }),
    },
    {
      role: LLMChatRole.User,
      content: JSON.stringify({
        prompt: "What are the main industries in the city?",
        topic: "Mexico City",
      }),
    },
    {
      role: LLMChatRole.Assistant,
      content: JSON.stringify({
        searchTerms: [
          "economy",
          "business",
          "employment",
        ],
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

  if (!isSearchTermsResponse(response)) {
    raise("Invalid response from the language model: " + rawResponse);
  }

  return response.searchTerms;
}
