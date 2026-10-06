# qewnResumePraser 

A high-performance, edge-to-edge AI Resume & CV Parser powered by **FastAPI (Python)**, **Llama LiteParse OCR Engine**, and **Local Ollama** running dedicated Qwen 0.5B quantized GGUF models.

**Why this project?** 
This project utilizes a **Qwen2.5 0.5B model that I have custom fine-tuned** specifically for resume parsing. By leveraging a Small Language Model (SLM), `qewnResumePraser` allows you to perform fast, highly accurate data extraction entirely locally on your own hardware. This eliminates the need to rely on costly, high-latency API calls to larger cloud models, ensuring complete data privacy and offline capabilities while maintaining excellent extraction quality.

> 💡 **Deployment Note**: For quick local testing and development, the current setup uses **Ollama**. However, for a production environment, it is highly recommended to serve the model using **vLLM** for maximum throughput and performance.

---

## 🖼️ Sample Result & UI Preview

![Resume Parser AI Sample Result](./assets/sample_result.png)

---

## Key Features

- 📄 **Llama LiteParse OCR**: High-speed, spatial layout-aware OCR engine that accurately preserves multi-column layouts, tables, and sections.
- ⚡ **Local Quantized Qwen Models**:
  - `qwenResumeParserQ8` (8-bit Q8_0 High Precision for maximum extraction accuracy).
  - `qewnResumePraser` (4-bit Q4_K_M Fast for high throughput).
- 🧠 **RAM Resident Keep-Alive**: Models stay memory-locked (`keep_alive: -1`, `num_ctx: 4096`) for rapid, low-latency subsequent inference.
- 🔍 **Backend Post-Processing**: Filters hallucinated languages, cleans empty experience slots, and repairs LLM JSON syntax.
- 🖥️ **Interactive Full-Screen Web UI**: Resizable split-pane viewer (PDF 90% zoom preview on left, formatted visual profile + raw/cleaned JSON on right).
- 📋 **Interactive Model Verification & Setup Guide**: Automatic check and 1-click registration commands.

## 📊 JSON Extraction Schema

The SLM guarantees output in the following structured JSON format:

```json
{
  "full_name": "string|null",
  "email": "string|null",
  "phone": "string|null",
  "location": {
    "city": "string|null",
    "state": "string|null",
    "country": "string|null"
  },
  "links": ["string"],
  "summary": "string|null",
  "skills": ["string"],
  "experience": [
    {
      "company": "string|null",
      "title": "string|null",
      "location": "string|null",
      "start_date": "string|null",
      "end_date": "string|null",
      "description": "string|null"
    }
  ],
  "education": [
    {
      "institution": "string|null",
      "degree": "string|null",
      "start_date": "string|null",
      "end_date": "string|null"
    }
  ],
  "certifications": [
    {
      "name": "string|null",
      "issuer": "string|null",
      "date": "string|null"
    }
  ],
  "awards_achievements": [
    {
      "name": "string|null",
      "issuer": "string|null",
      "date": "string|null",
      "description": "string|null"
    }
  ],
  "projects": [
    {
      "name": "string|null",
      "description": "string|null",
      "url": "string|null",
      "technologies": ["string"]
    }
  ],
  "spoken_languages": ["string"]
}
```

---

## 🛠️ Tech Stack

- **Backend**: Python 3.10+, FastAPI, Uvicorn, LiteParse, HTTPX, Pydantic v2
- **OCR Engine**: Llama LiteParse (`liteparse`)
- **LLM Engine**: Ollama (`http://localhost:11434`)
- **Frontend**: Vanilla JavaScript, CSS3 Design System, HTML5 (Served via FastAPI StaticFiles)

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt
```

### 2. Download Models & Register in Local Ollama

The fine-tuned Qwen2.5 0.5B GGUF model files and Ollama Modelfiles are hosted on Hugging Face.

#### Option A — Clone with Git LFS

Make sure **Git LFS** is installed before cloning:

```bash
# Install Git LFS
git lfs install

# Clone the Hugging Face repository
git clone https://huggingface.co/thrinath25/qwen2.5-0.5b-resume-parser

# Enter the repository
cd qwen2.5-0.5b-resume-parser

