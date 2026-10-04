"""
Resume Parser AI - FastAPI Backend Server
Powered by Llama LiteParse OCR Engine + Local Ollama (Qwen 0.5B Q8_0 & Q4_K_M)
"""

import os
import sys
import re
import json
import time
import asyncio
import threading
import tempfile
from typing import Optional, List, Dict, Any
from pathlib import Path
from contextlib import asynccontextmanager

# Ensure UTF-8 output encoding support on Windows terminals
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# ==============================================================================
# DEPENDENCY VALIDATION & ENVIRONMENT CHECK
# ==============================================================================
REQUIRED_DEPENDENCIES = [
    ("fastapi", "fastapi>=0.115.0"),
    ("uvicorn", "uvicorn[standard]>=0.30.0"),
    ("httpx", "httpx>=0.27.0"),
    ("multipart", "python-multipart>=0.0.9"),
    ("pydantic", "pydantic>=2.8.0"),
    ("liteparse", "liteparse>=2.15.0"),
]

def validate_dependencies():
    missing = []
    for mod, pkg in REQUIRED_DEPENDENCIES:
        try:
            __import__(mod)
        except ImportError:
            missing.append(pkg)
    
    if missing:
        error_box = "=" * 65
        print(f"\n{error_box}", file=sys.stderr)
        print(" [FATAL ERROR] MISSING REQUIRED PYTHON PACKAGES", file=sys.stderr)
        print(f"{error_box}", file=sys.stderr)
        print(f" Python Executable: {sys.executable}", file=sys.stderr)
        print(f" Python Version:    {sys.version.split()[0]}", file=sys.stderr)
        print("\n The following required packages are NOT installed in this environment:", file=sys.stderr)
        for p in missing:
            print(f"   ❌ {p}", file=sys.stderr)
        print("\n To install all required packages, run:", file=sys.stderr)
        print(f'   "{sys.executable}" -m pip install -r requirements.txt', file=sys.stderr)
        print(f"{error_box}\n", file=sys.stderr)
        raise SystemExit(1)

validate_dependencies()

import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field

# Strict LiteParse Engine Initializer
try:
    from liteparse import LiteParse
    _lite_parser = LiteParse()
    print("[INIT] Llama LiteParse OCR Engine initialized successfully")
except Exception as init_err:
    error_box = "=" * 65
    print(f"\n{error_box}", file=sys.stderr)
    print(" [FATAL ERROR] FAILED TO INITIALIZE LLAMA LITEPARSE OCR ENGINE", file=sys.stderr)
    print(f"{error_box}", file=sys.stderr)
    print(f" Error:             {init_err}", file=sys.stderr)
    print(f" Python Executable: {sys.executable}", file=sys.stderr)
    print("\n Please ensure 'liteparse' is properly installed and native binaries are accessible:", file=sys.stderr)
    print(f'   "{sys.executable}" -m pip install --upgrade --force-reinstall liteparse', file=sys.stderr)
    print(f"{error_box}\n", file=sys.stderr)
    raise SystemExit(1)

def get_lite_parser():
    """
    Return initialized LiteParse instance or raise error if unavailable.
    """
    global _lite_parser
    if _lite_parser is None:
        raise RuntimeError("LiteParse OCR Engine is not initialized. Please restart the server.")
    return _lite_parser

# Configuration
BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
DEFAULT_MODEL = "qwenResumeParserQ8"

# Required Qwen Resume Parser Models Definition
REQUIRED_RESUME_MODELS = [
    {
        "id": "qwenResumeParserQ8",
        "displayName": "Qwen 0.5B (Q8_0 - High Precision)",
        "modelfile": "Modelfile.q8_0",
        "ggufFile": "Qwen2.5-0.5B-Instruct.Q8_0.gguf",
        "createCmd": "ollama create qwenResumeParserQ8 -f ./Modelfile.q8_0",
        "description": "High precision 8-bit quantization for maximum structural CV extraction accuracy"
    },
    {
        "id": "qewnResumePraser",
        "displayName": "Qwen 0.5B (Q4_K_M - Fast)",
        "modelfile": "Modelfile.q4_k_m",
        "ggufFile": "Qwen2.5-0.5B-Instruct.Q4_K_M.gguf",
        "createCmd": "ollama create qewnResumePraser -f ./Modelfile.q4_k_m",
        "description": "Fast 4-bit medium quantization for high throughput CV parsing"
    }
]


