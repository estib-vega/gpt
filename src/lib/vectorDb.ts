import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { raise } from "../utils/errors";

const LLM_MODEL = "llama3";
const OLLAMA_BASE_URL = "http://localhost:11434";

export interface VectorStoreEntry<T extends object> {
  text: string;
  metadata: T;
}

function getEmbeddings(): OllamaEmbeddings {
  return new OllamaEmbeddings({
    model: LLM_MODEL,
    baseUrl: OLLAMA_BASE_URL,
    requestOptions:{
      temperature: 0,
    }
  });
}

/**
 * Loads a vector store from the specified database path.
 * If `embeddings` are provided, they will be used to load the vector store.
 * If `embeddings` are not provided, default embeddings will be used.
 * Returns a promise that resolves to the loaded HNSWLib instance, or undefined if loading fails.
 *
 * @param dbPath - The path to the vector database.
 * @param embeddings - Optional embeddings to use for loading the vector store.
 * @returns A promise that resolves to the loaded HNSWLib instance, or undefined if loading fails.
 */
async function loadVectorStore(
  dbPath: string,
  embeddings?: OllamaEmbeddings
): Promise<HNSWLib | undefined> {
  return HNSWLib.load(dbPath, embeddings ?? getEmbeddings()).catch(
    () => undefined
  );
}

/**
 * Retrieves or creates a vector store using the provided entries and database path.
 * @param entries - An array of VectorStoreEntry objects.
 * @param dbPath - Optional path to an existing vector store database.
 * @returns A Promise that resolves to a HNSWLib instance representing the vector store.
 */
export async function getOrCreateVectorStore<T extends object>(
  entries: VectorStoreEntry<T>[],
  dbPath?: string
): Promise<HNSWLib> {
  const embeddings = getEmbeddings();

  if (dbPath) {
    const maybeVectorStore = await loadVectorStore(dbPath, embeddings);

    if (maybeVectorStore) {
      return maybeVectorStore;
    }
  }

  const texts: string[] = [];
  const metadata: T[] = [];

  for (const entry of entries) {
    texts.push(entry.text);
    metadata.push(entry.metadata);
  }

  return HNSWLib.fromTexts(texts, metadata, embeddings);
}

export default class VectorDB {
  private dbPath: string;
  private hnswlib: HNSWLib;

  private static dbMap = new Map<string, VectorDB>();

  private constructor(dbPath: string, hnswlib: HNSWLib) {
    this.dbPath = dbPath;
    this.hnswlib = hnswlib;
  }

  /**
   * Checks if a vector database exists at the specified path.
   * If the database exists, it will be loaded and stored in the internal map.
   *
   * @param dbPath - The path to the vector database.
   * @returns A promise that resolves to a boolean indicating whether the database exists.
   */
  static async exists(dbPath: string): Promise<boolean> {
    if (VectorDB.dbMap.has(dbPath)) {
      return true;
    }

    const hnswlib = await loadVectorStore(dbPath);
    if (hnswlib) {
      VectorDB.dbMap.set(dbPath, new VectorDB(dbPath, hnswlib));
      return true;
    }

    return false;
  }

  /**
   * Retrieves a VectorDB instance based on the provided database path.
   *
   * @param dbPath - The path of the VectorDB.
   * @returns The VectorDB instance.
   * @throws An error if the VectorDB is not found in the specified path.
   */
  static get(dbPath: string): VectorDB {
    return (
      VectorDB.dbMap.get(dbPath) ??
      raise("VectorDB not found in path: " + dbPath)
    );
  }

  /**
   * Retrieves an existing VectorDB instance for the specified database path,
   * or creates a new one if it doesn't exist.
   *
   * @param dbPath - The path to the vector database.
   * @param entries - An array of VectorStoreEntry objects.
   * @returns A Promise that resolves to a VectorDB instance.
   */
  static async getOrCreate<T extends object>(
    dbPath: string,
    entries: VectorStoreEntry<T>[]
  ): Promise<VectorDB> {
    if (VectorDB.dbMap.has(dbPath)) {
      return VectorDB.dbMap.get(dbPath)!;
    }

    const hnswlib = await getOrCreateVectorStore(entries, dbPath);

    const db = new VectorDB(dbPath, hnswlib);
    VectorDB.dbMap.set(dbPath, db);
    return db;
  }

  /**
   * Retrieves the nearest neighbor information for a given text.
   *
   * @template T - The type of the metadata object.
   * @param {string} text - The text to search for nearest neighbors.
   * @param {number} k - The number of nearest neighbors to retrieve.
   * @param {function} [filter] - An optional filter function to apply to the metadata objects.
   * @returns {Promise<DocumentInformation<T>[]>} - A promise that resolves to an array of nearest neighbor metadata objects.
   */
  async getNearestNeighbors<T extends object>(
    text: string,
    k: number,
    filter?: (metadata: T) => boolean
  ): Promise<VectorStoreEntry<T>[]> {

    const doc = await this.hnswlib.similaritySearch(
      text,
      k,
      filter && ((doc) => filter(doc.metadata as T))
    );
    return doc.map((d) => ({
      metadata: d.metadata as T,
      text: d.pageContent,
    }));
  }

  /**
   * Saves the vector database.
   *
   * @returns A promise that resolves when the save operation is complete.
   */
  save(): Promise<void> {
    return this.hnswlib.save(this.dbPath);
  }
}
