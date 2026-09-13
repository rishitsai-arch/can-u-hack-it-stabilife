// Content Blur Guard - Universal Content Script
// Automatically detects and blurs vulgar, abusive, toxic, and violent text across ALL websites and HTML elements.

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

  // -------------------------------------------------------------------------
  // Universal DOM Text Engine (TreeWalker)
  // -------------------------------------------------------------------------
  // Tags that must never be scanned or blurred
  const IGNORED_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE",
    "PRE", "SVG", "CANVAS", "VIDEO", "AUDIO", "IFRAME", "SELECT",
    "OPTION", "HEAD", "TITLE", "META", "LINK"
  ]);

  // Inline styling tags that can be part of a sentence
  const INLINE_TAGS = new Set([
    "B", "STRONG", "I", "EM", "A", "SPAN", "MARK", "U", "SMALL", "SUB", "SUP", "FONT"
  ]);

  // Tracking processed text elements
  const processedElements = new WeakSet();

  // Batch queue for text
  let pendingTextQueue = [];
  let batchTimer = null;

  // Stats for this page
  let textBlurredCount = 0;
  let imagesBlurredCount = 0;

  function reportStats(newText = 0, newImages = 0) {
    textBlurredCount += newText;
    imagesBlurredCount += newImages;
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: "updateStats",
        textBlurred: newText,
        imagesBlurred: newImages,
      }).catch(() => {});
    }
  }

  /**
   * Finds universal leaf text elements under a root node.
   * Works on any website regardless of HTML tag (custom components, divs, p, td, li, etc.).
   */
  function findTextLeafElements(root = document.body) {
    if (!root || !(root instanceof Node)) return [];
    
    // If root itself is an ignored tag, skip
    if (root.nodeType === Node.ELEMENT_NODE && IGNORED_TAGS.has(root.tagName)) {
      return [];
    }

    const candidateElements = new Set();
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (IGNORED_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.classList.contains("cbg-blurred-text") || parent.classList.contains("cbg-revealed")) {
            return NodeFilter.FILTER_REJECT;
          }
          if (processedElements.has(parent)) return NodeFilter.FILTER_REJECT;

          const text = node.textContent.trim();
          if (text.length < 6) return NodeFilter.FILTER_REJECT;

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      let target = textNode.parentElement;

      // Climb up inline tags (e.g. <b>, <i>, <a>) to the nearest coherent sentence/block container
      while (
        target &&
        target.parentElement &&
        INLINE_TAGS.has(target.tagName) &&
        !IGNORED_TAGS.has(target.parentElement.tagName) &&
        target.parentElement.childElementCount <= 5
      ) {
        target = target.parentElement;
      }

      if (target && !processedElements.has(target) && !candidateElements.has(target)) {
        candidateElements.add(target);
      }
    }

    return Array.from(candidateElements);
  }

  function getCleanElementText(el) {
    if (!el) return "";
    // If element has few children, innerText gives the exact rendered sentence
    if (el.childElementCount <= 4) {
      const text = el.innerText || el.textContent || "";
      return text.trim();
    }
    // Otherwise extract immediate text
    let text = "";
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE && INLINE_TAGS.has(node.tagName)) {
        text += " " + (node.innerText || node.textContent || "");
      }
    }
    return text.trim();
  }

  function queueTextElement(el) {
    if (!settings.enabled || !el) return;
    if (processedElements.has(el)) return;

    const directText = getCleanElementText(el);
    if (!directText || directText.length < 6) return;

    processedElements.add(el);
    pendingTextQueue.push({ element: el, text: directText });

    if (!batchTimer) {
      batchTimer = setTimeout(flushTextBatch, 120);
    }
  }

  // -------------------------------------------------------------------------
  // Batch Execution
  // -------------------------------------------------------------------------
  async function flushTextBatch() {
    batchTimer = null;
    if (!settings.enabled || pendingTextQueue.length === 0) {
      return;
    }

    const currentBatch = pendingTextQueue.splice(0, 30); // Max 30 per batch
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

    // 1. Try background worker first (bypasses HTTPS Mixed-Content restrictions)
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

    // 2. Direct fetch fallback
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

    // Continue processing remaining items in queue
    if (pendingTextQueue.length > 0) {
      batchTimer = setTimeout(flushTextBatch, 80);
    }
  }

  function blurTextElement(el, confidence, score) {
    if (!el || el.classList.contains("cbg-blurred-text")) return;

    el.classList.add("cbg-blurred-text");
    el.setAttribute(
      "data-cbg-info",
      `Shielded: Vulgar / Toxic / Violent (${confidence}% confidence) - Click to toggle`
    );

    // Click to toggle reveal
    el.addEventListener("click", function handleToggle(e) {
      // If clicking inside a link or button, prevent default navigation when revealing
      if (el.classList.contains("cbg-blurred-text")) {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove("cbg-blurred-text");
        el.classList.add("cbg-revealed");
      } else if (el.classList.contains("cbg-revealed")) {
        el.classList.remove("cbg-revealed");
        el.classList.add("cbg-blurred-text");
      }
    });
  }

  // -------------------------------------------------------------------------
  // Page Scanning & Dynamic Observers
  // -------------------------------------------------------------------------
  // Pre-scan elements lazily when they approach the viewport
  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        queueTextElement(el);
        intersectionObserver.unobserve(el);
      }
    },
    { rootMargin: "450px" } // Pre-scan slightly before scrolling into view
  );

  function processCandidates(elements) {
    for (const el of elements) {
      intersectionObserver.observe(el);
    }
  }

  // -------------------------------------------------------------------------
  // Universal Image Moderation Engine
  // -------------------------------------------------------------------------
  const processedImages = new WeakSet();

  const imageIntersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const img = entry.target;
        checkAndModerateImage(img);
        imageIntersectionObserver.unobserve(img);
      }
    },
    { rootMargin: "350px" }
  );

  function observeImage(img) {
    if (!settings.enabled || !img || processedImages.has(img)) return;

    const src = img.currentSrc || img.src;
    if (!src || src.length < 5) return;

    // Skip tracking pixels or tiny icons
    if (img.complete && (img.naturalWidth < 40 || img.naturalHeight < 40)) {
      return;
    }

    imageIntersectionObserver.observe(img);
  }

  function scanImages(root = document.body) {
    if (!settings.enabled || !root) return;
    if (root instanceof HTMLImageElement) {
      observeImage(root);
      return;
    }
    if (root.querySelectorAll) {
      root.querySelectorAll("img").forEach(observeImage);
    }
  }

  async function checkAndModerateImage(img) {
    if (!settings.enabled || processedImages.has(img)) return;
    processedImages.add(img);

    const src = img.currentSrc || img.src;
    if (!src) return;

    // Send through background worker to bypass CORS and Mixed-Content
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({ action: "predictImageUrl", url: src }, (res) => {
          if (chrome.runtime.lastError || !res || !res.ok) return;
          const data = res.data;
          if (data && (data.is_flagged || data.is_violence || data.is_nsfw)) {
            const cat = data.category || data.label || "sensitive";
            blurImageElement(img, cat, data.confidence);
            reportStats(0, 1);
          }
        });
      } catch (e) {
        // Extension context invalidated
      }
    }
  }

  function blurImageElement(img, category, confidence) {
    if (!img || img.classList.contains("cbg-blurred-image")) return;

    img.classList.add("cbg-blurred-image");
    img.setAttribute(
      "data-cbg-info",
      `Shielded: ${category.toUpperCase()} Image (${confidence}% confidence) - Click to toggle`
    );

    img.addEventListener("click", function handleImageClick(e) {
      e.preventDefault();
      e.stopPropagation();
      if (img.classList.contains("cbg-blurred-image")) {
        img.classList.remove("cbg-blurred-image");
        img.classList.add("cbg-image-revealed");
      } else if (img.classList.contains("cbg-image-revealed")) {
        img.classList.remove("cbg-image-revealed");
        img.classList.add("cbg-blurred-image");
      }
    });
  }

  function scanPage() {
    if (!document.body) return;
    const elements = findTextLeafElements(document.body);
    processCandidates(elements);
    scanImages(document.body);
  }

  function unblurAll() {
    document.querySelectorAll(".cbg-blurred-text").forEach((el) => {
      el.classList.remove("cbg-blurred-text");
    });
    document.querySelectorAll(".cbg-blurred-image").forEach((el) => {
      el.classList.remove("cbg-blurred-image");
    });
  }

  // Initial Scan
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scanPage);
  } else {
    scanPage();
  }

  // MutationObserver for dynamic SPAs (Twitter/X, Reddit, YouTube comments, Discord, etc.)
  let mutationTimeout = null;
  const mutationNodes = new Set();

  function flushMutations() {
    mutationTimeout = null;
    const toProcess = Array.from(mutationNodes);
    mutationNodes.clear();

    for (const node of toProcess) {
      if (node.isConnected) {
        const elements = findTextLeafElements(node);
        processCandidates(elements);
        scanImages(node);
      }
    }
  }

  const mutationObserver = new MutationObserver((mutations) => {
    if (!settings.enabled) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && !IGNORED_TAGS.has(node.tagName)) {
          mutationNodes.add(node);
        }
      }
    }

    if (!mutationTimeout && mutationNodes.size > 0) {
      mutationTimeout = setTimeout(flushMutations, 100);
    }
  });

  mutationObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
