# Content Blur Guard - API Server

FastAPI moderation backend powered by scikit-learn (`model.pkl` + `vectorizer.pkl`) and PyTorch (`violence_model.pth`).

## Endpoints

- `GET /health` - Server health, device info, and model status
- `POST /predict-text` - Single text toxicity/vulgarity scoring
- `POST /predict-text-batch` - High-throughput batch text classification
- `POST /predict-image` - File upload image violence classification
- `POST /predict-image-url` - URL-based image violence classification (bypasses browser CORS)
- `POST /predict-image-and-blur` - Returns server-blurred JPEG if flagged

## Run Server

```bash
/usr/local/bin/python3 -m uvicorn main:app --reload --port 8000
```
