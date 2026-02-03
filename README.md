# ChatGPT to Markdown Extension

A beautiful and efficient Chrome Extension to save your ChatGPT conversations as Markdown files, featuring advanced Project support and Bulk Export.

## Features

- 📄 **Save as Markdown**: One-click download of your current conversation.
- 📂 **Bulk Export Manager**: Export multiple conversations from any Project (or Personal context) at once.
- 🔍 **Smart Project Discovery**: Automatically detects all your ChatGPT Projects by intercepting network API calls (including those hidden behind "Show more").
- 🎨 **Modern Modal UI**: A clean, center-aligned project manager with real-time search and filtering.
- ⚡ **Robust Scanning**: Intelligent retry mechanism and dynamic waiting to handle slow-loading pages and ensure no conversation is missed.
- 🔧 **Customizable Filenames**: Configure your preferred filename pattern using variables like `{date}`, `{title}`, and `{time}`.
- 🌑 **Dark Mode**: Fully compatible with ChatGPT's interface.

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `chatgpt-to-markdown` directory.
5. The extension is now installed and ready to use on [ChatGPT](https://chatgpt.com)!

## Usage

### Single Export
1. Open any ChatGPT conversation.
2. Click the extension icon and click **"Save as Markdown"**.

### Bulk Export (Project Mode)
1. Open ChatGPT.
2. Click the extension icon and click **"Open Bulk Export"**.
3. Select a Project from the modal list (use the search bar to find specific projects).
4. Click **"Start Export"**. The extension will automatically navigate and scan all conversations in that project.
5. Once scanning is complete, customize your tags and click **"Save to Device"**.

## Customization

Open the extension popup and click the settings icon to change:
- **Filename Pattern**: Use variables like `{title}`, `{date}`, `{time}`, `{id}`.
- **Frontmatter Template**: Customize the YAML frontmatter for each saved file.
- **Default Tags**: Set tags to be automatically added to your exported files.

## Technical Highlights

- **Main World Injection**: Uses a background interceptor (`project_interceptor.js`) injected into the page's main world to capture network responses from ChatGPT's internal APIs.
- **Observer Pattern**: Implements a listener-based update system for the project list, ensuring real-time synchronization between API data and the UI.
- **File System Access API**: High-performance, bulk file saving directly to your local folders.

## Directory Structure

- `manifest.json`: Extension configuration.
- `popup/`: Popup UI (HTML, CSS, JS).
- `scripts/`:
  - `content.js`: Main logic, UI injection, and automation.
  - `project_interceptor.js`: Main-world script for API interception.
  - `converter.js`: HTML to Markdown conversion logic.
  - `file_saver.js`: File system abstraction and filename generation.
- `assets/`: Extension icons.
