"""
Content Blur Guard - API Server (main.py)
=========================================
This FastAPI backend serves your trained Machine Learning models to the Chrome extension.
It runs locally on your computer (http://127.0.0.1:8000) with ZERO external API calls.

STEP-BY-STEP IMPLEMENTATION GUIDE:
- STEP 1: Libraries & Environment Setup
- STEP 2: Safe Path Resolution (Finding .pkl and .pth files)
- STEP 3: FastAPI App Initialization & CORS Middleware
- STEP 4: Hardware Device Setup (CPU / CUDA GPU)
- STEP 5: Loading the Trained Image Model (violence_model.pth)
- STEP 6: Loading the Trained Text Model & Vectorizer (vectorizer.pkl & model.pkl)
- STEP 7: Request Data Schemas (Pydantic models)
- STEP 8: Health Check Endpoint (GET /health)
- STEP 9: Core Text Classification Helper
- STEP 10: Single Text Moderation Endpoint (POST /predict-text)
- STEP 11: High-Performance Batch Text Endpoint (POST /predict-text-batch)
- STEP 12: Image Moderation Endpoints (POST /predict-image, /predict-image-url)
"""

# ===========================================================================
# STEP 1: Libraries & Environment Setup
# ===========================================================================
# Standard library imports for byte streams, OS paths, and object serialization (pickle)
import io
import os
import pickle
import warnings
from pathlib import Path
from typing import List, Optional

# Suppress benign scikit-learn version mismatch warnings on unpickling
warnings.filterwarnings("ignore")

# Third-party libraries:
# - httpx: Async HTTP client for downloading image URLs without browser CORS blocks
# - torch, torchvision: PyTorch deep learning library for computer vision
# - fastapi, uvicorn: Modern, fast, asynchronous web framework
# - PIL: Python Imaging Library for reading, resizing, and blurring image pixels
# - pydantic: Data validation and type enforcement for incoming API requests
import httpx
import torch
import torch.nn as nn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image, ImageFilter
from pydantic import BaseModel, Field
from torchvision import transforms
from torchvision.models import efficientnet_b0


# ===========================================================================
# STEP 2: Safe Path Resolution
# ===========================================================================
# When running the server from different folders (e.g. root vs api-server),
# hardcoded relative paths like open("model.pkl") fail.
# Here we find the absolute path of this file's folder and the workspace root.
BASE_DIR = Path(__file__).resolve().parent
PARENT_DIR = BASE_DIR.parent.parent  # Workspace root directory

def find_file(filename: str, fallback_names: list[str] = None) -> Optional[Path]:
    """
    Searches for a model file first in BASE_DIR (api-server/),
    then falls back to PARENT_DIR (workspace root).
    Also checks alternative fallback filenames (e.g. text_model.pkl vs model.pkl).
    """
    names = [filename] + (fallback_names or [])
    for directory in [BASE_DIR, BASE_DIR.parent, PARENT_DIR]:
        for n in names:
            target_path = directory / n
            if target_path.exists() and target_path.is_file():
                return target_path
    return None


# ===========================================================================
# STEP 3: FastAPI App Initialization & CORS Setup
# ===========================================================================
# Initialize the FastAPI web application instance with metadata
app = FastAPI(
    title="Content Blur Guard API",
    description="Local moderation API detecting vulgar, toxic, and violent content for Chrome Extension",
    version="2.0.0",
)

# Cross-Origin Resource Sharing (CORS) Middleware:
# Chrome extensions run in an isolated origin (chrome-extension://...)
# Allowing all origins ("*") lets the content script and popup communicate with this API seamlessly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===========================================================================
# STEP 4: Hardware Device Setup
# ===========================================================================
# Automatically select NVIDIA GPU (CUDA) if available, otherwise fall back to CPU.
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ===========================================================================
# STEP 5: Loading the Trained Image Model (violence_model.pth)
# ===========================================================================
# Class labels: In our model, class 0 represents fight/violence,
# and class 1 represents non-violence.
IMAGE_CLASSES = ["violence", "non_violence"]
image_model = None
image_model_load_error = None

