# ChatGPT to Markdown Extension

A beautiful and efficient Chrome Extension to save your ChatGPT conversations as Markdown files.

## Features

- 📄 **Save as Markdown**: One-click download of your current conversation.
- 🎨 **Beautiful UI**: Modern, clean interface with dark mode support.
- 🔧 **Customizable Filenames**: Configure your preferred filename pattern using variables like `{date}`, `{title}`, and `{time}`.
- 🖱️ **Context Menu**: Right-click anywhere on the page to "Save as Markdown".

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `chatgpt-to-markdown` directory.
5. The extension is now installed and ready to use on [ChatGPT](https://chatgpt.com)!

## Usage

- **Click the extension icon**: Opens the popup where you can save the conversation or change settings.
- **Right-click**: Select "Save Conversation as Markdown" from the context menu.

## Customization

Open the extension popup and click the settings icon to change the filename pattern.
Available variables:
- `{title}`: The conversation title (from page title).
- `{date}`: Current date (YYYY-MM-DD).
- `{time}`: Current time (HH-MM-SS).
- `{id}`: Unique timestamp ID.

## Directory Structure

- `manifest.json`: Extension configuration.
- `popup/`: UI files (HTML, CSS, JS).
- `scripts/`: Logic files (Content script, Background worker, Converter).
- `assets/`: Icons (Placeholder).
