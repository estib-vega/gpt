import { loadWikiArticle } from "./loaders/wiki";
import extractInformation from "./tools/paragraphInfo";
import type { ParagraphInfo } from "./tools/paragraphInfo";
import { splitIntoParragraphs } from "./utils/string";
import VectorDB from "./lib/vectorDb";
import type { VectorStoreEntry } from "./lib/vectorDb";
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
  const numberOfHits = 25;
  const hits = await db.getNearestNeighbors<WikiDocumentEntryMetadata>(
    prompt,
    numberOfHits
  );

  return hits.map((hit) => hit.text).join("\n");
}

async function answer(prompt: string, context: string) {
  const llm = LLMHandler.getInstance();
  await llm.generateStream({
    prompt: `You are a reliable informant.
Answer to the following PROMPT using ONLY the information from the given CONTEXT.
It's important that you DON't infer or make up information.
Be concise and to the point.

PROMPT:
${prompt}

CONTEXT:
${context}
`,
    callback: (value) => {
      process.stdout.write(value);
    },
    temperature: 0.05,
  });
}

function getIDfromURL(url: string): string {
  const parts = url.split("/");
  return parts[parts.length - 1] ?? raise("Invalid URL: " + url);
}

function getTitlefromURL(url: string): string {
  const id = getIDfromURL(url);
  return id.replace(/_/g, " ");
}

/**
 * Represents the parameters for Retrieval Augmented Generation.
 */
export interface RAGParams {
  /**
   * The prompt.
   */
  prompt: string;
  /**
   * The title of the topic.
   */
  title?: string;
  /**
   * The Wiki URL associated the topic.
   */
  url: string;
  /**
   * Debug
   * @default false
   */
  debug?: boolean;
  /**
   * Expand the initial prompt.
   * @default false
   */
  expandPrompt?: boolean;
}

export default async function rag(params: RAGParams) {
  if (params.debug) {
    l.silent = false;
  }

  l.log("Starting...");
  const now = new Date();

  let prompt = params.prompt;
  l.log("Prompt:", prompt);

  const url = params.url;
  const id = getIDfromURL(url);
  const title = params.title ?? getTitlefromURL(url);

  const db = await getDocDB(id, title, url);
  l.log("DB loaded");
  if (params.expandPrompt) {
    l.log("Expanding prompt...");
    prompt = await expandPrompt(prompt, title);
    l.log("Prompt expanded:", prompt);
  }

  const context = await getContext(prompt, db);
  l.log("\n");
  l.log("Context:\n", context);
  l.log("\n");
  await answer(prompt, context);
  l.log("Done", new Date().getTime() - now.getTime(), "ms");
}
