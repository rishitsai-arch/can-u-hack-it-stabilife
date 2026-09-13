#!/usr/bin/env python3
"""
Comprehensive System Verification Test for Content Blur Guard
Tests models, vectorizer, FastAPI endpoints, and Chrome extension assets.
"""

import io
import json
import os
import sys
from pathlib import Path

# Add api-server to python path
SERVER_DIR = Path(__file__).resolve().parent / "api-server"
sys.path.insert(0, str(SERVER_DIR))

from fastapi.testclient import TestClient
from PIL import Image

import main


def test_models_loaded():
    print("\n--- 1. Testing Model Loading ---")
    assert main.vectorizer is not None, "Vectorizer failed to load!"
    print("  [PASS] TF-IDF Vectorizer loaded. Vocabulary size:", len(main.vectorizer.vocabulary_))

    assert main.text_model is not None, "Text model failed to load!"
    print("  [PASS] LogisticRegression text model loaded. Classes:", main.text_model.classes_)

    assert main.image_model is not None, "Image model failed to load!"
    print("  [PASS] EfficientNet image model loaded.")


def test_api_endpoints():
    print("\n--- 2. Testing API Endpoints ---")
    client = TestClient(main.app)

    # Health check
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.status_code}"
    data = res.json()
    assert data["text_model"] == "loaded", "Health check reports text model unavailable!"
    print("  [PASS] /health returned 200 OK:", data["service"])

    # Single text: Toxic
    vulgar_prompt = "You are a stupid idiot and a bitch, go to hell"
    res = client.post("/predict-text", json={"text": vulgar_prompt, "threshold": 0.5})
    assert res.status_code == 200
    res_json = res.json()
    assert res_json["is_flagged"] is True, f"Expected toxic text to be flagged! Got: {res_json}"
    assert res_json["label"] == "toxic"
    print("  [PASS] /predict-text flagged vulgar text:", res_json)

    # Single text: Clean
    clean_prompt = "Good morning! The weather is lovely today and I love coding."
    res = client.post("/predict-text", json={"text": clean_prompt, "threshold": 0.5})
    assert res.status_code == 200
    res_json = res.json()
    assert res_json["is_flagged"] is False, f"Expected clean text not to be flagged! Got: {res_json}"
    assert res_json["label"] == "clean"
    print("  [PASS] /predict-text passed clean text:", res_json)

    # Batch text
    batch_payload = {
        "texts": [
            "What a beautiful sunny day outside",
            "I will kill you and beat your face in",
            "Learn Python and machine learning with tutorials",
            "You are a disgusting bitch",
        ],
        "threshold": 0.5,
    }
    res = client.post("/predict-text-batch", json=batch_payload)
    assert res.status_code == 200
    batch_json = res.json()
    assert len(batch_json["results"]) == 4
    assert batch_json["results"][0]["is_flagged"] is False  # clean
    assert batch_json["results"][1]["is_flagged"] is True   # kill/beat -> violent threat
    assert batch_json["results"][2]["is_flagged"] is False  # clean
    assert batch_json["results"][3]["is_flagged"] is True   # bitch -> vulgar
    print("  [PASS] /predict-text-batch processed 4 items accurately.")

    # Image test
    parent_dir = Path(__file__).resolve().parent
    fight_path = parent_dir / "fight1.jpeg"
    nofight_path = parent_dir / "nofight.jpeg"

    if fight_path.exists():
        with open(fight_path, "rb") as f:
            res = client.post("/predict-image", files={"file": ("fight1.jpg", f.read(), "image/jpeg")})
        assert res.status_code == 200
        img_res = res.json()
        assert img_res["is_violence"] is True, f"Expected fight1.jpeg to be flagged as violence! Got: {img_res}"
        print("  [PASS] /predict-image flagged violent image (fight1.jpeg):", img_res)

    if nofight_path.exists():
        with open(nofight_path, "rb") as f:
            res = client.post("/predict-image", files={"file": ("nofight.jpg", f.read(), "image/jpeg")})
        assert res.status_code == 200
        img_res = res.json()
        assert img_res["is_violence"] is False, f"Expected nofight.jpeg to be non-violence! Got: {img_res}"
        print("  [PASS] /predict-image correctly passed non-violent image (nofight.jpeg):", img_res)


def test_extension_integrity():
    print("\n--- 3. Testing Extension Assets Integrity ---")
    ext_dir = Path(__file__).resolve().parent / "blur-extension"
    assert ext_dir.exists(), "Extension directory missing!"

    manifest_file = ext_dir / "manifest.json"
    assert manifest_file.exists(), "manifest.json missing!"
    with open(manifest_file, "r") as f:
        manifest = json.load(f)
    assert manifest["manifest_version"] == 3
    print("  [PASS] manifest.json is valid Manifest V3")

    files = [
        "background.js",
        "content.js",
        "style.css",
        "popup.html",
        "popup.js",
        "icons/icon16.png",
        "icons/icon32.png",
        "icons/icon48.png",
        "icons/icon128.png",
    ]
    for f in files:
        p = ext_dir / f
        assert p.exists() and p.stat().st_size > 0, f"Extension file {f} missing or empty!"
        print(f"  [PASS] {f} verified ({p.stat().st_size} bytes)")


if __name__ == "__main__":
    print("=" * 60)
    print("Content Blur Guard - Automated Verification Suite")
    print("=" * 60)
    test_models_loaded()
    test_api_endpoints()
    test_extension_integrity()
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY! The system is fully operational.")
    print("=" * 60)
