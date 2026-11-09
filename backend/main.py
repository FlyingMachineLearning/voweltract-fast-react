from typing import Literal
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from engine import analyze
from ingest import extract

app = FastAPI(title="Voweltrace", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class AnalysisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)
    title: str = Field(default="Untitled lyrics", max_length=200)
    stress: Literal["all", "stressed", "primary"] = "stressed"
    line_gap: int = Field(default=2, ge=0, le=8)
    repeats: bool = False
    overrides: dict[str, str] = Field(default_factory=dict)


def run(request):
    try:
        return analyze(
            request.text,
            request.title,
            request.stress,
            request.line_gap,
            request.repeats,
            request.overrides,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
def analyze_text(request: AnalysisRequest):
    return run(request)


@app.post("/api/ingest")
async def ingest(file: UploadFile = File(...)):
    try:
        data = await file.read(10 * 1024 * 1024 + 1)
        if len(data) > 10 * 1024 * 1024:
            raise HTTPException(413, "Limit: 10 MB per document.")
        try:
            text = await run_in_threadpool(extract, file.filename or "", data)
        except Exception as exc:
            raise HTTPException(
                400,
                "Could not extract text. Use an unencrypted, text-based PDF, DOCX, TXT, or Markdown file.",
            ) from exc
        if not text.strip():
            raise HTTPException(400, "No text found. Scanned PDFs need OCR first.")
        if len(text) > 100_000:
            raise HTTPException(413, "Limit: 100,000 extracted characters.")
        return {"text": text, "title": file.filename or "Uploaded lyrics"}
    finally:
        await file.close()
