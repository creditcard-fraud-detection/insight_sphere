import asyncio
import io
import uuid
import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
import ollama
import chromadb

app = FastAPI(
    title="InsightSphere Local RAG API",
    description="Local RAG backend powered by FastAPI, Ollama, and ChromaDB.",
    version="1.0.0"
)

# Singleton ChromaDB client — reused across requests to avoid reopening
# the SQLite connection on every call.
_chroma_client = chromadb.PersistentClient(path="./chroma_db")


# ------------------------------------------------------------------
# Pydantic schemas
# ------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str
    top_k: int = 4


class Citation(BaseModel):
    file_name: str
    row_number: int
    content: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    sources_found: bool


SYSTEM_PROMPT = (
    "You are InsightSphere, a strict business intelligence assistant.\n"
    "Answer the user's question using ONLY the provided context snippets below.\n"
    "Rules:\n"
    "1. Ground every claim strictly in the context.\n"
    "2. Never assume or extrapolate numbers, dates, or prices not in the text.\n"
    '3. If the context does not contain enough information to answer, '
    "state clearly: 'I cannot find this information in your uploaded records.'\n"
    "4. Always mention which file and row number provided the key figures."
)


def get_embedding(text: str):
    """Helper to fetch embeddings from local nomic-embed-text model via Ollama.

    Uses ollama.embeddings() which returns an EmbeddingsResponse with an
    .embedding attribute (list[float]). Falls back to ollama.embed() for
    older library versions.
    """
    res = ollama.embeddings(model="nomic-embed-text", prompt=text)
    # ollama >= 0.4 returns an EmbeddingsResponse (pydantic model)
    if hasattr(res, "embedding"):
        return res.embedding
    # Fallback for dict-style responses
    if isinstance(res, dict):
        return res.get("embedding")
    return None

@app.get("/")
def read_root():
    return {
        "app": "InsightSphere",
        "status": "online",
        "endpoints": [
            "/upload",
            "/chat",
            "/test-llm",
            "/test-embed",
            "/test-db",
            "/docs",
        ],
    }

@app.get("/test-llm")
def test_llm():
    try:
        response = ollama.chat(
            model="qwen2.5:3b",
            messages=[
                {"role": "user", "content": "Say hello world"}
            ]
        )
        # Handle dict or ChatResponse object response from ollama library
        if isinstance(response, dict):
            content = response.get("message", {}).get("content", "")
        else:
            content = getattr(getattr(response, "message", None), "content", str(response))
        return {
            "status": "success",
            "model": "qwen2.5:3b",
            "prompt": "Say hello world",
            "response": content
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ollama LLM error: {str(e)}. Please ensure Ollama is running and qwen2.5:3b is pulled (`ollama pull qwen2.5:3b`)."
        )

@app.get("/test-embed")
def test_embed():
    try:
        prompt_text = "InsightSphere test embedding string"
        embedding_vec = get_embedding(prompt_text)

        if embedding_vec is None:
            raise ValueError("Unable to retrieve embedding vector from response.")

        return {
            "status": "success",
            "model": "nomic-embed-text",
            "embedding_length": len(embedding_vec)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ollama embedding error: {str(e)}. Please ensure Ollama is running and nomic-embed-text is pulled (`ollama pull nomic-embed-text`)."
        )

@app.get("/test-db")
def test_db():
    try:
        collection = _chroma_client.get_or_create_collection(
            name="business_records",
            embedding_function=None,
        )

        doc_id = f"test_{uuid.uuid4().hex[:8]}"
        test_text = "Sample business document content for InsightSphere."
        test_vec = get_embedding(test_text)

        collection.add(
            documents=[test_text],
            embeddings=[test_vec],
            metadatas=[{"file_name": "test.csv", "row_number": 1}],
            ids=[doc_id],
        )

        total_docs = collection.count()
        return {
            "status": "success",
            "collection": "business_records",
            "added_id": doc_id,
            "document_count": total_docs,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"ChromaDB error: {str(e)}"
        )

