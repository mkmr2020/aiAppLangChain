// uploaddoc.js
// Purpose:
// - Read a local text file (srimba-info.txt)
// - Split it into smaller chunks (documents)
// - Create embeddings for each chunk using Hugging Face Inference
// - Store the embeddings + text into Supabase via SupabaseVectorStore

// Text splitter that turns long text into multiple smaller documents.
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// Node's file API (Promise-based). Used to read the source text file.
import { readFile } from "node:fs/promises";

// dotenv loads variables from a local `.env` file into `process.env`.
import dotenv from "dotenv";

// Supabase client used to connect to your Supabase project.
import { createClient } from "@supabase/supabase-js";

// LangChain vector store implementation for Supabase.
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";

// LangChain embeddings wrapper that calls Hugging Face's hosted inference API
// and exposes the methods the vector store needs (embedDocuments/embedQuery).
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

// Load environment variables from `.env` (if present).
// Expected variables:
// - HF_TOKEN
// - SUPER_PROJECT_URL
// - SUPER_PROJECT_API_KEY
dotenv.config();

// Create an Embeddings object.
// SupabaseVectorStore expects an object with `embedDocuments()` and `embedQuery()`.
const embeddings = new HuggingFaceInferenceEmbeddings({
  // Hugging Face access token (must be defined in your `.env`).
  apiKey: process.env.HF_TOKEN,
  // A commonly-supported embedding model on HF inference.
  model: "sentence-transformers/all-MiniLM-L6-v2",
});

// Debug: shows whether HF_TOKEN is present.
// NOTE: Printing tokens is not safe in real apps; keep it only for learning.
console.log(process.env.HF_TOKEN)
// const output = await clientHF.featureExtraction({
// 	model: "Qwen/Qwen3-Embedding-0.6B",
// 	inputs: "Today is a sunny day and I will get some ice cream.",
// 	provider: "hf-inference",
// });

// console.log(output);


try {
  // 1) Read the raw text from a local file.
  // This path is relative to where you run `node uploaddoc.js`.
  const result = await readFile("infogainDoc_working.txt", "utf-8")

  // 2) Split the text into multiple smaller documents.
  // RecursiveCharacterTextSplitter tries to split on paragraphs/sentences/etc.
  // If you don't pass chunkSize/chunkOverlap, it uses library defaults.
  const splitter = new RecursiveCharacterTextSplitter()

  // `createDocuments` expects an array of strings.
  // It returns an array of Document objects.
  const docs = await splitter.createDocuments([result])

  // 3) Connect to Supabase.
  // SUPER_PROJECT_URL looks like: https://xxxx.supabase.co
  // SUPER_PROJECT_API_KEY is your service role key or anon key.
  const supabase = createClient(process.env.SUPER_PROJECT_URL, process.env.SUPER_PROJECT_API_KEY)

  // 4) Upload documents into Supabase vector store.
  // - It embeds every document using `embeddings`
  // - Then writes rows to the `documents` table.
  await SupabaseVectorStore.fromDocuments(
    docs,
    embeddings,
    { client: supabase, tableName: "infogaindocuments" }
  );
} catch (err) {
  // If anything fails (file read, token missing, Supabase auth, etc.),
  // it will be printed here.
  console.log(err)
}