# Attempt to locate and load the PyTorch EfficientNet-B0 model weights
image_model_path = find_file("violence_model.pth")
if image_model_path:
    try:
        # Reconstruct the EfficientNet-B0 architecture
        m = efficientnet_b0(weights=None)
        in_features = m.classifier[1].in_features
        # Replace the final classification head for 2 classes (violence vs non-violence)
        m.classifier = nn.Sequential(
            nn.Dropout(p=0.2, inplace=True),
            nn.Linear(in_features, 2),
        )
        # Load the trained weights saved in violence_model.pth
        m.load_state_dict(torch.load(str(image_model_path), map_location=device))
        m.to(device)
        m.eval()  # Set model to evaluation (inference) mode
        image_model = m
        print(f"Image model loaded successfully from {image_model_path}")
    except Exception as e:
        image_model_load_error = f"Failed to load image model: {e}"
        print(f"WARNING: {image_model_load_error}")
else:
    image_model_load_error = "violence_model.pth not found"
    print(f"WARNING: {image_model_load_error}")

# Standard ImageNet pre-processing pipeline for incoming image inputs
image_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


# ===========================================================================
# STEP 6: Loading the Trained Text Model & Vectorizer (.pkl files)
# ===========================================================================
# This loads your fitted TfidfVectorizer (vectorizer.pkl) and your trained
# LogisticRegression model (model.pkl / text_model.pkl).
vectorizer = None
text_model = None
text_model_load_error = None

vec_path = find_file("vectorizer.pkl")
model_path = find_file("model.pkl", fallback_names=["text_model.pkl"])

try:
    if not vec_path or not model_path:
        raise FileNotFoundError(f"Missing vectorizer ({vec_path}) or model ({model_path})")
    
    # 1. Load the TF-IDF Vectorizer (converts text words into 20,000 numerical features)
    with open(vec_path, "rb") as f:
        vectorizer = pickle.load(f)

    # 2. Load the Logistic Regression model (scores toxicity between 0.0 and 1.0)
    with open(model_path, "rb") as f:
        text_model = pickle.load(f)

    print(f"Text model loaded successfully: vectorizer from {vec_path}, model from {model_path}")
except Exception as e:
    text_model_load_error = f"Text model failed to load: {e}"
    print(f"WARNING: {text_model_load_error} — text moderation endpoints will be unavailable.")


# ===========================================================================
# STEP 7: Request Data Schemas (Pydantic Models)
# ===========================================================================
# Pydantic models validate incoming JSON payloads and enforce types.

class TextPayload(BaseModel):
    """Payload for single text classification."""
    text: str
    threshold: Optional[float] = Field(
        default=0.5, ge=0.0, le=1.0, 
        description="Toxicity probability cutoff (0.0 = strictest, 1.0 = most lenient)"
    )

class BatchTextPayload(BaseModel):
    """Payload for high-speed batch text classification (multiple paragraphs)."""
    texts: List[str]
    threshold: Optional[float] = Field(
        default=0.5, ge=0.0, le=1.0, 
        description="Toxicity probability cutoff"
    )

class ImageUrlPayload(BaseModel):
    """Payload for checking an image by external URL without CORS issues."""
    url: str


# ===========================================================================
# STEP 8: Health Check Endpoint (GET /health)
# ===========================================================================
@app.get("/")
@app.get("/health")
async def health():
    """
    Used by the Chrome extension popup and background script to verify
    that the local API server is running and models are loaded properly.
    """
    return {
        "status": "ok",
        "service": "Content Blur Guard Moderation API",
        "device": str(device),
        "image_model": "loaded" if image_model is not None else "unavailable",
        "image_model_error": image_model_load_error,
        "text_model": "loaded" if (vectorizer and text_model) else "unavailable",
        "text_model_error": text_model_load_error,
        "text_model_classes": [int(c) for c in text_model.classes_] if text_model and hasattr(text_model, "classes_") else None,
    }


