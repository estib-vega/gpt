import rag from "./rag";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

function main() {
  return yargs(hideBin(process.argv))
    .command(
      "rag",
      "Execute retrieval augmented generation",
      (yargs) => {
        return yargs
          .option("out-dir", {
            alias: "o",
            type: "string",
            demandOption: true,
            description: "The output directory",
          })
          .option("wiki", {
            alias: "w",
            type: "string",
            demandOption: true,
            description:
              "The URL of the Wikipedia page to be used for the RAG model",
          })
          .option("query", {
            alias: "q",
            type: "string",
            demandOption: true,
            description: "The query to be used for the RAG model",
          })
          .option("topic", {
            alias: "t",
            type: "string",
            description:
              "The topic of the Wikipedia page to be used for the RAG model. If not provided, the title of the Wikipedia page will be used.",
          })
          .option("expand-prompt", {
            type: "boolean",
            description: "Expand the initial prompt into a more specific one",
          })
          .option("verbose", {
            type: "boolean",
            description: "Run with verbose logging",
          });
      },
      (argv) => {
        rag({
          outDir: argv.outDir,
          title: argv.topic,
          url: argv.wiki,
          prompt: argv.query,
          debug: argv.verbose,
          expandPrompt: argv.expandPrompt,
        });
      }
    )
    .demandCommand()
    .parse();
}

main();