# Pydantic Schemas for Request & Response
class PreloadRequest(BaseModel):
    model: Optional[str] = DEFAULT_MODEL


class ParseTextRequest(BaseModel):
    text: str
    model: Optional[str] = DEFAULT_MODEL


async def call_ollama_api(payload: dict) -> dict:
    """
    Robust HTTP client for Ollama API with 10-minute timeout for local CPU/GPU inference.
    """
    url = f"{OLLAMA_URL}/api/generate"
    async with httpx.AsyncClient(timeout=600.0) as client:
        try:
            response = await client.post(url, json=payload)
            if response.status_code >= 200 and response.status_code < 300:
                try:
                    return response.json()
                except Exception:
                    return {"response": response.text}
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Ollama API error ({response.status_code}): {response.text}"
                )
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail="Ollama request timed out after 10 minutes"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Failed to communicate with Ollama at {OLLAMA_URL}: {str(e)}"
            )


def extract_json_from_response(raw_text: str) -> dict:
    """
    Extracts structured JSON from raw LLM responses and applies heuristic syntax auto-repair.
    """
    cleaned = (raw_text or "").strip()

    # 1. Remove markdown code fences if present
    fence_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', cleaned, re.IGNORECASE)
    if fence_match:
        cleaned = fence_match.group(1).strip()

    # 2. Isolate outermost curly braces
    start_idx = cleaned.find('{')
    end_idx = cleaned.rfind('}')
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        cleaned = cleaned[start_idx:end_idx + 1]
    elif start_idx != -1:
        cleaned = cleaned[start_idx:]

    # 3. Try standard parse
    try:
        return json.loads(cleaned)
    except Exception as initial_err:
        # 4. Attempt heuristic repairs for common small LLM syntax quirks
        try:
            repaired = cleaned
            # Remove trailing commas before } or ]
            repaired = re.sub(r',\s*([}\]])', r'\1', repaired)
            # Quote unquoted alphanumeric keys: { key: "val" } -> { "key": "val" }
            repaired = re.sub(r'([{,]\s*)([a-zA-Z0-9_]+)\s*:', r'\1"\2":', repaired)
            repaired = repaired.strip()

            open_braces = repaired.count('{')
            close_braces = repaired.count('}')
            if open_braces > close_braces:
                repaired += '}' * (open_braces - close_braces)

            open_brackets = repaired.count('[')
            close_brackets = repaired.count(']')
            if open_brackets > close_brackets:
                repaired += ']' * (open_brackets - close_brackets)

            return json.loads(repaired)
        except Exception:
            print(f"[WARN] JSON repair failed, returning structured fallback. Error: {initial_err}")
            return {
                "full_name": None,
                "email": None,
                "phone": None,
                "location": {"city": None, "state": None, "country": None},
                "links": [],
                "summary": cleaned,
                "skills": [],
                "experience": [],
                "education": [],
                "certifications": [],
                "awards_achievements": [],
                "projects": [],
                "spoken_languages": []
            }