async def _generate_embeddings_batch(
    chunks: list[str],
) -> list[list[float]]:
    """Generate embeddings for a list of chunks in a thread pool.

    CPU-bound Ollama HTTP calls are offloaded so the FastAPI event loop
    stays responsive to other requests.
    """
    loop = asyncio.get_event_loop()

    def _sync_embed_batch():
        vectors = []
        for chunk in chunks:
            vec = get_embedding(chunk)
            if not vec:
                raise ValueError(f"Empty embedding for chunk: {chunk[:80]}…")
            vectors.append(vec)
        return vectors

    return await loop.run_in_executor(None, _sync_embed_batch)


async def _chroma_add(
    documents: list[str],
    embeddings: list[list[float]],
    metadatas: list[dict],
    ids: list[str],
) -> None:
    """Offload the ChromaDB insert to a thread pool."""
    loop = asyncio.get_event_loop()

    def _sync_add():
        collection = _chroma_client.get_or_create_collection(
            name="business_records",
            embedding_function=None,
        )
        collection.add(
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids,
        )

    await loop.run_in_executor(None, _sync_add)


@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only .csv files are supported."
        )

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse CSV file: {str(e)}"
        )

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="The uploaded CSV file is empty."
        )

    documents: list[str] = []
    metadatas: list[dict] = []
    ids: list[str] = []

    for index, row in df.iterrows():
        row_str_items = [
            f"{col} is {val}"
            for col, val in row.items()
            if pd.notna(val)
        ]
        chunk = "Row data: " + ", ".join(row_str_items)

        documents.append(chunk)
        metadatas.append({
            "file_name": file.filename,
            "row_number": int(index),
        })
        ids.append(
            f"{file.filename}_row_{index}_{uuid.uuid4().hex[:6]}"
        )

    try:
        embeddings = await _generate_embeddings_batch(documents)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate embeddings: {str(e)}",
        )

    try:
        await _chroma_add(documents, embeddings, metadatas, ids)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to store records in ChromaDB: {str(e)}",
        )

    return {
        "status": "success",
        "filename": file.filename,
        "rows_ingested": len(documents),
    }


# ------------------------------------------------------------------
# POST /chat — RAG retrieval + grounded generation
# ------------------------------------------------------------------
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message must not be empty."
        )

    loop = asyncio.get_event_loop()

    # --- Step 1: Embed the user query (non-blocking) ---
    def _embed_query():
        return get_embedding(request.message)

    query_vec = await loop.run_in_executor(None, _embed_query)
    if not query_vec:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate embedding for query."
        )

    # --- Step 2: Query ChromaDB for top-k similar chunks ---
    def _query_chroma():
        collection = _chroma_client.get_or_create_collection(
            name="business_records",
            embedding_function=None,
        )
        if collection.count() == 0:
            return None

        results = collection.query(
            query_embeddings=[query_vec],
            n_results=request.top_k,
            include=["documents", "metadatas", "distances"],
        )
        return results

    results = await loop.run_in_executor(None, _query_chroma)

    # --- Step 3: Handle empty collection / no matches ---
    if results is None or not results.get("documents") or not results["documents"][0]:
        return ChatResponse(
            answer="No uploaded business records found to answer this question.",
            citations=[],
            sources_found=False,
        )

    retrieved_docs = results["documents"][0]
    retrieved_metas = results["metadatas"][0]
    retrieved_distances = results["distances"][0]

    # --- Step 4: Build context string & citation list ---
    context_parts: list[str] = []
    citations: list[Citation] = []

    for doc, meta, dist in zip(retrieved_docs, retrieved_metas, retrieved_distances):
        fname = meta.get("file_name", "unknown")
        row_num = meta.get("row_number", -1)
        context_parts.append(
            f"[Source: {fname}, Row: {row_num}] {doc}"
        )
        citations.append(
            Citation(file_name=fname, row_number=row_num, content=doc)
        )

    context_block = "\n\n".join(context_parts)

    # --- Step 5: Generate grounded answer via qwen2.5:3b ---
    user_message = (
        f"Context:\n{context_block}\n\n"
        f"User question: {request.message}"
    )

    def _llm_generate():
        response = ollama.chat(
            model="qwen2.5:3b",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
        )
        if isinstance(response, dict):
            return response.get("message", {}).get("content", "")
        return getattr(
            getattr(response, "message", None), "content", str(response)
        )

    answer = await loop.run_in_executor(None, _llm_generate)

    return ChatResponse(
        answer=answer,
        citations=citations,
        sources_found=True,
    )
