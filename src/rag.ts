import { loadWikiArticle } from "./loaders/wiki";
import extractInformation, { ParagraphInfo } from "./tools/paragraphInfo";
import { splitIntoParragraphs } from "./utils/string";
import VectorDB, { VectorStoreEntry } from "./lib/vectorDb";
import LLMHandler from "./llm";
import { raise } from "./utils/errors";
import expandPrompt from "./tools/expandPrompt";
import getSearchTerms from "./tools/getSearchTerms";

interface ChunkInfo {
  content: string;
  info: ParagraphInfo;
}

async function digestWikiArticle(
  title: string,
  url: string
): Promise<ChunkInfo[]> {
  const minLen = 100;

  const topic = "a Wikipedia Article about " + title;
  const doc = await loadWikiArticle(url);

  const chunks = splitIntoParragraphs(doc[0]?.pageContent);
  const documentInfo: ChunkInfo[] = [];

  let count = 0;
  for (const chunk of chunks) {
    if (chunk.length < minLen) {
      console.log("Skipping chunk\n");
      console.log(`[${++count}/ ${chunks.length}]`);
      continue;
    }

    const now = new Date();
    console.log("Processing chunk:", chunk);
    try {
      const paragraphInfo = await extractInformation(topic, chunk);
      documentInfo.push({
        content: chunk,
        info: paragraphInfo,
      });
      console.log("Summary:", paragraphInfo.summary);
      console.log("Facts:\n", paragraphInfo.facts.join("\n"));
      console.log("\n");
    } catch (error) {
      console.error(error);
    }

    const elapsed = new Date().getTime() - now.getTime();
    console.log("Time elapsed", elapsed, "ms");
    console.log(`[${++count}/ ${chunks.length}]`);
    console.log("\n\n\n ------------------- \n\n\n");
  }

  return documentInfo;
}

enum WikiDocumentEntryType {
  Fact = "fact",
  Chunk = "chunk",
}

interface WikiDocumentEntryMetadata {
  type: WikiDocumentEntryType;
  id: string;
  title: string;
  url: string;
  paragraphInfo: ParagraphInfo;
  contentLength: number;
}

async function getDocDB(
  id: string,
  title: string,
  url: string
): Promise<VectorDB> {
  const dbPath = "/Users/estib/projects/gpt/db/wiki/" + id;
  const dbExists = await VectorDB.exists(dbPath);
  if (dbExists) {
    return VectorDB.get(dbPath);
  }

  const vectorEntries: VectorStoreEntry<WikiDocumentEntryMetadata>[] = [];
  const documentInfo = await digestWikiArticle(title, url);

  for (const chunkInfo of documentInfo) {
    const text = `${chunkInfo.info.summary}: ${chunkInfo.content}`;
    vectorEntries.push({
      text,
      metadata: {
        type: WikiDocumentEntryType.Chunk,
        id,
        title,
        url,
        paragraphInfo: chunkInfo.info,
        contentLength: text.length,
      },
    });

    for (const fact of chunkInfo.info.facts) {
      const text = `${chunkInfo.info.summary}: ${fact}`;
      vectorEntries.push({
        text,
        metadata: {
          type: WikiDocumentEntryType.Fact,
          id,
          title,
          url,
          paragraphInfo: chunkInfo.info,
          contentLength: text.length,
        },
      });
    }
  }

  const db = await VectorDB.getOrCreate(dbPath, vectorEntries);
  db.save();
  return db;
}

async function answer(prompt: string, context: string, topic: string) {
  const llm = LLMHandler.getInstance();
  await llm.generateStream({
    prompt: `You are a reliable informant.
Answer to the following PROMPT using *only* the information from the given CONTECT about the TOPIC.
If the information is not enough, state clearly that the context is insufficient.
It's important that you DON't infer or make up information.
Be concise and to the point.

TOPIC: ${topic}

PROMPT: ${prompt}

CONTEXT: ${context}
`,
    callback: (value) => {
      process.stdout.write(value);
    },
    temperature: 0.05,
  });
}

async function main() {
  console.log("starting...");

  const prompt = process.argv[2] ?? raise("No prompt provided");

  const id = "The_Dark_Knight";
  const title = "The Dark Knight (film)";
  const url = "https://en.wikipedia.org/wiki/The_Dark_Knight";

  const db = await getDocDB(id, title, url);

  const searchTerms = await getSearchTerms(prompt, title);

  const facts = await db.getNearestNeighbors<WikiDocumentEntryMetadata>(
    searchTerms.join(" "),
    10
  );

  const factText = facts.map((f) => f.text).join("\n\n");

  console.log("Prompt:\n", prompt);
  const expandedPrompt = await expandPrompt(prompt, title);
  console.log("Expanded Prompt:\n", expandedPrompt);
  console.log("\n");
  console.log("Facts:\n", factText);
  console.log("\n");
  await answer(expandedPrompt, factText, title);
}

main();