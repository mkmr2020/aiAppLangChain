# LangChainApp

A beginner-friendly LangChain (JS) project that:

- Splits a text file into chunks and uploads them to Supabase as a vector store (embeddings + content).
- Runs a simple RAG (Retrieval Augmented Generation) pipeline:
	- rewrite the user question into a standalone question
	- retrieve relevant chunks from Supabase via pgvector similarity search
	- answer using an OpenAI chat model with the retrieved context
- Exposes the RAG pipeline in two ways:
	- as a reusable class (`ScrimbaKnowledgeBank`) in `indexchai.js`
	- as a small web API + webpage UI via `webserver.js` and `public/`

## Project Structure

- `indexchai.js` — exports `ScrimbaKnowledgeBank` (the main RAG logic)
- `uploaddoc.js` — reads a local `.txt`, splits it, embeds chunks, stores them in Supabase
- `webserver.js` — Express server that serves the webpage and exposes `POST /api/ask`
- `public/index.html` + `public/app.js` — webpage UI: input question → show response

## Prerequisites

- Node.js (ESM enabled; this repo uses `"type": "module"`)
- A Supabase project with:
	- pgvector enabled
	- a table to store documents + embeddings (example: `infogaindocuments`)
	- a SQL function to match documents by embedding (example: `match_infogain_documents`)
- API keys:
	- OpenAI key (`OPENAI_API_KEY`)
	- Hugging Face token (`HF_TOKEN`) for embeddings

## Environment Variables

Create a `.env` file in the project root (this file is ignored by git):

```env
OPENAI_API_KEY=your_openai_key
HF_TOKEN=your_huggingface_token
SUPER_PROJECT_URL=https://xxxx.supabase.co
SUPER_PROJECT_API_KEY=your_supabase_key
PORT=3000
```

Notes:

- `SUPER_PROJECT_API_KEY` can be anon or service key depending on your policies.
- Never commit `.env`.

## Install

```bash
npm install
```

## Run (CLI)

### 1) Upload documents to Supabase

This reads a local `.txt`, splits into chunks, generates embeddings, and writes into the configured Supabase table.

```bash
node uploaddoc.js
```

### 2) Ask a question using the class

`indexchai.js` exports `ScrimbaKnowledgeBank` which you can import from other code.

To run the demo inside `indexchai.js`, you can uncomment the “Demo runner” block at the bottom and run:

```bash
node indexchai.js
```

## Run (Web UI)

Start the Express server:

```bash
node webserver.js
```

Open your browser:

- http://localhost:3000

The UI sends a POST request to the API:

- `POST /api/ask` with JSON body `{ "question": "..." }`

The API calls:

- `ScrimbaKnowledgeBank.ask(question, name)`

and returns:

- `{ "answer": "..." }`

## How the RAG Pipeline Works (Simplified)

Inside `ScrimbaKnowledgeBank`:

1. **Standalone question**: LLM rewrites `{question}` into a clean search query.
2. **Retrieve**: Supabase vector store searches for the most similar chunks.
3. **Combine**: retrieved `Document[]` → single `context` string.
4. **Answer**: LLM answers using `context` + original `question` (and optional `name`).

## Supabase Requirements (Table + Function)

Your Supabase table and SQL match function must agree with the configuration used in code:

- In `indexchai.js`:
	- `tableName: 'infogaindocuments'`
	- `queryName: 'match_infogain_documents'`

Make sure the SQL function reads from the same table. Example pattern (you must adapt it to your actual schema):

```sql
create or replace function match_infogain_documents (
	query_embedding vector(384),
	match_count int default null,
	filter jsonb default '{}'
) returns table (
	id bigint,
	content text,
	metadata jsonb,
	similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
	return query
	select
		id,
		content,
		metadata,
		1 - (infogaindocuments.embedding <=> query_embedding) as similarity
	from infogaindocuments
	where metadata @> filter
	order by infogaindocuments.embedding <=> query_embedding
	limit match_count;
end;
$$;
```

## Common Issues

### “Package subpath not exported”

LangChain JS moved many imports. Prefer:

- `@langchain/core/...`
- `@langchain/openai`
- `@langchain/community/...`

### Hugging Face 401/404

- 401 means `HF_TOKEN` missing/invalid.
- 404 can mean the selected model isn’t available on the shared HF inference router.

### OpenAI 429 Rate limit

If you see `429 rate_limit_exceeded`, wait a bit and retry (or reduce request frequency).

## License

Unspecified.