# ===========================================================================
# STEP 9: Core Text Classification Logic
# ===========================================================================
def _classify_text_single(raw_text: str, threshold: float = 0.5):
    """
    Helper function that performs end-to-end text moderation on a single string:
    1. Validates model readiness.
    2. Cleans leading/trailing whitespace.
    3. Transforms text into TF-IDF numerical vector.
    4. Runs LogisticRegression prediction & computes probability.
    5. Flags content if toxicity_score >= user threshold.
    """
    if vectorizer is None or text_model is None:
        return {
            "error": "Text model is not loaded.",
            "detail": text_model_load_error,
            "is_flagged": False,
            "confidence": 0.0,
        }

    clean_text = raw_text.strip()
    if not clean_text:
        return {
            "is_flagged": False,
            "label": "clean",
            "pred": 0,
            "toxicity_score": 0.0,
            "confidence": 100.0,
        }

    # 1. Transform text to numerical TF-IDF feature vector
    vec = vectorizer.transform([clean_text])
    
    # 2. Get binary prediction (0 = clean, 1 = toxic/vulgar/violent)
    pred = int(text_model.predict(vec)[0])

    # 3. Get exact class probabilities (Class 0: Clean, Class 1: Toxic)
    toxicity_score = 0.0
    if hasattr(text_model, "predict_proba"):
        probas = text_model.predict_proba(vec)[0]
        if len(probas) >= 2:
            toxicity_score = float(probas[1])  # Probability of being toxic
        else:
            toxicity_score = float(probas[0])

    # 4. Compare toxicity score against the threshold
    is_flagged = bool(toxicity_score >= threshold)
    
    # 5. Compute confidence percentage
    confidence = round(toxicity_score * 100, 2) if is_flagged else round((1.0 - toxicity_score) * 100, 2)

    return {
        "is_flagged": is_flagged,
        "label": "toxic" if is_flagged else "clean",
        "pred": 1 if is_flagged else 0,
        "toxicity_score": round(toxicity_score, 4),
        "confidence": confidence,
        "threshold": threshold,
    }


# ===========================================================================
# STEP 10: Single Text Moderation Endpoint (POST /predict-text)
# ===========================================================================
@app.post("/predict-text")
async def predict_text(payload: TextPayload):
    """
    Evaluates a single sentence or comment.
    Called by the Chrome extension popup 'Test Model Live' sandbox.
    """
    return _classify_text_single(payload.text, payload.threshold or 0.5)


# ===========================================================================
# STEP 11: High-Performance Batch Text Endpoint (POST /predict-text-batch)
# ===========================================================================
@app.post("/predict-text-batch")
async def predict_text_batch(payload: BatchTextPayload):
    """
    HIGH-SPEED BATCHING:
    Instead of sending 50 HTTP requests for 50 paragraphs on a webpage,
    the Chrome extension sends a single batch array of texts.
    
    The TF-IDF vectorizer converts all texts in one C-level sparse matrix
    operation, and the LogisticRegression predicts them in parallel in <10ms.
    """
    if vectorizer is None or text_model is None:
        raise HTTPException(status_code=503, detail="Text model is not loaded: " + str(text_model_load_error))

    threshold = payload.threshold or 0.5
    raw_texts = payload.texts

    if not raw_texts:
        return {"results": []}

    # Vectorize all texts simultaneously
    vecs = vectorizer.transform(raw_texts)
    preds = text_model.predict(vecs)
    has_proba = hasattr(text_model, "predict_proba")
    probas = text_model.predict_proba(vecs) if has_proba else None

    # Construct individual result dictionaries
    results = []
    for i in range(len(raw_texts)):
        if has_proba and len(probas[i]) >= 2:
            toxicity_score = float(probas[i][1])
        else:
            toxicity_score = 1.0 if preds[i] == 1 else 0.0

        is_flagged = bool(toxicity_score >= threshold)
        confidence = round(toxicity_score * 100, 2) if is_flagged else round((1.0 - toxicity_score) * 100, 2)

        results.append({
            "index": i,
            "is_flagged": is_flagged,
            "label": "toxic" if is_flagged else "clean",
            "pred": 1 if is_flagged else 0,
            "toxicity_score": round(toxicity_score, 4),
            "confidence": confidence,
        })

    return {"results": results, "threshold": threshold, "total": len(results)}


