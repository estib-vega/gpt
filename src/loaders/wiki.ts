import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";

/**
 * Loads a Wikipedia article from the specified URL.
 *
 *THIS WILL CONFLICT
 *THIS WILL CONFLICT
 *THIS WILL CONFLICT
 *THIS WILL CONFLICT
 *
 *
 * @param articleUrl - The URL of the Wikipedia article to load.
 * @returns A Promise that resolves to the loaded article content.
 */
export function loadWikiArticle(articleUrl: string) {
  const loader = new CheerioWebBaseLoader(articleUrl, {
    selector: "#content h1, #content h2, #content p",
  });
  return loader.load();
}