# Make sure LFS files are downloaded
git lfs pull
```

You should now have the actual `.gguf` model files rather than Git LFS pointer files.

You can verify them with:

```bash
git lfs ls-files
```

#### Register the Models in Ollama

> [!NOTE]
> **Why registration is necessary:** Ollama requires registering models via `Modelfile` to configure inference parameters, system prompts, and bind raw `.gguf` weights into addressable local models.

Register the high-precision Q8 model:

```bash
ollama create qwenResumeParserQ8 -f ./Modelfile.q8_0
```

Register the faster Q4_K_M model:

```bash
ollama create qewnResumePraser -f ./Modelfile.q4_k_m
```

Verify that both models are available:

```bash
ollama list
```

You should see:

```text
qwenResumeParserQ8
qewnResumePraser
```

> [!IMPORTANT]
> The exact model names (`qwenResumeParserQ8` and `qewnResumePraser`) are referenced directly in `main.py`, `public/app.js`, and `public/index.html`. If you register the models under custom names, be sure to update those model identifiers across the codebase to match.

#### Option B — Download the Repository Without Git

If Git/Git LFS is not available, you can download the repository files directly from Hugging Face and place the GGUF files and Modelfiles in the project directory.

Note the repository also contains `model.safetensors` for users who want to load the fine-tuned model directly with Hugging Face Transformers. Ollama uses the GGUF files referenced by the respective Modelfiles.

#### ⚠️ Using `model.safetensors` (Transformers / Custom Pipelines)

> [!WARNING]
> Unlike Ollama GGUF (where the `Modelfile` bakes the system prompt into the registered model), raw `model.safetensors` weights do **not** have the system prompt baked into the file.
> 
> The fine-tuned model is **strictly sensitive to the exact system prompt**. When running inference with Hugging Face Transformers, vLLM, or custom pipelines, you **must provide the exact system prompt** to ensure structured JSON output.

### SYSTEM PROMPT:

```dockerfile
You are an expert, strict resume parsing assistant.
Extract structured candidate information from the provided resume text into a single valid JSON object.

<json_schema>
{
  "full_name": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "location": {
    "city": "string or null",
    "state": "string or null",
    "country": "string or null"
  },
  "links": ["string"],
  "summary": "string or null",
  "skills": ["string"],
  "experience": [
    {
      "company": "string or null",
      "title": "string or null",
      "location": "string or null",
      "start_date": "string or null",
      "end_date": "string or null",
      "is_current": "boolean",
      "description": "string or null",
      "highlights": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string or null",
      "degree": "string or null",
      "field_of_study": "string or null",
      "start_date": "string or null",
      "end_date": "string or null",
      "gpa": "string or null"
    }
  ],
  "certifications": [
    {
      "name": "string or null",
      "issuer": "string or null",
      "date": "string or null"
    }
  ],
  "awards_achievements": [
    {
      "name": "string or null",
      "issuer": "string or null",
      "date": "string or null",
      "description": "string or null"
    }
  ],
  "projects": [
    {
      "name": "string or null",
      "description": "string or null",
      "technologies": ["string"],
      "url": "string or null"
    }
  ],
  "spoken_languages": ["string"]
}
</json_schema>

<rules>
1. Strict Grounding: Extract ONLY facts explicitly stated in the text. Never invent, extrapolate, or hallucinate missing details.
2. Missing or Uncertain Data: If any field, date, or detail is absent or not 100% grounded in the text, strictly output null for strings/objects and [] for arrays (e.g. education, certifications, awards_achievements, projects, spoken_languages).
3. Spoken Languages: "spoken_languages" refers EXCLUSIVELY to human natural languages.
4. Output Contract: Output ONLY the raw JSON object. Do not include markdown code fences (no ```json), commentary, or conversational filler.
</rules>
```

### 3. Run the FastAPI Server

```bash
# Run with uvicorn (port 3000)
uvicorn main:app --host 0.0.0.0 --port 3000 --reload
```

Open **http://localhost:3000** in your browser.
Interactive API documentation is available at **http://localhost:3000/docs**.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/status` | System health, LiteParse readiness, and Ollama keep-alive status. |
| `GET` | `/api/models/check` | Real-time verification of Qwen resume parser models in Ollama. |
| `POST` | `/api/preload` | Pre-warms and locks the chosen model in RAM with `keep_alive: -1`. |
| `POST` | `/api/parse-pdf` | Uploads PDF resume, extracts layout text with LiteParse, and parses via Ollama. |
| `POST` | `/api/parse-text` | Directly parses raw resume text string into structured JSON. |

---

## 📂 Project Structure

```
.
├── assets/                  # Documentation & UI preview assets
│   └── sample_result.png    # Sample parsing UI preview
├── main.py                  # FastAPI Application & Endpoints
├── requirements.txt         # Python Dependencies
├── public/                  # Frontend SPA
│   ├── index.html           # Full-screen workspace UI
│   ├── app.js               # Client application logic
│   └── style.css            # Modern UI styling & themes
├── .gitignore               # Git ignore rules
└── README.md                # Project documentation
```

---

## License & Disclaimer

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for the full license text.

### Disclaimer of Warranty
This software and the fine-tuned AI model weights are provided on an **"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND**, either express or implied, including, without limitation, any warranties or conditions of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A PARTICULAR PURPOSE.

AI models may occasionally generate inaccurate, incomplete, or hallucinated outputs. Users are solely responsible for evaluating the accuracy, completeness, and appropriateness of the parsed data for any use case, including automated recruitment, candidate evaluation, or hiring decisions.
