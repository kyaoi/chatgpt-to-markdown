// content.js
// Listens for messages and orchestrates conversion

const converter = new MarkdownConverter();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "get_markdown") {
        try {
            const markdown = converter.convert(document.body);
            const title = document.title.replace('ChatGPT', '').trim() || "Conversation";
            sendResponse({markdown: markdown, title: title});
        } catch (e) {
            console.error('Conversion Failed', e);
            sendResponse({error: e.message});
        }
    }
    return true; // Keep channel open
});

console.log("ChatGPT to Markdown extension loaded.");