def post_process_json(raw_json: dict, ocr_text: str = "") -> tuple[dict, bool, list]:
    """
    Backend Post-Processing & Validation:
    1. Removes empty experience objects with null fields
    2. Removes spoken languages not explicitly found in OCR text
    3. Tracks whether post-processing modifications were made
    """
    processed = json.loads(json.dumps(raw_json))
    changes = []
    normalized_ocr = (ocr_text or "").lower()

    # 1. Filter Spoken Languages: verify they appear in OCR text using simple substring check
    if isinstance(processed.get("spoken_languages"), list):
        filtered_langs = []
        for lang in processed["spoken_languages"]:
            if not isinstance(lang, str) or not lang.strip():
                continue
            lang_trimmed = lang.strip()
            if lang_trimmed.lower() in normalized_ocr:
                filtered_langs.append(lang_trimmed)
            else:
                changes.append(f'Filtered hallucinated language "{lang_trimmed}" (not found in OCR text)')
        processed["spoken_languages"] = filtered_langs

    # 2. Filter empty experience padding objects where core fields are null
    if isinstance(processed.get("experience"), list):
        filtered_exp = []
        for exp in processed["experience"]:
            if not isinstance(exp, dict):
                continue
            is_null_entry = (
                not exp.get("company") and
                not exp.get("title") and
                not exp.get("location") and
                not exp.get("start_date") and
                not exp.get("end_date")
            )
            if is_null_entry:
                changes.append("Removed empty experience entry with null fields")
            else:
                filtered_exp.append(exp)
        processed["experience"] = filtered_exp

    is_post_processed = len(changes) > 0
    return processed, is_post_processed, changes


async def preload_ollama_model(model_name: str = DEFAULT_MODEL):
    """
    Pre-warm and lock model in Ollama memory with keep_alive: -1 and 4096 context.
    """
    try:
        await call_ollama_api({
            "model": model_name,
            "keep_alive": -1,
            "options": {
                "num_ctx": 4096
            }
        })
        print(f"[RESIDENT] Model \"{model_name}\" resident in RAM (keep_alive: -1, num_ctx: 4096)")
    except Exception as err:
        print(f"[WARN] Could not preload Ollama model \"{model_name}\": {err}")


async def check_resume_models_in_ollama() -> dict:
    """
    Check specifically if our Qwen Resume Parser models are registered in local Ollama.
    """
    ollama_online = False
    all_ollama_models = []

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get(f"{OLLAMA_URL}/api/tags")
            if res.status_code == 200:
                ollama_online = True
                data = res.json()
                all_ollama_models = [
                    (m.get("name") or "").lower()
                    for m in data.get("models", [])
                ]
    except Exception:
        ollama_online = False

    model_status_list = []
    for req_model in REQUIRED_RESUME_MODELS:
        target_lower = req_model["id"].lower()
        is_registered = any(
            m.replace(":latest", "") == target_lower or m == target_lower
            for m in all_ollama_models
        )
        modelfile_exists = (BASE_DIR / req_model["modelfile"]).exists()
        gguf_exists = (BASE_DIR / req_model["ggufFile"]).exists()

        model_status_list.append({
            **req_model,
            "isRegistered": is_registered,
            "filesPresent": {
                "modelfile": modelfile_exists,
                "gguf": gguf_exists
            }
        })

    registered_count = sum(1 for m in model_status_list if m["isRegistered"])
    all_required_present = (registered_count == len(REQUIRED_RESUME_MODELS))
    at_least_one_present = (registered_count > 0)
    zip_exists = (BASE_DIR / "quantized_gguf_models.zip").exists()

    return {
        "ollamaOnline": ollama_online,
        "ollamaUrl": OLLAMA_URL,
        "allRequiredPresent": all_required_present,
        "atLeastOnePresent": at_least_one_present,
        "registeredCount": registered_count,
        "totalRequired": len(REQUIRED_RESUME_MODELS),
        "models": model_status_list,
        "zipFile": {
            "exists": False,
            "fileName": "quantized_gguf_models.zip"
        },
        "instructions": [
            {
                "step": 1,
                "title": "Download GGUF Models",
                "desc": "Download the quantized models and Modelfiles from Hugging Face.",
                "command": "git clone https://huggingface.co/thrinath25/qwen2.5-0.5b-resume-parser"
            },
            {
                "step": 2,
                "title": "Register Qwen Q8_0 High Precision Model",
                "desc": "Create the 8-bit quantization model in your local Ollama.",
                "command": "ollama create qwenResumeParserQ8 -f ./Modelfile.q8_0"
            },
            {
                "step": 3,
                "title": "Register Qwen Q4_K_M Fast Model",
                "desc": "Create the 4-bit medium quantization model in your local Ollama.",
                "command": "ollama create qewnResumePraser -f ./Modelfile.q4_k_m"
            },
            {
                "step": 4,
                "title": "Verify Models in Ollama",
                "desc": "Check that both models are active and available in Ollama.",
                "command": "ollama list"
            }
        ]
    }


