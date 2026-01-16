document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-btn');
    const statusMsg = document.getElementById('status-msg');
    const settingsPanel = document.getElementById('settings-panel');
    const openSettingsBtn = document.getElementById('open-settings');
    const closeSettingsBtn = document.getElementById('close-settings');
    const filenameInput = document.getElementById('filename-pattern');
    const selectFolderBtn = document.getElementById('select-folder-btn');
    const folderNameDisplay = document.getElementById('folder-name');
    const clearFolderBtn = document.getElementById('clear-folder-btn');

    // IDB Helper
    const DB_NAME = 'ChatGPTToMarkdownDB';
    const STORE_NAME = 'settings';
    
    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                event.target.result.createObjectStore(STORE_NAME);
            };
        });
    }

    async function getDirHandle() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('dirHandle');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function saveDirHandle(handle) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(handle, 'dirHandle');
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async function clearDirHandle() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete('dirHandle');
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Load settings
    chrome.storage.sync.get(['filenamePattern'], async (result) => {
        if (result.filenamePattern) {
            filenameInput.value = result.filenamePattern;
        } else {
            filenameInput.value = 'ChatGPT_{date}_{time}_{title}'; // Default
        }
        
        try {
            const handle = await getDirHandle();
            if (handle) {
                folderNameDisplay.textContent = handle.name;
                clearFolderBtn.style.display = 'inline-flex';
            }
        } catch (e) {
            console.error(e);
        }
    });

    selectFolderBtn.addEventListener('click', async () => {
        try {
            const handle = await window.showDirectoryPicker();
            await saveDirHandle(handle);
            folderNameDisplay.textContent = handle.name;
            clearFolderBtn.style.display = 'inline-flex';
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error(e);
                statusMsg.textContent = 'Error selecting folder';
            }
        }
    });

    clearFolderBtn.addEventListener('click', async () => {
        await clearDirHandle();
        folderNameDisplay.textContent = 'No folder selected';
        clearFolderBtn.style.display = 'none';
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
                        saveMarkdown(response.markdown, response.title);
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
        chrome.storage.sync.set({
            filenamePattern: filenameInput.value,
            // Directory is saved via IDB immediately on selection
        });
    });

    async function saveMarkdown(markdown, title) {
        chrome.storage.sync.get(['filenamePattern'], async (result) => {
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

            try {
                const dirHandle = await getDirHandle();
                if (dirHandle) {
                    // Use File System Access API
                    const options = {
                        suggestedName: filename,
                        startIn: dirHandle,
                        types: [{
                            description: 'Markdown File',
                            accept: {'text/markdown': ['.md']},
                        }],
                    };
                    const fileHandle = await window.showSaveFilePicker(options);
                    const writable = await fileHandle.createWritable();
                    await writable.write(markdown);
                    await writable.close();
                    
                    statusMsg.textContent = 'Saved!';
                    setTimeout(() => statusMsg.textContent = '', 2000);
                } else {
                    // Fallback to chrome.downloads
                    const blob = new Blob([markdown], {type: 'text/markdown'});
                    const url = URL.createObjectURL(blob);
                    
                    chrome.downloads.download({
                        url: url,
                        filename: filename,
                        saveAs: true
                    }, () => {
                         if (chrome.runtime.lastError) {
                            statusMsg.textContent = 'Save failed.';
                         } else {
                            statusMsg.textContent = 'Saved via Download!';
                         }
                         setTimeout(() => statusMsg.textContent = '', 2000);
                    });
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                     console.error(e);
                     statusMsg.textContent = 'Save error: ' + e.message;
                } else {
                     statusMsg.textContent = 'Save cancelled';
                }
            }
        });
    }
});
