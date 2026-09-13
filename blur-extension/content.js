// Content Blur Guard - Content Script
// Scans webpages for vulgar, abusive, toxic, and violent TEXT and blurs it.

(function () {
  "use strict";

  const API_BASE = "http://127.0.0.1:8000";
  const TEXT_BATCH_ENDPOINT = `${API_BASE}/predict-text-batch`;

  // Settings with defaults
  let settings = {
    enabled: true,
    threshold: 0.5,
  };

  // Load user settings
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["enabled", "threshold"], (stored) => {
      if (stored.enabled !== undefined) settings.enabled = stored.enabled;
      if (stored.threshold !== undefined) settings.threshold = stored.threshold;
      if (settings.enabled) {
        scanPage();
      }
    });

    // React to settings changes in real-time
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.enabled) settings.enabled = changes.enabled.newValue;
      if (changes.threshold) settings.threshold = changes.threshold.newValue;

      if (!settings.enabled) {
        unblurAll();
      } else {
        scanPage();
      }
    });
  }

  // Tracking processed text elements
  const processedElements = new WeakSet();

  // Batch queue for text
  let pendingTextQueue = [];
  let batchTimer = null;

  // Stats for this page
  let textBlurredCount = 0;

  function reportStats(newText = 0) {
    textBlurredCount += newText;
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: "updateStats",
        textBlurred: newText,
      }).catch(() => {});
    }
  }

  // -------------------------------------------------------------------------
  // Text Processing & Batching
  // -------------------------------------------------------------------------
  function queueTextElement(el) {
    if (!settings.enabled) return;
    if (processedElements.has(el)) return;

    // Check if element contains direct readable text
    const directText = getDirectText(el);
    if (!directText || directText.length < 8) return;

    processedElements.add(el);
    pendingTextQueue.push({ element: el, text: directText });

    if (!batchTimer) {
      batchTimer = setTimeout(flushTextBatch, 150);
    }
  }

  function getDirectText(el) {
    if (el.childElementCount === 0) {
      return el.innerText ? el.innerText.trim() : (el.textContent ? el.textContent.trim() : "");
    }
    // If element has few children, innerText is fine
    if (el.childElementCount <= 2) {
      return el.innerText ? el.innerText.trim() : "";
    }
    // Otherwise only take immediate text nodes
    let text = "";
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    return text.trim();
  }

  async function flushTextBatch() {
    batchTimer = null;
    if (!settings.enabled || pendingTextQueue.length === 0) {
      return;
    }

    const currentBatch = pendingTextQueue.splice(0, 30); // Max 30 at a time
    const texts = currentBatch.map((item) => item.text);

    function applyResults(results) {
      if (!results || !Array.isArray(results)) return;
      let newlyBlurred = 0;
      results.forEach((res, i) => {
        if (res && res.is_flagged) {
          const item = currentBatch[i];
          if (item && item.element && document.body.contains(item.element)) {
            blurTextElement(item.element, res.confidence, res.toxicity_score);
            newlyBlurred++;
          }
        }
      });
      if (newlyBlurred > 0) {
        reportStats(newlyBlurred);
      }
    }

    // Try via background service worker first (bypasses Mixed Content blocks on HTTPS)
    let processed = false;
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const bgRes = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: "predictTextBatch", texts, threshold: settings.threshold },
            (response) => {
              if (chrome.runtime.lastError || !response || !response.ok) {
                resolve(null);
              } else {
                resolve(response.data);
              }
            }
          );
        });
        if (bgRes && bgRes.results) {
          applyResults(bgRes.results);
          processed = true;
        }
      } catch (e) {
        // Fallback to direct fetch
      }
    }

    // Fallback to direct fetch if background worker is unavailable
    if (!processed) {
      try {
        const response = await fetch(TEXT_BATCH_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts, threshold: settings.threshold }),
        });
        if (response.ok) {
          const data = await response.json();
          applyResults(data.results);
        }
      } catch (err) {
        console.debug("Content Blur Guard: text check error", err.message);
      }
    }

    // If more left in queue, process next batch
    if (pendingTextQueue.length > 0) {
      batchTimer = setTimeout(flushTextBatch, 100);
    }
  }

  function blurTextElement(el, confidence, score) {
    if (el.classList.contains("cbg-blurred-text")) return;

    el.classList.add("cbg-blurred-text");
    el.setAttribute(
      "data-cbg-info",
      `Shielded: Vulgar / Toxic / Violent (${confidence}% confidence) - Click to toggle`
    );

    // Click to toggle reveal
    el.addEventListener("click", function handleToggle() {
      if (el.classList.contains("cbg-blurred-text")) {
        el.classList.remove("cbg-blurred-text");
        el.classList.add("cbg-revealed");
      } else if (el.classList.contains("cbg-revealed")) {
        el.classList.remove("cbg-revealed");
        el.classList.add("cbg-blurred-text");
      }
    });
  }

  // -------------------------------------------------------------------------
  // Page Scanning & Observers (Text Only)
  // -------------------------------------------------------------------------
  const textSelector = "p, span, h1, h2, h3, h4, h5, h6, li, blockquote, article, .comment, [role='article']";

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        queueTextElement(el);
        intersectionObserver.unobserve(el);
      }
    },
    { rootMargin: "350px" } // Pre-scan slightly before scrolling into view
  );

  function observeNewNode(node) {
    if (!(node instanceof HTMLElement)) return;

    if (node.matches && node.matches(textSelector)) {
      intersectionObserver.observe(node);
    }

    if (node.querySelectorAll) {
      node.querySelectorAll(textSelector).forEach((el) => intersectionObserver.observe(el));
    }
  }

  function scanPage() {
    document.querySelectorAll(textSelector).forEach((el) => intersectionObserver.observe(el));
  }

  function unblurAll() {
    document.querySelectorAll(".cbg-blurred-text").forEach((el) => {
      el.classList.remove("cbg-blurred-text");
    });
  }

  // Initial Scan
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scanPage);
  } else {
    scanPage();
  }

  // MutationObserver for dynamically added text (Twitter, Reddit, YouTube comments)
  const mutationObserver = new MutationObserver((mutations) => {
    if (!settings.enabled) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        observeNewNode(node);
      }
    }
  });

  mutationObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