# Lifespan Context Manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("\n" + "=" * 54)
    print("Resume Parser Server (FastAPI) running on http://localhost:3000")
    parser_active = get_lite_parser() is not None
    print("Llama LiteParse OCR Engine: Ready" if parser_active else "[WARN] Llama LiteParse OCR Engine: Not Available")
    print("Ollama Multi-Model: qwenResumeParserQ8 & qewnResumePraser")
    print("=" * 54 + "\n")

    # Preload models in memory asynchronously
    for model_id in ["qwenResumeParserQ8", "qewnResumePraser"]:
        try:
            await preload_ollama_model(model_id)
        except Exception:
            pass

    yield
    # Shutdown


# Initialize FastAPI Application
app = FastAPI(
    title="Resume Parser AI",
    description="Multi-Model Resume Parser with Llama LiteParse OCR and local Ollama Qwen models",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# API ENDPOINTS
# ==============================================================================

@app.get("/api/status")
async def get_status():
    """
    Health check and status of LiteParse OCR & Ollama resident memory.
    """
    model_check = await check_resume_models_in_ollama()
    parser_instance = get_lite_parser()
    return {
        "status": "ok",
        "liteparse": parser_instance is not None,
        "ollama": {
            "online": model_check["ollamaOnline"],
            "url": OLLAMA_URL,
            "keepAlive": -1,
            "availableModels": [
                m["id"] for m in model_check["models"] if m["isRegistered"]
            ]
        },
        "modelVerification": model_check
    }


@app.get("/api/models/check")
async def get_models_check():
    """
    Dedicated Resume Models Verification & Step-by-step Setup Instructions.
    """
    model_check = await check_resume_models_in_ollama()
    return {
        "status": "ok",
        **model_check
    }


@app.post("/api/preload")
async def preload_model_endpoint(req: PreloadRequest):
    """
    Force pre-warm model in memory.
    """
    target_model = req.model or DEFAULT_MODEL
    try:
        await preload_ollama_model(target_model)
        return {"success": True, "message": f"Model {target_model} pre-warmed in memory."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/parse-pdf")
async def parse_pdf(
    file: UploadFile = File(...),
    model: Optional[str] = Form(DEFAULT_MODEL)
):
    """
    Parse PDF resume using Llama LiteParse OCR + Local Ollama pipeline.
    """
    target_model = model or DEFAULT_MODEL
    start_time = time.time()
    ocr_duration_ms = 0

    # Read uploaded file bytes
    content = await file.read()
    file_size_bytes = len(content)

    try:
        print(f"\n[Llama LiteParse] Processing file: {file.filename} (Size: {file_size_bytes} bytes) using model: {target_model}")
        
        if file_size_bytes == 0:
            raise HTTPException(status_code=400, detail="The uploaded file is empty (0 bytes). Check your frontend upload logic.")

        # Step 1: Run Llama LiteParse OCR directly in-memory (offloaded to thread)
        ocr_start = time.time()
        extracted_text = ""
        total_pages = 1

        parser = get_lite_parser()
        if parser is None:
            # Re-attempt dynamic initialization if not ready
            parser = get_lite_parser()

        if parser:
            try:
                # Direct in-memory parsing with raw PDF bytes
                parse_result = await asyncio.to_thread(parser.parse, content)
                
                text_part = getattr(parse_result, "text", "") or ""
                md_part = getattr(parse_result, "markdown", "") or ""
                
                # Combine both text and markdown if distinct, otherwise use whichever is present
                if text_part and md_part and text_part != md_part:
                    extracted_text = (text_part + "\n\n" + md_part).strip()
                else:
                    extracted_text = (text_part or md_part).strip()
                
                if not extracted_text:
                    page_errs = getattr(parse_result, "page_errors", [])
                    print(f"[Llama LiteParse DEBUG] 0 chars extracted. Page errors: {page_errs}")
                    print(f"[Llama LiteParse DEBUG] Raw parse result: {parse_result}")

                if hasattr(parse_result, "pages") and parse_result.pages:
                    total_pages = len(parse_result.pages)
                elif hasattr(parse_result, "total_pages") and parse_result.total_pages:
                    total_pages = parse_result.total_pages
            except Exception as parse_err:
                print(f"[WARN] LiteParse in-memory extraction failed: {parse_err}")
                extracted_text = ""
        else:
            print("[WARN] Llama LiteParse OCR Engine could not be initialized")
        
        ocr_duration_ms = int((time.time() - ocr_start) * 1000)
        print(f"[Llama LiteParse] OCR finished in {ocr_duration_ms}ms ({total_pages} pages, {len(extracted_text)} chars)")

        if not extracted_text.strip():
            raise HTTPException(
                status_code=400, 
                detail="Could not extract text from the PDF file using LiteParse. If this is a scanned or image-based PDF, ensure Tesseract OCR is installed and available in your system PATH, or try a text-based PDF."
            )

        # Step 2: Send structured layout text to local Ollama
        ollama_start = time.time()
        user_prompt = f"Resume text:\n{extracted_text}"

        print(f"[Ollama] Sending prompt to \"{target_model}\" ({len(extracted_text)} chars, format=json, keep_alive=-1)...")
        ollama_data = await call_ollama_api({
            "model": target_model,
            "prompt": user_prompt,
            "format": "json",
            "stream": False,
            "keep_alive": -1,
            "options": {
                "temperature": 0,
                "repeat_penalty": 1.0,
                "num_ctx": 4096,
                "num_predict": 2048
            }
        })
        ollama_duration_ms = int((time.time() - ollama_start) * 1000)
        print(f"[Ollama] Inference finished in {ollama_duration_ms}ms")

        # Step 3: Extract structured raw JSON
        raw_parsed_data = extract_json_from_response(ollama_data.get("response", ""))

        # Step 4: Backend Post-Processing
        processed_json, is_post_processed, changes = post_process_json(raw_parsed_data, extracted_text)
        total_duration_ms = int((time.time() - start_time) * 1000)

        return {
            "success": True,
            "filename": file.filename,
            "modelUsed": target_model,
            "extractedText": extracted_text,
            "rawJson": raw_parsed_data,
            "parsedData": processed_json,
            "isPostProcessed": is_post_processed,
            "postProcessChanges": changes,
            "stats": {
                "totalPages": total_pages,
                "charCount": len(extracted_text),
                "ocrDurationMs": ocr_duration_ms,
                "ollamaDurationMs": ollama_duration_ms,
                "totalDurationMs": total_duration_ms
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise e


@app.post("/api/parse-text")
async def parse_text(req: ParseTextRequest):
    """
    Parse Raw Text directly via Ollama.
    """
    target_model = req.model or DEFAULT_MODEL
    text = req.text.strip() if req.text else ""

    if not text:
        raise HTTPException(status_code=400, detail="No resume text provided.")

    start_time = time.time()
    user_prompt = f"Resume text:\n{text}"

    ollama_data = await call_ollama_api({
        "model": target_model,
        "prompt": user_prompt,
        "format": "json",
        "stream": False,
        "keep_alive": -1,
        "options": {
            "temperature": 0,
            "repeat_penalty": 1.0,
            "num_ctx": 4096,
            "num_predict": 2048
        }
    })

    raw_parsed_data = extract_json_from_response(ollama_data.get("response", ""))
    processed_json, is_post_processed, changes = post_process_json(raw_parsed_data, text)
    total_duration_ms = int((time.time() - start_time) * 1000)

    return {
        "success": True,
        "modelUsed": target_model,
        "rawJson": raw_parsed_data,
        "parsedData": processed_json,
        "isPostProcessed": is_post_processed,
        "postProcessChanges": changes,
        "stats": {
            "totalDurationMs": total_duration_ms
        }
    }


# Serve Static UI Files
if PUBLIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=True), name="public")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3005, reload=True)