# ===========================================================================
# STEP 12: Image Moderation Endpoints (Auxiliary)
# ===========================================================================
def _classify_image_pil(img: Image.Image, min_logit_diff: float = 6.0):
    """Classifies PIL image into violence vs non-violence using EfficientNet-B0."""
    if image_model is None:
        return {"label": "unknown", "confidence": 0.0, "error": image_model_load_error, "is_violence": False}

    img_rgb = img.convert("RGB")
    img_tensor = image_transform(img_rgb).unsqueeze(0).to(device)

    with torch.no_grad():
        output = image_model(img_tensor)
        probs = torch.softmax(output, dim=1)
        
        # In our trained image model, class 0 is fight/violence, class 1 is non-violence.
        # min_logit_diff ensures only clear violent fight images are flagged.
        diff = output[0][0].item() - output[0][1].item()
        is_violence = bool(diff >= min_logit_diff)
        confidence = probs[0][0].item() if is_violence else (1.0 - probs[0][0].item())

    label = "violence" if is_violence else "non_violence"
    return {
        "label": label,
        "confidence": round(confidence * 100, 2),
        "is_violence": is_violence,
        "violence_score": round(probs[0][0].item(), 4),
        "margin": round(diff, 2),
    }


@app.post("/predict-image")
async def predict_image(file: UploadFile = File(...)):
    """Accepts multipart/form-data image upload and returns violence prediction."""
    contents = await file.read()
    try:
        img = Image.open(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {e}")

    result = _classify_image_pil(img)
    return result


@app.post("/predict-image-url")
async def predict_image_url(payload: ImageUrlPayload):
    """
    Downloads image on the backend to bypass browser CORS restrictions,
    then evaluates it with the image model.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            resp = await client.get(payload.url, headers=headers)
            resp.raise_for_status()
            img = Image.open(io.BytesIO(resp.content))
    except Exception as e:
        return {
            "error": f"Failed to download image from URL: {e}",
            "label": "unknown",
            "confidence": 0.0,
            "is_violence": False,
        }

    return _classify_image_pil(img)


@app.post("/predict-image-and-blur")
async def predict_image_and_blur(file: UploadFile = File(...)):
    """
    If an uploaded image is flagged as violence, applies a server-side
    Gaussian blur to the image pixels and returns the blurred image bytes.
    """
    contents = await file.read()
    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    result = _classify_image_pil(img)
    label = result.get("label", "non_violence")
    confidence = result.get("confidence", 0.0)
    is_violence = result.get("is_violence", False)

    if is_violence or label == "violence":
        # Apply Gaussian blur baked into pixels
        blurred = img.filter(ImageFilter.GaussianBlur(radius=25))
        buf = io.BytesIO()
        blurred.save(buf, format="JPEG", quality=85)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="image/jpeg",
            headers={
                "X-Label": label,
                "X-Confidence": str(confidence),
                "Access-Control-Expose-Headers": "X-Label, X-Confidence",
            },
        )

    buf = io.BytesIO(contents)
    return StreamingResponse(
        buf,
        media_type=file.content_type or "image/jpeg",
        headers={
            "X-Label": label,
            "X-Confidence": str(confidence),
            "Access-Control-Expose-Headers": "X-Label, X-Confidence",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

