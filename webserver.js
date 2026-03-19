// webserver.js
// Minimal web server:
// - Serves a single page UI from /public
// - Exposes POST /api/ask to run the existing RAG pipeline

import "dotenv/config";

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Reuse the exact RAG logic from indexchai.js.
import { ScrimbaKnowledgeBank } from "./indexchai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Allows the server to read JSON sent from the browser.
// Example request body from the webpage:
//   { "question": "What is Scrimba?" }
app.use(express.json({ limit: "1mb" }));

// Serve the webpage (HTML/CSS/JS) from the /public folder.
// Visiting http://localhost:3000 will load /public/index.html.
app.use(express.static(path.join(__dirname, "public")));

// --- API logic in a separate class ---

class KnowledgeBankApi {
  constructor() {
    // Create ONE instance of the knowledge bank.
    // This object contains the LangChain pipeline and will be reused
    // for every request (better than rebuilding it every time).
    this.kb = new ScrimbaKnowledgeBank();
  }

  register(app) {
    // This is the API endpoint the webpage calls.
    // When the user submits the text input, the browser sends a POST request to:
    //   /api/ask
    // with JSON like:
    //   { question: "..." }
    app.post("/api/ask", async (req, res) => {
      // Read the question from the JSON body.
      const question = String(req.body?.question ?? "").trim();
      if (!question) {
        // If the browser sends an empty question, return HTTP 400 (bad request).
        return res.status(400).json({ error: "Question is required." });
      }

      try {
        // Call the knowledge bank class.
        // Our ScrimbaKnowledgeBank.ask(...) expects (question, name).
        // The web UI only provides a question, so we pass a default name.
        const answer = await this.kb.ask(question, "Friend");

        // Send the answer back to the browser.
        // Browser receives: { answer: "..." }
        return res.json({ answer });
      } catch (err) {
        // If something fails (OpenAI/HF/Supabase/etc), return HTTP 500.
        const message = err instanceof Error ? err.message : String(err);
        console.error(err);
        return res.status(500).json({ error: message });
      }
    });
  }
}

new KnowledgeBankApi().register(app);

const port = Number(process.env.PORT ?? 3000);

// Start the web server.
app.listen(port, () => {
  console.log(`Web UI running on http://localhost:${port}`);
});
