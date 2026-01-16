// background.js

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "save-markdown",
        title: "Save Conversation as Markdown",
        contexts: ["page", "selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "save-markdown") {
        // Inject script if needed or just message
        if (tab.url.includes("chatgpt.com") || tab.url.includes("chat.openai.com")) {
            chrome.tabs.sendMessage(tab.id, {action: "get_markdown"}, (response) => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    return;
                }
                
                if (response && response.markdown) {
                    // We can reuse the download logic.
                    // Since background can't directly use the helper in popup, we duplicate or move logic to a shared helper.
                    // For now, simpler to do download here.
                    
                    downloadMarkdown(response.markdown, response.title);
                }
            });
        }
    }
});

function downloadMarkdown(markdown, title) {
    chrome.storage.sync.get(['filenamePattern', 'saveDirectory'], (result) => {
        const pattern = result.filenamePattern || 'ChatGPT_{date}_{time}_{title}';
        const directory = result.saveDirectory || '';
        
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
        const safeTitle = (title || 'Conversation').replace(/[/\\?%*:|"<>]/g, '-').trim();

        let filename = pattern
            .replace('{title}', safeTitle)
            .replace('{date}', dateStr)
            .replace('{time}', timeStr)
            .replace('{id}', Date.now().toString());

        if (!filename.endsWith('.md')) {
            filename += '.md';
        }
        
        // Prepend directory if set
        if (directory) {
             // Normalize slashes
            const cleanDir = directory.replace(/\\/g, '/').replace(/\/$/, '');
            if (cleanDir) {
                filename = cleanDir + '/' + filename;
            }
        }

        const blob = new Blob([markdown], {type: 'text/markdown'});
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = function() {
            chrome.downloads.download({
                url: reader.result,
                filename: filename,
                saveAs: true
            });
        };
    });
}
