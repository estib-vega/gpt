import fs from "fs";

function raise(message: string): never {
  throw new Error(message);
}

function readInput(): string {
  return fs.readFileSync("input.txt", "utf8");
}

/**
 * Return the unique characters in the text.
 *
 * Might want to consider removing newlines and spaces, but for now it's ok.
 */
function getVocab(text: string): string {
  return [...new Set(text)].sort().join("");
}

interface EncodingMaps {
  s2i: Map<string, number>;
  i2s: Map<number, string>;
}

/**
 * Initialize the maps for encoding and decoding.
 *
 * @param vocab The vocabulary of characters to use.
 */
function initializeMaps(vocab: string): EncodingMaps {
  const s2i = new Map<string, number>();
  const i2s = new Map<number, string>();

  for (let i = 0; i < vocab.length; i++) {
    s2i.set(vocab.charAt(i), i);
    i2s.set(i, vocab.charAt(i));
  }

  return { s2i, i2s };
}

function getEncoder(s2i: Map<string, number>): (s: string) => number[] {
  return (s: string) => s.split("").map((c) => s2i.get(c) ?? raise("Invalid character: " + c));
}

function getDecodeer(i2s: Map<number, string>): (i: number[]) => string {
  return (i: number[]) => i.map((c) => i2s.get(c) ?? raise("Invalid index: " + c)).join("");
}

interface InputSplits {
  training: number[];
  validation: number[];
}

function getInputSplits(data: number[]): InputSplits {
  const splitIndex = Math.floor(data.length * 0.9);
  return {
    training: data.slice(0, splitIndex),
    validation: data.slice(splitIndex),
  };
}

function getRandomInts(min: number, max: number, n: number = 1): number[] {
  const result = [];
  if (max < min) raise("Max must be greater than min");

  const delta = max - min;
  for (let i = 0; i < n; i++) {
    result.push(Math.floor(Math.random() * delta + min));
  }
  return result;
}

interface Batch {
  x: number[][];
  y: number[][];
}

function getBatch(data: number[], batchSize: number, blockSize: number): Batch {
  const result = [];
  const ix = getRandomInts(0, data.length - blockSize, batchSize);
  const x = ix.map((i) => data.slice(i, i + blockSize));
  const y = ix.map((i) => data.slice(i + 1, i + blockSize + 1));
  return { x, y };
}

const BLOCK_SIZE = 8;
const BATCH_SIZE = 4;

function main() {
  console.log("Starting...");
  const input = readInput();
  // console.log("Input: ", input.slice(0, 1000) + "...");
  const vocab = getVocab(input);
  console.log("Vocab: ", vocab);
  console.log("Vocab size: ", vocab.length);

  const { s2i, i2s } = initializeMaps(vocab);
  const encode = getEncoder(s2i);
  const decode = getDecodeer(i2s);

  // const example = encode("Hello there");
  // const decodedExample = decode(example);
  // console.log(example)
  // console.log(decodedExample)
  const data = encode(input);
  const { training, validation } = getInputSplits(data);

  // example of encoding a block
  // const x = training.slice(0, BLOCK_SIZE);
  // const y = training.slice(1, BLOCK_SIZE + 1);
  // for (let i = 0; i < BLOCK_SIZE; i++) {
  //   const context = x.slice(0, i+1);
  //   const target = y[i];
  //   console.log(`when input is ${context} the target: ${target}`);
  // }

  const trainingBatch = getBatch(training, BATCH_SIZE, BLOCK_SIZE);
  console.log("Training batch: ", trainingBatch);
}



main();
