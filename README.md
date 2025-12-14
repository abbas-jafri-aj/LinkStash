# LinkStash

A browser extension for Firefox and Chrome that collects links as Plain URLs or Markdown and stores them in a sidebar for easy copying.

## Features

- Right-click any link to save as Plain URL or Markdown (`[Link Title](URL)`)
- Right-click selected URL text to save it
- Keyboard shortcut: `Ctrl+Shift+L` (Windows/Linux) / `Cmd+Shift+L` (Mac)
- Sidebar displays collected links
- Copy all links as plain text or bulleted list
- Copy or delete individual links
- Toggle Markdown formatting (global or per-link)
- Automatic deduplication
- Links clear when browser closes

## Usage

1. Right-click a link → "Save to LinkStash"
2. Or hover/select a link and press `Ctrl+Shift+L`
3. Open sidebar to view collected links
4. Copy all (plain or bulleted) or manage individual links
5. Check "As Markdown" for `[title](url)` format, uncheck for plain URLs

## GIF

![LinkStash demo](linkstash.gif)

## Link Format

**With Markdown (checkbox checked):**
```
[Link Title](https://example.com)
```

**Without Markdown (checkbox unchecked):**
```
https://example.com
```

**Copy formats:**

Plain:
```
[First Link](https://example.com)
[Second Link](https://other.com)
```

Bulleted:
```
- [First Link](https://example.com)
- [Second Link](https://other.com)
```

## Install (Development)

**Note:** The extension includes `manifest.firefox.json` and `manifest.chrome.json`. Browsers require the file to be named `manifest.json`. Copy the appropriate file before loading:

- Firefox: `cp manifest.firefox.json manifest.json`
- Chrome/Edge: `cp manifest.chrome.json manifest.json`

### Firefox
1. Copy `manifest.firefox.json` to `manifest.json`
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `manifest.json`

### Chrome
1. Copy `manifest.chrome.json` to `manifest.json`
2. Open `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select extension folder

### Edge

Edge is Chromium-based and uses `manifest.chrome.json`. However, Edge has quirks:

- **Shortcut conflict:** `Ctrl+Shift+L` is captured by Edge for link search. Remap manually via `edge://extensions/shortcuts`, or use the context menu.
- **Hover preview:** Edge's link preview feature can interfere with hover detection. Disable in Settings → Appearance → "Show link preview".
- **Sidebar toggle:** Clicking the toolbar icon opens the sidebar but does not toggle it. Close via the X button on the panel.

## Packaging

### Firefox
```bash
cp manifest.firefox.json manifest.json
zip -r linkstash-firefox.zip manifest.json background.js sidebar/ icons/
```

Or with 7-Zip:
```bash
cp manifest.firefox.json manifest.json
7z a linkstash-firefox.zip manifest.json background.js sidebar/ icons/
```

### Chrome/Edge
```bash
cp manifest.chrome.json manifest.json
zip -r linkstash-chrome.zip manifest.json background.js sidebar/ icons/
```

Or with 7-Zip:
```bash
cp manifest.chrome.json manifest.json
7z a linkstash-chrome.zip manifest.json background.js sidebar/ icons/
```

### Signing

Both Firefox and Chrome require extensions to be signed for permanent installation:

- **Firefox:** Submit to [Firefox Add-ons](https://addons.mozilla.org/developers/) for signing
- **Chrome/Edge:** Publish to [Chrome Web Store](https://chrome.google.com/webstore/devconsole/)

Unsigned extensions can only be loaded temporarily in developer mode.

## Architecture

- `manifest.json` - Extension configuration, permissions, shortcuts
- `background.js` - Context menu, shortcut handling, storage coordination
- `sidebar/` - UI for viewing and managing collected links

## Permissions

- `activeTab` - Access current tab only when user initiates action
- `contextMenus` - Right-click menu
- `storage` - Session storage (clears on browser close)
- `scripting` - Inject content script to read link data from page

## Code Comments

The code is heavily commented. This was a learning project for browser extension development, so comments explain not just "why" but also browser extension concepts and APIs.

## License

GPL-3.0