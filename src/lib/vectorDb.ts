import path from "path";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { raise } from "../utils/errors";

const DB_DIR = "db";
const DB_WIKI_DIR = "wiki";
const LLM_MODEL = "nomic-embed-text";
const OLLAMA_BASE_URL = "http://127.0.0.1:11434";

export interface VectorStoreEntry<T extends object> {
  text: string;
  metadata: T;
}

function getEmbeddings(): OllamaEmbeddings {
  return new OllamaEmbeddings({
    model: LLM_MODEL,
    baseUrl: OLLAMA_BASE_URL,
  });
}

/**
 * Carga un almacén vectorial desde la ruta de base de datos especificada.
 * Si se proporcionan `embeddings`, se utilizarán para cargar el almacén vectorial.
 * Si no se proporcionan `embeddings`, se utilizarán embeddings por defecto.
 * Devuelve una promesa que se resuelve a la instancia HNSWLib cargada, o undefined si la carga no tuvo éxito.
 *
 * @param dbPath - La ruta a la base de datos vectorial.
 * @param embeddings - Embeddings opcionales para usar al cargar el almacén vectorial.
 * @returns Una promesa que se resuelve a la instancia HNSWLib cargada, o undefined si la carga falla.
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
 * Recupera o crea un almacén vectorial utilizando las entradas y ruta de base de datos proporcionadas.
 * @param entries - Un arreglo de objetos VectorStoreEntry.
 * @param dbPath - Ruta opcional a una base de datos de almacén vectorial existente.
 * @returns Una promesa que se resuelve a una instancia HNSWLib que representa el almacén vectorial.
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
   * Devuelve la ruta al directorio wiki para un ID dado.
   *
   * @param outDir - El directorio de salida.
   * @param id - El ID del wiki.
   * @returns La ruta al directorio wiki.
   */
  static getWikiPath(outDir: string, id: string): string {
    const o = path.join(outDir, DB_DIR, DB_WIKI_DIR, id);
    return path.resolve(process.cwd(), o);
  }

  /**
   * Verifica si existe una base de datos vectorial en la ruta especificada.
   * Si la base de datos existe, se cargará y almacenará en el mapa interno.
   *
   * @param dbPath - La ruta a la base de datos vectorial.
   * @returns Una promesa que se resuelve a un booleano indicando si la base de datos existe.
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
   * Recupera una instancia de VectorDB basada en la ruta de base de datos proporcionada.
   *
   * @param dbPath - La ruta del VectorDB.
   * @returns La instancia de VectorDB.
   * @throws Un error si el VectorDB no se encuentra en la ruta especificada.
   */
  static get(dbPath: string): VectorDB {
    return (
      VectorDB.dbMap.get(dbPath) ??
      raise("VectorDB not found in path: " + dbPath)
    );
  }

  /**
   * Recupera una instancia existente de VectorDB para la ruta de base de datos especificada,
   * o crea una nueva si no existe.
   *
   * @param dbPath - La ruta a la base de datos vectorial.
   * @param entries - Un arreglo de objetos VectorStoreEntry.
   * @returns Una promesa que se resuelve a una instancia de VectorDB.
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
   * Recupera la información del vecino más cercano para un texto dado.
   *
   * @template T - El tipo del objeto de metadatos.
   * @param {string} text - El texto para buscar vecinos más cercanos.
   * @param {number} k - El número de vecinos más cercanos a recuperar.
   * @param {function} [filter] - Una función de filtro opcional para aplicar a los objetos de metadatos.
   * @returns {Promise<DocumentInformation<T>[]>} - Una promesa que se resuelve a un arreglo de objetos de metadatos de vecinos más cercanos.
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
   * Guarda la base de datos vectorial.
   *
   * @returns Una promesa que se resuelve cuando la operación de guardado está completa.
   */
  save(): Promise<void> {
    return this.hnswlib.save(this.dbPath);
  }
}
