# gpt

This repository contains the code for the GPT project.
ubiubiubiub
jndoueno
Add line 1
Add line 2
Add line 3
Add line 4

## Description

This is an implementation of RAG using Ollama + Langchain and some custom heuristics implemented in Typescript.
It's a CLI app that is built into a platform-specific binaries that can be run alongside Ollama independently.

## Features

- Wiki Article RAG: Point the application to a Wikipedia article and this will download it, digest it and store it in a Vector DB.

## Prerequisites

- **Bun** \
This project uses [Bun v1.1.7](https://bun.sh/blog/bun-v1.1.7) as the TS runtime
- **Ollama** \
It connects to Ollama to access the LLMs. Ollama needs to be running in the background (http://127.0.0.1:11434) and have the following models installed:
  - llama3 (8B)
  - nomic-embed-text

## Installation

To use the GPT, follow these steps:

### 1. Install the required dependencies:

```bash
bun install
```

### 2. Build the binary:

macOS
```bash
bun build:mac
```

Linux
```bash
bun build:lin
```

Windows
```bash
bun build:win
```

### 3. Run it

macOS
```bash
./dist/mac/gpt
```

Linux
```bash
./dist/lin/gpt
```

macOS
```bash
./dist/win/gpt.exe
```

## Commands

### RAG

```bash
gpt rag -w <the Wikipedia article link> -q <the prompt to be answered about the article> -o <the output location of the vector database>
```

This will download and parse the article, which depending on the length might take up to 40 minutes.
This will then be stored under the provided output location.
If there is a matching vector database under the provided output location for the given Wikipedia article, that will be used directly.

In order to be able to view into the parsing and digestion process of the article, you can add the `--verbose` flag.

You can get some more information about the command by executing:

```bash
gpt rag --help
```

## Contributing

Contributions are welcome! If you have any ideas, suggestions, or bug reports, please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
