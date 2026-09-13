# Content Blur Guard (AI-Powered Chrome Extension + Moderation API)

Content Blur Guard is an intelligent browser protection extension and FastAPI backend that automatically detects and blurs vulgar, abusive, toxic, and violent text & images on any webpage.

---

## 🚀 Quick Start (2 Steps)

### Step 1: Start the API Server

From the `content-blur-guard` directory:
```bash
./start_server.sh
```
Or manually:
```bash
cd api-server
/usr/local/bin/python3 -m uvicorn main:app --reload --port 8000
```

Verify it is running:
- Open [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) in your browser.
- You should see `{"status": "ok", "text_model": "loaded", "image_model": "loaded"}`.

### Step 2: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** ON (top right switch).
3. Click **Load unpacked** (top left).
4. Select the folder: `content-blur-guard/blur-extension`.
5. Pin the **Content Blur Guard** 🛡️ extension to your toolbar.

---

## 🧪 Testing the Extension Live

1. Open the included demo feed in Chrome:
   ```
   open content-blur-guard/demo_page.html
   ```
2. You will see sample posts:
   - **Vulgar and violent comments** will automatically blur with a shield indicator.
   - **Violent fight images** (`fight1.jpeg`) will blur.
   - **Safe content** remains clear.
3. **Interactive Click/Hover**:
   - Hover over blurred text for a peek preview.
   - Click any blurred text or image to unblur/toggle it!
4. **Interactive Popup**:
   - Click the 🛡️ shield icon in Chrome's toolbar to open the extension popup.
   - View live server status (**AI Online**).
   - See how many texts and images were blurred on the current tab.
   - Adjust the **Sensitivity Slider** (Strict 30% <-> Lenient 80%).
   - Use the **Test Model Live** box to type any phrase and test your model in real time!

---

## 🛠️ Automated Verification Suite

To run all automated model checks and API tests:
```bash
/usr/local/bin/python3 content-blur-guard/test_system.py
```

---

## 📁 Architecture & File Layout

```
content-blur-guard/
├── api-server/
│   ├── main.py               # FastAPI server with single & batch endpoints
│   ├── model.pkl             # Trained LogisticRegression text classifier
│   ├── vectorizer.pkl        # Trained TF-IDF vectorizer (20,000 features)
│   ├── text_model.pkl        # Model alias for backward compatibility
│   ├── violence_model.pth    # PyTorch EfficientNet-B0 image model
│   └── requirements.txt      # Python dependencies
├── blur-extension/
│   ├── manifest.json         # Chrome Extension Manifest V3 configuration
│   ├── background.js         # Service worker (CORS bypass, stats & badge)
│   ├── content.js            # In-page text batcher & image scanner
│   ├── style.css             # Blur filters, hover peek & badge styling
│   ├── popup.html            # Premium UI popup with live controls
│   ├── popup.js              # Live status, sensitivity slider & tester sandbox
│   └── icons/                # Shield icons (16, 32, 48, 128px)
├── demo_page.html            # Test feed with clean & sensitive posts
├── start_server.sh           # One-click startup script
└── test_system.py            # Automated test and validation suite
```

---

## 🔍 Mistakes Resolved & Enhancements Made

1. **Pickle Corruption Fixed**: Replaced the corrupted pickles (`invalid load key`) in `api-server` with the valid `vectorizer.pkl` and `model.pkl` trained from `Toxic_Text_identifier.ipynb`.
2. **Path Robustness**: Replaced fragile relative paths with `Path(__file__).resolve().parent` and fallback checks.
3. **High-Speed Text Batching**: Added `/predict-text-batch` endpoint to scan entire pages in 1-2 network requests instead of dozens of individual requests.
4. **Image Classifier Calibration**: Corrected class mapping and thresholding for `violence_model.pth` so violent fights are blurred while benign images are kept clean.
5. **Interactive Reversible Blur**: Enabled hover-peek and click-to-unblur functionality while maintaining page layout.
6. **Manifest V3 & Service Worker**: Added background service worker and host permissions for cross-origin image checks.
7. **Full Extension Popup**: Built an interactive popup with connection indicators, sensitivity adjustment, and a real-time testing sandbox.
