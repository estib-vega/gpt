import { loadWikiArticle } from "./loaders/wiki";
import extractInformation, { ParagraphInfo } from "./tools/paragraphInfo";
import { splitIntoParragraphs } from "./utils/string";
import VectorDB, { VectorStoreEntry } from "./lib/vectorDb";
import LLMHandler from "./llm";
import { raise } from "./utils/errors";
import expandPrompt from "./tools/expandPrompt";
import { initLog } from "./utils/log";

const l = initLog("rag");

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
      l.log("Skipping chunk\n");
      l.log(`[${++count}/ ${chunks.length}]`);
      continue;
    }

    const now = new Date();
    l.log("Processing chunk:", chunk);
    try {
      const paragraphInfo = await extractInformation(topic, chunk);
      documentInfo.push({
        content: chunk,
        info: paragraphInfo,
      });
      l.log("Summary:", paragraphInfo.summary);
      l.log("Facts:\n", paragraphInfo.facts.join("\n"));
      l.log("\n");
    } catch (error) {
      l.err(error);
    }

    const elapsed = new Date().getTime() - now.getTime();
    l.log("Time elapsed", elapsed, "ms");
    l.log(`[${++count}/ ${chunks.length}]`);
    l.log("\n\n\n ------------------- \n\n\n");
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

async function getContext(prompt: string, db: VectorDB): Promise<string> {
  l.log("Searching for context...");
  const numberOfHits = 10;
  const hits = await db.getNearestNeighbors<WikiDocumentEntryMetadata>(
    prompt,
    numberOfHits
  );

  return hits.map((hit) => hit.text).join("\n");
}

async function answer(prompt: string, context: string, topic: string) {
  const llm = LLMHandler.getInstance();
  await llm.generateStream({
    prompt: `You are a reliable informant.
Answer to the following PROMPT using *only* the information from the given CONTECT about the TOPIC.
ONLY if the information is not enough, state clearly that the context is insufficient.
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

export default async function rag() {
  l.log("Starting...");
  const now = new Date();

  const prompt = process.argv[2] ?? raise("No prompt provided");

  const id = "The_Dark_Knight";
  const title = "The Dark Knight (film)";
  const url = "https://en.wikipedia.org/wiki/The_Dark_Knight";

  const db = await getDocDB(id, title, url);
  l.log("DB loaded");
  const expandedPrompt = await expandPrompt(prompt, title);
  l.log("Prompt expanded:", expandedPrompt);

  const context = await getContext(expandedPrompt, db);
  l.log("\n");
  l.log("Context:\n", context);
  l.log("\n");
  await answer(expandedPrompt, context, title);
  l.log("Done", new Date().getTime() - now.getTime(), "ms");
}
