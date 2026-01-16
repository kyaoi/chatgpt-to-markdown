document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-btn');
    const statusMsg = document.getElementById('status-msg');
    const settingsPanel = document.getElementById('settings-panel');
    const openSettingsBtn = document.getElementById('open-settings');
    const closeSettingsBtn = document.getElementById('close-settings');
    const filenameInput = document.getElementById('filename-pattern');

    // Load settings
    chrome.storage.sync.get(['filenamePattern'], (result) => {
        if (result.filenamePattern) {
            filenameInput.value = result.filenamePattern;
        } else {
            filenameInput.value = 'ChatGPT_{date}_{time}_{title}'; // Default
        }
    });

    // Event Listeners
    saveBtn.addEventListener('click', () => {
        statusMsg.textContent = 'Processing...';
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0].url && (tabs[0].url.includes('chatgpt.com') || tabs[0].url.includes('chat.openai.com'))) {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'get_markdown'}, (response) => {
                    if (chrome.runtime.lastError) {
                        statusMsg.textContent = 'Error: ' + chrome.runtime.lastError.message;
                    } else if (response && response.markdown) {
                        downloadMarkdown(response.markdown, response.title);
                        statusMsg.textContent = 'Saved!';
                        setTimeout(() => statusMsg.textContent = '', 2000);
                    } else {
                        statusMsg.textContent = 'Failed to content.';
                    }
                });
            } else {
                statusMsg.textContent = 'Please open a ChatGPT conversation.';
            }
        });
    });

    openSettingsBtn.addEventListener('click', () => {
        settingsPanel.classList.remove('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
        // Save settings on close
        chrome.storage.sync.set({filenamePattern: filenameInput.value});
    });

    function downloadMarkdown(markdown, title) {
        chrome.storage.sync.get(['filenamePattern'], (result) => {
            const pattern = result.filenamePattern || 'ChatGPT_{date}_{time}_{title}';
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

            const blob = new Blob([markdown], {type: 'text/markdown'});
            const url = URL.createObjectURL(blob);
            
            chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            });
        });
    }
});
