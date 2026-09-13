// Content Blur Guard - Popup Logic (Text Only)

const API_BASE = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", async () => {
  const statusPill = document.getElementById("statusPill");
  const statusText = document.getElementById("statusText");
  const offlineNotice = document.getElementById("offlineNotice");
  const toggleEnabled = document.getElementById("toggleEnabled");
  const thresholdSlider = document.getElementById("thresholdSlider");
  const thresholdVal = document.getElementById("thresholdVal");
  const statText = document.getElementById("statText");
  const testInput = document.getElementById("testInput");
  const testBtn = document.getElementById("testBtn");
  const testResult = document.getElementById("testResult");

  // 1. Check API Health
  async function checkApiHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        if (data.text_model === "loaded") {
          statusPill.className = "status-pill";
          statusText.textContent = "AI Online";
          offlineNotice.style.display = "none";
          return true;
        } else {
          statusPill.className = "status-pill offline";
          statusText.textContent = "Model Error";
          offlineNotice.style.display = "block";
          offlineNotice.innerHTML = `⚠️ <strong>Model Error</strong>: ${data.text_model_error || "Check pkl files"}`;
          return false;
        }
      }
    } catch (err) {
      statusPill.className = "status-pill offline";
      statusText.textContent = "API Offline";
      offlineNotice.style.display = "block";
      return false;
    }
  }

  checkApiHealth();

  // 2. Load stored preferences
  chrome.storage.local.get(["enabled", "threshold"], (data) => {
    if (data.enabled !== undefined) {
      toggleEnabled.checked = Boolean(data.enabled);
    }
    if (data.threshold !== undefined) {
      const pct = Math.round(data.threshold * 100);
      thresholdSlider.value = pct;
      thresholdVal.textContent = `${pct}%`;
    }
  });

  // 3. Handle master toggle
  toggleEnabled.addEventListener("change", () => {
    chrome.storage.local.set({ enabled: toggleEnabled.checked });
  });

  // 4. Handle sensitivity slider
  thresholdSlider.addEventListener("input", () => {
    const val = thresholdSlider.value;
    thresholdVal.textContent = `${val}%`;
  });

  thresholdSlider.addEventListener("change", () => {
    const threshold = parseFloat(thresholdSlider.value) / 100.0;
    chrome.storage.local.set({ threshold });
  });

  const statImages = document.getElementById("statImages");
  const tabTextBtn = document.getElementById("tabTextBtn");
  const tabImgBtn = document.getElementById("tabImgBtn");
  const textTestPanel = document.getElementById("textTestPanel");
  const imageTestPanel = document.getElementById("imageTestPanel");
  const testImgInput = document.getElementById("testImgInput");
  const testImgBtn = document.getElementById("testImgBtn");
  const testImgResult = document.getElementById("testImgResult");

  // Tab switching
  if (tabTextBtn && tabImgBtn) {
    tabTextBtn.addEventListener("click", () => {
      tabTextBtn.style.background = "#4f46e5";
      tabTextBtn.style.color = "#fff";
      tabImgBtn.style.background = "#334155";
      tabImgBtn.style.color = "#94a3b8";
      textTestPanel.style.display = "block";
      imageTestPanel.style.display = "none";
    });

    tabImgBtn.addEventListener("click", () => {
      tabImgBtn.style.background = "#4f46e5";
      tabImgBtn.style.color = "#fff";
      tabTextBtn.style.background = "#334155";
      tabTextBtn.style.color = "#94a3b8";
      textTestPanel.style.display = "none";
      imageTestPanel.style.display = "block";
    });
  }

  // 5. Query active tab stats
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.runtime.sendMessage({ action: "getTabStats", tabId: tab.id }, (res) => {
        if (res) {
          if (statText) statText.textContent = String(res.textBlurred || 0);
          if (statImages) statImages.textContent = String(res.imagesBlurred || 0);
        }
      });
    }
  } catch (e) {
    // Ignore tab query errors in standalone mode
  }

  // 6. Quick Model Test Box - Text
  async function runQuickTest() {
    const text = testInput.value.trim();
    if (!text) return;

    testBtn.disabled = true;
    testBtn.textContent = "...";
    testResult.style.display = "none";
    testResult.className = "test-result";

    try {
      const threshold = parseFloat(thresholdSlider.value) / 100.0;
      const res = await fetch(`${API_BASE}/predict-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, threshold }),
      });

      if (!res.ok) throw new Error("API returned status " + res.status);
      const data = await res.json();

      if (data.is_flagged) {
        testResult.className = "test-result toxic";
        testResult.innerHTML = `🛡️ <strong>Flagged: Toxic / Vulgar / Violent</strong><br/>Score: ${(data.toxicity_score * 100).toFixed(1)}% | Confidence: ${data.confidence}%`;
      } else {
        testResult.className = "test-result clean";
        testResult.innerHTML = `✅ <strong>Clean / Non-Toxic</strong><br/>Safe confidence: ${data.confidence}% (Score: ${(data.toxicity_score * 100).toFixed(1)}%)`;
      }
      testResult.style.display = "block";
    } catch (err) {
      testResult.className = "test-result toxic";
      testResult.innerHTML = `⚠️ <strong>Error</strong>: ${err.message}. Is API running?`;
      testResult.style.display = "block";
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = "Test";
    }
  }

  testBtn.addEventListener("click", runQuickTest);
  testInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runQuickTest();
  });

  // 7. Quick Model Test Box - Image
  async function runQuickImageTest() {
    const url = testImgInput.value.trim();
    if (!url) return;

    testImgBtn.disabled = true;
    testImgBtn.textContent = "...";
    testImgResult.style.display = "none";
    testImgResult.className = "test-result";

    try {
      const threshold = parseFloat(thresholdSlider.value) / 100.0;
      const res = await fetch(`${API_BASE}/predict-image-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, threshold }),
      });

      if (!res.ok) throw new Error("API returned status " + res.status);
      const data = await res.json();

      if (data.error && !data.is_flagged) {
        testImgResult.className = "test-result toxic";
        testImgResult.innerHTML = `⚠️ <strong>Image Error</strong>: ${data.error}`;
      } else if (data.is_flagged) {
        const cat = (data.category || data.label || "sensitive").toUpperCase();
        testImgResult.className = "test-result toxic";
        testImgResult.innerHTML = `🛡️ <strong>Flagged: ${cat} Image</strong><br/>Confidence: ${data.confidence}% (Violence: ${((data.violence_score||0)*100).toFixed(1)}%, NSFW: ${((data.nsfw_score||0)*100).toFixed(1)}%)`;
      } else {
        testImgResult.className = "test-result clean";
        testImgResult.innerHTML = `✅ <strong>Clean / Safe Image</strong><br/>Safe confidence: ${data.confidence}% (Violence: ${((data.violence_score||0)*100).toFixed(1)}%, NSFW: ${((data.nsfw_score||0)*100).toFixed(1)}%)`;
      }
      testImgResult.style.display = "block";
    } catch (err) {
      testImgResult.className = "test-result toxic";
      testImgResult.innerHTML = `⚠️ <strong>Error</strong>: ${err.message}. Is API running?`;
      testImgResult.style.display = "block";
    } finally {
      testImgBtn.disabled = false;
      testImgBtn.textContent = "Test";
    }
  }

  if (testImgBtn) testImgBtn.addEventListener("click", runQuickImageTest);
  if (testImgInput) {
    testImgInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runQuickImageTest();
    });
  }
});
