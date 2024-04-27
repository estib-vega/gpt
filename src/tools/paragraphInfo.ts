import LLMHandler, { LLMChatRole } from "../llm";
import { raise } from "../utils/errors";
import { isNonEmptyObject } from "../utils/typing";

export interface ParagraphInfo {
  summary: string;
  facts: string[];
}

/**
 * Checks if the provided value is an instance of `ParagraphInfo`.
 * @param value - The value to be checked.
 * @returns `true` if the value is an instance of `ParagraphInfo`, `false` otherwise.
 */
function isParagraphInfo(value: unknown): value is ParagraphInfo {
  if (!isNonEmptyObject(value)) return false;

  return (
    typeof value.summary === "string" &&
    Array.isArray(value.facts) &&
    value.facts.every((f) => typeof f === "string")
  );
}

const ParagraphInfoSchema = `{
  type: "object",
  description: "Information extracted from a paragraph",
  properties: {
    summary: {
      type: "string",
      description: "A short summary of the paragraph in relation to the topic",
    },
    facts: {
      type: "array",
      description:
        "A list of all the facts extracted from the paragraph.",
      items: { type: "string" },
    },
  },
  required: ["summary", "facts"],
}`;

/**
 * Extracts information from a paragraph and generates a summary.
 * @param topic - The topic of the paragraph.
 * @param paragraph - The paragraph to extract information from.
 * @returns A Promise that resolves to a ParagraphInfo object containing the summary and important facts.
 */
export default async function extractInformation(
  topic: string,
  paragraph: string
): Promise<ParagraphInfo> {
  const llm = LLMHandler.getInstance();
  const answer = await llm.chat([
    {
      role: LLMChatRole.System,
      content: `You are an expert fact extractor and summarizer.
This is a paragraph from ${topic}.
Given the following information, give a short and concise summary of what the paragraph is about and list the most important facts about the event.
Use ONLY the information provided in the following paragraphs to generate the summary.
Be thorough and concise.
Return the information in the following JSON schema:
${ParagraphInfoSchema}
`,
    },
    {
      role: LLMChatRole.User,
      content:
        "Mexico City is the capital and largest city of Mexico. It is located in the Valley of Mexico, a large valley in the high plateaus in the center of Mexico, at an altitude of 2,240 meters (7,350 ft). The city has 16 subdivisions, formerly known as boroughs.",
    },
    {
      role: LLMChatRole.Assistant,
      content: JSON.stringify({
        summary: "Location of Mexico City and relation to Mexico",
        facts: [
          "Mexico City is the capital and largest city of Mexico",
          "Mexico City is located in the Valley of Mexico",
          "Mexico City has 16 subdivisions",
          "Mexico City's subdivisions were formerly known as boroughs",
          "Mexico City is located at an altitude of 2,240 meters or 7,350 feet",
        ],
      }),
    },
    {
      role: LLMChatRole.User,
      content: paragraph,
    },
  ]);

  const rawInfo = answer.message.content;
  const info = JSON.parse(rawInfo);

  if (!isParagraphInfo(info)) {
    raise("Invalid response: " + rawInfo);
  }

  return info;
}
