// sidebar.js
//
// Handles the sidebar UI: displaying links, copy actions, delete actions.
// Listens for storage changes to auto-update when background.js saves new links.

// Must match the key used in background.js
const STORAGE_KEY = "linkstash_links";

// =============================================================================
// DOM Elements
// =============================================================================

const linksList = document.getElementById("links-list");
const emptyState = document.getElementById("empty-state");
const copyPlainBtn = document.getElementById("copy-plain");
const copyBulletedBtn = document.getElementById("copy-bulleted");
const globalMarkdownCheckbox = document.getElementById("global-markdown");
const deleteAllBtn = document.getElementById("delete-all");

// =============================================================================
// Initialization
// =============================================================================

// Load existing links when sidebar opens
document.addEventListener("DOMContentLoaded", async () => {
  const links = await getStoredLinks();
  renderLinks(links);
});

// Listen for storage changes.
// Fires whenever background.js saves a new link.
// This keeps sidebar in sync without manual refresh.
chrome.storage.session.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY]) {
    renderLinks(changes[STORAGE_KEY].newValue || []);
  }
});

// =============================================================================
// Rendering
// =============================================================================

// Rebuild the entire links list.
// Simple approach: clear and recreate. Fine for small lists.
//
// Parameters:
// - links: Array of { title, url }
function renderLinks(links) {
  // Clear current list
  linksList.innerHTML = "";

  // Show/hide empty state
  if (links.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  // Create list item for each link
  links.forEach((link, index) => {
    const li = createLinkItem(link, index);
    linksList.appendChild(li);
  });
}

// Create a single list item element.
//
// Structure:
// <li>
//   <a href="..." target="_blank">Link Title</a>
//   <button>Copy</button>
//   <button>Delete</button>
// </li>
//
// Parameters:
// - link: { title, url }
// - index: Position in array (used for delete)
function createLinkItem(link, index) {
  const li = document.createElement("li");

  // Clickable link — opens in new tab
  const anchor = document.createElement("a");
  anchor.href = link.url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";  // Security: prevent tab hijacking
  anchor.textContent = link.title;

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "link-buttons";

  const markdownLabel = document.createElement("label");
  markdownLabel.className = "checkbox-label";
  const markdownCheckbox = document.createElement("input");
  markdownCheckbox.type = "checkbox";
  markdownLabel.appendChild(markdownCheckbox);
  markdownLabel.appendChild(document.createTextNode("As Markdown"));

  // Copy button for this single link
  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy";
  copyBtn.title = "Copy this link";
  copyBtn.addEventListener("click", () => {
    copyToClipboard(formatLink(link, markdownCheckbox.checked));
  });

  // Delete button
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.title = "Remove this link";
  deleteBtn.addEventListener("click", () => {
    deleteLink(index);
  });

  li.appendChild(anchor);
  buttonContainer.appendChild(copyBtn);
  buttonContainer.appendChild(markdownLabel);
  buttonContainer.appendChild(deleteBtn);
  li.appendChild(buttonContainer); 

  return li;
}

// =============================================================================
// Formatting
// =============================================================================

// Format a single link as Markdown.
// Parameters:
// - link: { title, url }
// - asMarkdown: boolean — if true, format as [title](url), else just url
function formatLink(link, asMarkdown) {
  if (asMarkdown) {
    return `[${link.title}](${link.url})`;
  }
  return link.url;
}

// Format all links as plain text (one per line).
function formatAllPlain(links, asMarkdown) {
  return links.map(link => formatLink(link, asMarkdown)).join("\n");
}

// Format all links as bulleted list.
function formatAllBulleted(links, asMarkdown) {
  return links.map(link => `- ${formatLink(link, asMarkdown)}`).join("\n");
}

// =============================================================================
// Actions
// =============================================================================

// Copy text to clipboard.
// Uses modern Clipboard API.
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error("LinkStash: Failed to copy", error);
  }
}

// Delete a link by index.
async function deleteLink(index) {
  const links = await getStoredLinks();
  links.splice(index, 1);
  await chrome.storage.session.set({ [STORAGE_KEY]: links });
  // No need to call renderLinks — storage listener handles it
}

// =============================================================================
// Storage Helper
// =============================================================================

// Same function as background.js — duplicated to keep files independent.
async function getStoredLinks() {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

// =============================================================================
// Button Handlers
// =============================================================================

copyPlainBtn.addEventListener("click", async () => {
  const links = await getStoredLinks();
  if (links.length > 0) {
    copyToClipboard(formatAllPlain(links, globalMarkdownCheckbox.checked));
  }
});

copyBulletedBtn.addEventListener("click", async () => {
  const links = await getStoredLinks();
  if (links.length > 0) {
    copyToClipboard(formatAllBulleted(links, globalMarkdownCheckbox.checked));
  }
});

deleteAllBtn.addEventListener("click", async () => {
  const links = await getStoredLinks();
  if (links.length === 0) {
    return;
  }
  
  const confirmed = confirm(`Delete all ${links.length} links?`);
  if (confirmed) {
    await chrome.storage.session.set({ [STORAGE_KEY]: [] });
  }
});