// indexchai.js
// Purpose:
// - Create embeddings (Hugging Face Inference)
// - Query a Supabase vector store (RAG retrieval)
// - Use an OpenAI chat model to answer using retrieved context

// Loads environment variables from `.env` into `process.env`.
// Expected env vars:
// - OPENAI_API_KEY
// - HF_TOKEN
// - SUPER_PROJECT_URL
// - SUPER_PROJECT_API_KEY
import "dotenv/config";

// OpenAI chat model wrapper for LangChain.
import { ChatOpenAI } from "@langchain/openai";

// Prompt templating utility (lets you write prompts with {variables}).
import { PromptTemplate } from "@langchain/core/prompts";

// Supabase JS client.
import { createClient } from "@supabase/supabase-js";

// Supabase vector store integration (read/write embeddings + text).
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";

// Embeddings implementation backed by Hugging Face hosted inference.
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

// Converts LLM outputs (AIMessage) into a plain string.
import { StringOutputParser } from "@langchain/core/output_parsers";

// RunnableSequence composes steps; RunnablePassthrough forwards inputs unchanged.
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";

// Used to detect whether this file is being run directly (node indexchai.js)
// or imported by another module (like webserver.js).
import { pathToFileURL } from "node:url";

// NOTE: This import isn't used in this file. Keeping it as-is.
import { context } from "langchain";

// Stores conversation history in memory.
// Beginner note: this resets when you restart Node.
const chat_history = []

export class ScrimbaKnowledgeBank {
    constructor() {
        // API key for OpenAI (read from environment).
        const openAIApiKey = process.env.OPENAI_API_KEY

        // Chat model used to generate the final answer.
        // `gpt-5-nano` is a small/fast model.
        const llm = new ChatOpenAI({ openAIApiKey, model: "gpt-5-nano" })

        // Embeddings object used by the vector store.
        // This must expose embedDocuments() / embedQuery().
        const embeddings = new HuggingFaceInferenceEmbeddings({
            apiKey: process.env.HF_TOKEN,
            model: "sentence-transformers/all-MiniLM-L6-v2",
        });

        // Supabase client for your project.
        const supabase = createClient(process.env.SUPER_PROJECT_URL, process.env.SUPER_PROJECT_API_KEY)

        // Vector store points at an existing Supabase table + RPC function.
        // - tableName: where documents + embeddings are stored
        // - queryName: SQL function used to perform similarity search
        const vectorStore = new SupabaseVectorStore(embeddings, {
            client: supabase,
            tableName: 'infogaindocuments',
            queryName: 'match_infogain_documents'
        })

        // Turn the vector store into a retriever (given a query string -> returns Documents[]).
        const retriver = vectorStore.asRetriever()

        // Prompt used to rewrite the user's question into a standalone question.
        const questionPrompt = "Given a question, convert it to a standalone question. question: {question} {name} standalone question:"

        // Prompt used to generate the final answer using retrieved context.
        const answerPrompt = `Greet user with name,You are a helpful and enthusiastic support bot who can answer a given question about Infogain based on the context provided. Try to find the answer in the context. If you really don't know the answer, say "I'm sorry, I don't know the answer to that." And direct the questioner to email help@infogain.com. Don't try to make up an answer. Always speak as if you were chatting to a friend.
        You can use previous chat history to answer questions {chat_history}. 
context: {context}
question: {question}
answer:
`

        // Compile string prompts into PromptTemplate objects.
        const questionPromptTemplate = PromptTemplate.fromTemplate(questionPrompt)

        // Pre-pipe the answer prompt into the model.
        // After this, `answerPromptTemplate` is a runnable.
        const answerPromptTemplate = PromptTemplate.fromTemplate(answerPrompt).pipe(llm)

        // Build the question-rewrite chain:
        // questionPromptTemplate -> llm -> StringOutputParser (so retriever receives a string)
        const questionPipeline = RunnableSequence.from([questionPromptTemplate, llm, new StringOutputParser()])

        // Helper: convert Documents[] into a single string that can be injected into the answer prompt.
        function combineDocuments(docs) {
            return docs.map((doc) => doc.pageContent).join('\n\n')
        }

        // Full RAG chain:
        // 1) Build `context` by running: questionPipeline -> retriever -> combineDocuments
        // 2) Pass through original `question` and `name` using RunnablePassthrough
        // 3) Feed {context, question, name} into answerPromptTemplate
        // 4) Convert final AIMessage to string
        //
        // Tip (beginner): this chain expects an input object like:
        //   { question: "...", name: "..." }
        // and it will output a *string* answer.
        this.runablesequesnce = RunnableSequence.from([
            {
                // Build a `context` string from retrieved documents.
                context: RunnableSequence.from([questionPipeline, retriver, combineDocuments]),

                // Keep the original question available for the final answer prompt.
                question: new RunnablePassthrough(),

                // Keep the user's name available for prompts that include {name}.
                name: new RunnablePassthrough(),

                // Provide the current chat history to the prompt.
                // This must be a runnable/function (not a raw array), so we wrap it.
                chat_history: () => chat_history
            },
            answerPromptTemplate,
            new StringOutputParser()
        ])
    }

    // Public method you can call from anywhere (CLI, Express API, etc.).
    // It runs the full RAG pipeline and returns the final answer text.
    //
    // Params:
    // - question: what the user is asking (string)
    // - name: optional name to personalize the response (string)
    //
    // Returns:
    // - a Promise that resolves to the final answer string
    async ask(question, name = "") {
        // We pass {question, name} into the chain because the prompt templates
        // contain placeholders like {question} and {name}.
        const res = await this.runablesequesnce.invoke({ question, name })
        chat_history.push({ question, answer: res });
        return res;
    }
}

// Demo runner (optional):
// If you want `node indexchai.js` to run a quick test call, uncomment the block below.
// It is commented out so importing this file (e.g. from webserver.js) has no side-effects.
//
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    console.log("LangChainApp ready.");
    const kb = new ScrimbaKnowledgeBank();
    const res = await kb.ask("Will Infogain help my career growth?", "John");
    console.log(res);
}
