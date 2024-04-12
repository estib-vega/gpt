import readline from "readline";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import LLMHandler from "./llm";
import { load } from "langchain/load";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

const DB_PATH = "/Users/estib/projects/gpt/db";
const WIKI_ARTICLE = "https://en.wikipedia.org/wiki/2024_Hualien_earthquake";

async function getVectorStore(
  texts: string[],
  metadata: object
): Promise<HNSWLib> {
  const embeddings = new OllamaEmbeddings({
    model: "llama2", // default value
    baseUrl: "http://localhost:11434", // default value
  });

  // const maybeVectorStore = await HNSWLib.load(DB_PATH, embeddings).catch((err) => {
  //   console.error("Error loading vector store", err);
  //   return undefined;
  // });

  // if (maybeVectorStore) {
  //   console.log("Loaded vector store from disk");
  //   return maybeVectorStore;
  // }

  console.log("Loading vector store...");
  return HNSWLib.fromTexts(texts, metadata, embeddings);
}

function loadWikiArticle() {
  const loader = new CheerioWebBaseLoader(WIKI_ARTICLE, {
    selector: "#content h1, #content h2, #content p",
  });
  return loader.load();
}

function splitIntoParragraphs(text: string | undefined): string[] {
  if (!text) return [];
  return text.split("\n");
}

async function digestWikiArticle() {
  const doc = await loadWikiArticle();
  console.log("Content length", doc[0]?.pageContent.length);
  const chunkSize = 1000;
  const overlap = 100;
  console.log(
    `Splitting in chunks of size ${chunkSize} with overlap ${overlap}...`
  );
  const chunks = splitIntoParragraphs(doc[0]?.pageContent);
  const llm = LLMHandler.getInstance();

  let context: number[] | undefined = undefined;

  for (const chunk of chunks) {
    console.log("Chunk:\n", chunk);
    console.log("Chunk length", chunk.length);
    if (chunk.length < 100) {
      console.log("Skipping chunk");
      continue;
    }

    await llm.generateStream(
      `This is a Wikipedia Article about the 2024 Hualien earthquake.
Please propose a title for the following section and extract all key information.:
${chunk}`,
      (c) => process.stdout.write(c),
      (_, ctx) => (context = ctx),
      context
    );
    console.log("\n\n\n ------------------- \n\n\n");
  }
  // return getVectorStore(chunks, doc[0]?.metadata ?? {});
}

async function main() {
  console.log("starting...");
  const vectorStore = await digestWikiArticle();
}

main();
