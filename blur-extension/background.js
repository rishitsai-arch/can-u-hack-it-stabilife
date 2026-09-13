// Content Blur Guard - Background Service Worker (Text Only)

const API_BASE = "http://127.0.0.1:8000";

// Maintain tab stats
const tabStats = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateStats" && sender.tab) {
    const tabId = sender.tab.id;
    const current = tabStats.get(tabId) || { textBlurred: 0 };
    current.textBlurred += message.textBlurred || 0;
    tabStats.set(tabId, current);

    const total = current.textBlurred;
    if (total > 0) {
      chrome.action.setBadgeText({ tabId, text: String(total) });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#EF4444" });
    } else {
      chrome.action.setBadgeText({ tabId, text: "" });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === "getTabStats") {
    const tabId = message.tabId;
    const stats = tabStats.get(tabId) || { textBlurred: 0 };
    sendResponse(stats);
    return true;
  }

  if (message.action === "checkHealth") {
    fetch(`${API_BASE}/health`, { method: "GET" })
      .then((r) => r.json())
      .then((data) => sendResponse({ online: true, data }))
      .catch((err) => sendResponse({ online: false, error: err.message }));
    return true; // async response
  }
});

// Clean up stats when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStats.delete(tabId);
});
