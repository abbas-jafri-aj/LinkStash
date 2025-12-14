// background.js
// 
// This is the "background script" - it runs separately from any webpage.
// Think of it as the extension's central coordinator. It:
// - Sets up the right-click menu
// - Listens for shortcuts
// - Manages storage
// - Coordinates with content scripts
//
// In Chrome (Manifest V3), this runs as a "service worker" which may
// go idle when not in use. We keep logic simple and stateless to
// handle this gracefully.

// Storage key for our links array.
// Using a constant prevents typos across functions.
const STORAGE_KEY = "linkstash_links";

// =============================================================================
// Context Menu Setup
// =============================================================================

// Called when extension is first installed or updated.
// We use this to create our right-click menu item.
chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

function createContextMenu() {
  // Create a single menu item that appears in two contexts:
  // - "link": when user right-clicks on a link
  // - "selection": when user right-clicks on selected text
  //
  // The browser shows our menu item only in these situations.
  chrome.contextMenus.create({
    id: "save-to-linkstash",
    title: "Save to LinkStash",
    contexts: ["link", "selection"]
  });
}

// =============================================================================
// Event Listeners
// =============================================================================

// Fires when user clicks our context menu item.
// 
// Parameters:
// - info: Object containing click context (what was clicked, selection, etc.)
// - tab: The tab where the click happened
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-linkstash") {
    handleLinkCapture(tab, info);
  }
});

// Fires when user presses a registered keyboard shortcut.
// 
// The command name ("save-link") matches what we defined in manifest.json
// under "commands".
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "save-link") {
    handleLinkCapture(tab, null);
  }
});

// =============================================================================
// Content Script Function (injected into page)
// =============================================================================

// This function runs inside the webpage, not in the extension context.
// It has access to the page's DOM but not to extension APIs.
//
// IMPORTANT: This function must be self-contained. It cannot reference
// any variables or functions defined elsewhere in background.js.
//
// Parameters:
// - info: Context menu info object, or null if triggered by shortcut
//
// Returns:
// - { title, url } if a link was found
// - null if nothing valid found
function findLinkOnPage(info) {

  // Helper: Extract domain from URL for fallback title.
  // "https://www.example.com/page" → "example.com"
  function getDomain(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, "");
    } catch {
      return "Link";
    }
  }

  // Helper: Build the result object.
  function makeResult(title, url) {
    // Use domain as fallback if title is empty/whitespace
    const cleanTitle = title?.trim() || getDomain(url);
    return { title: cleanTitle, url: url };
  }

  // ----- Path 1: Context menu on a link -----
  if (info?.linkUrl) {
    // Find the actual <a> element that was clicked.
    // info.linkUrl gives us the URL, but we need the element for its text.
    const links = document.querySelectorAll(`a[href="${info.linkUrl}"]`);
    
    // There might be multiple links with same href. 
    // Best effort: use the first one with text content.
    for (const link of links) {
      const text = link.textContent?.trim();
      if (text) {
        return makeResult(text, info.linkUrl);
      }
    }
    
    // No text found — use domain as title
    return makeResult(null, info.linkUrl);
  }

  // ----- Path 2: Context menu on selected text -----
  if (info?.selectionText) {
    const text = info.selectionText.trim();
    
    // Check if selection is a valid URL
    try {
      const url = new URL(text);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return makeResult(null, text);
      }
    } catch {
      // Not a valid URL — ignore silently
      return null;
    }
  }

  // ----- Path 3: Shortcut — check hover and selection -----
  if (!info) {
    // Check for hovered link first
    const hovered = document.querySelector("a:hover");
    if (hovered?.href) {
      const text = hovered.textContent?.trim();
      return makeResult(text, hovered.href);
    }

    // Check for selected text that might be a URL
    const selection = window.getSelection()?.toString()?.trim();
    if (selection) {
      try {
        const url = new URL(selection);
        if (url.protocol === "http:" || url.protocol === "https:") {
          return makeResult(null, selection);
        }
      } catch {
        // Not a valid URL
        return null;
      }
    }
  }

  // Nothing found
  return null;
}

// =============================================================================
// Link Capture
// =============================================================================

// Main handler for both context menu and shortcut.
// 
// Injects findLinkOnPage into the active tab to extract link information,
// then saves the result if valid.
//
// Parameters:
// - tab: The tab to inject into
// - info: Context menu info (null if triggered by shortcut)
async function handleLinkCapture(tab, info) {
  // Security check: only run on http/https pages.
  // Extensions can't (and shouldn't) run on browser internal pages
  // like about:blank, chrome://, moz-extension://, etc.
  if (!tab.url || !tab.url.match(/^https?:\/\//)) {
    return;
  }

  // Inject findLinkOnPage and execute it.
  // scripting.executeScript returns an array of results (one per frame).
  // We only care about the main frame (index 0).
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: findLinkOnPage,
      args: [info]
    });

    // Content script returns { title, url } or null if nothing found.
    const linkData = results[0]?.result;

    if (linkData && linkData.url) {
      await saveLink(linkData);
    }
  } catch (error) {
    // Injection can fail on restricted pages (browser settings, etc.)
    // We fail silently per the spec — no error shown to user.
    console.error("LinkStash: Could not access page", error);
  }
}

// =============================================================================
// Storage Functions
// =============================================================================

// Save a link if it's not already in the list.
//
// Parameters:
// - linkData: { title, url }
//
// Uses session storage, which automatically clears when browser closes.
// This matches our spec: "links clear when browser closes."
async function saveLink(linkData) {
  const links = await getStoredLinks();

  // Dedupe check: compare URLs only (same URL with different title = duplicate)
  if (isDuplicate(links, linkData.url)) {
    return;
  }

  // Add new link to end of list
  links.push({
    title: linkData.title,
    url: linkData.url
  });

  // Persist to session storage.
  // The sidebar listens for storage changes and will update automatically.
  await chrome.storage.session.set({ [STORAGE_KEY]: links });
}

// Retrieve all stored links.
//
// Returns: Array of { title, url } objects, or empty array if none.
async function getStoredLinks() {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

// Check if a URL is already in the list.
//
// Parameters:
// - links: Array of { title, url }
// - url: URL string to check
//
// Returns: true if duplicate, false otherwise
function isDuplicate(links, url) {
  return links.some(link => link.url === url);
}

// =============================================================================
// Toolbar Button Click
// =============================================================================

// Opens sidebar when user clicks the extension icon.
// Firefox and Chrome use different APIs for this.
chrome.action.onClicked.addListener(async (tab) => {
  // Chrome/Edge: sidePanel API
  if (chrome.sidePanel) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
  // Firefox: sidebarAction API
  else if (chrome.sidebarAction) {
    await chrome.sidebarAction.toggle();
  }
});