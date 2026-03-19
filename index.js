// index.js
// Purpose:
// - Build a prompt template
// - Send it to an OpenAI chat model via LangChain
// - Print the generated tweet

// Quick startup log.
console.log("LangChainApp ready.");

// Load environment variables from `.env` into `process.env`.
// Expected variable:
// - OPENAI_API_KEY
import "dotenv/config";

// LangChain wrapper for OpenAI chat models.
import { ChatOpenAI } from "@langchain/openai";

// PromptTemplate is a small helper for templating prompts (variables like {productDesc}).
import { PromptTemplate } from "@langchain/core/prompts";

// Read the OpenAI API key from environment variables.
// If it's missing, OpenAI client will throw an error.
const openAIApiKey = process.env.OPENAI_API_KEY

// Create the model instance.
// `model` chooses which OpenAI model to use.
const llm = new ChatOpenAI({ openAIApiKey, model: "gpt-5-nano" })

// This is the prompt text with placeholders.
// PromptTemplate will replace {productDesc} and {price} with real values.
const tweetTemplate = 'Generate a promotional tweet for a product, from this product description: {productDesc} {price}'

// Convert the string template into a PromptTemplate object.
const tweetPrompt = PromptTemplate.fromTemplate(tweetTemplate)

// Create a simple chain: PromptTemplate -> LLM.
// `pipe` means: output of tweetPrompt becomes input to llm.
const tweetChain = tweetPrompt.pipe(llm)

// Invoke the chain by providing values for the placeholders.
// This triggers a real API call to OpenAI.
const res = await tweetChain.invoke({ productDesc: "pool table", price: "$500" })  

// Print just the model's text response.
console.log(res.content)