document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-btn');
    const statusMsg = document.getElementById('status-msg');
    const settingsPanel = document.getElementById('settings-panel');
    const openSettingsBtn = document.getElementById('open-settings');
    const closeSettingsBtn = document.getElementById('close-settings');
    const exportBtn = document.getElementById('export-settings-btn');
    const importBtn = document.getElementById('import-settings-btn');
    const importFileInput = document.getElementById('import-file-input');

    // UI Elements
    const previewFilename = document.getElementById('preview-filename');
    const previewDate = document.getElementById('preview-date');
    const connectionStatus = document.getElementById('connection-status');

    // Settings elements
    const filenameInput = document.getElementById('filename-pattern');
    const selectFolderBtn = document.getElementById('select-folder-btn');
    const folderNameDisplay = document.getElementById('folder-name');
    const clearFolderBtn = document.getElementById('clear-folder-btn');
    // subfolder-name removed
    const frontmatterInput = document.getElementById('frontmatter-template');
    const subfolderInput = document.getElementById('subfolder-name'); // Might be null but ID exists? Check HTML. input removed?
    // In popup.html we removed subfolderName? Yes.
    // But `chrome.storage.sync.get... subfolderName` relies on it?
    // Line 76: get(['subfolderName'])
    // Line 83: if (result.subfolderName) { subfolderInput.value = ... }
    // If subfolderInput is null, line 84 throws error.
    // I should check if I should remove subfolderName usage.
    // User requested "No input field". The "subfolder" logic was for the old mechanism.
    // I should likely remove subfolderInput related code too.


    // State
    const DEFAULT_PATTERN = '{title}_{date}_{time}';

    // State
    let currentTitle = '';
    let currentUrl = '';

    // Initialize Preview
    function initPreview() {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0].url && (tabs[0].url.includes('chatgpt.com') || tabs[0].url.includes('chat.openai.com'))) {
                // Connected
                if(connectionStatus) connectionStatus.classList.add('connected');
                
                // Get Title
                let title = tabs[0].title || 'Conversation';
                title = title.replace('ChatGPT', '').replace(/ - OpenAI$/, '').trim();
                if(!title) title = 'Conversation';

                // Generate Preview Filename
                chrome.storage.sync.get(['filenamePattern'], (res) => {
                    const pattern = res.filenamePattern || DEFAULT_PATTERN;
                    const filename = generateFilename(pattern, title);
                    
                    if(previewFilename) previewFilename.textContent = filename;
                    
                    const date = new Date();
                    if(previewDate) previewDate.textContent = date.toLocaleString();
                });

            } else {
                 if(previewFilename) previewFilename.textContent = 'No ChatGPT Tab Detected';
                 if(previewDate) previewDate.textContent = 'Please open ChatGPT';
                 if(statusMsg) statusMsg.textContent = 'Please open a ChatGPT conversation.';
            }
        });
    }

    // Call init
    initPreview();

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

    // Default Frontmatter
    const DEFAULT_FRONTMATTER = '';

    // Load settings
    chrome.storage.sync.get(['filenamePattern', 'frontmatterTemplate'], async (result) => {
        if (result.filenamePattern) {
            filenameInput.value = result.filenamePattern;
        } else {
            filenameInput.value = DEFAULT_PATTERN;
        }
        
        if (result.frontmatterTemplate !== undefined) {
             frontmatterInput.value = result.frontmatterTemplate;
        } else {
             frontmatterInput.value = DEFAULT_FRONTMATTER;
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

    // Save settings on input change
    function saveSettings() {
        chrome.storage.sync.set({
            filenamePattern: filenameInput.value,
            frontmatterTemplate: frontmatterInput.value
        }, () => {
             // Re-init preview to reflect pattern changes
             initPreview();
        });
    }

    filenameInput.addEventListener('input', saveSettings);
    frontmatterInput.addEventListener('input', saveSettings);

    // selectFolderBtn listener
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

    // Export Settings
    exportBtn.addEventListener('click', () => {
        chrome.storage.sync.get(null, (items) => {
            const json = JSON.stringify(items, null, 2);
            const blob = new Blob([json], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            chrome.downloads.download({
                url: url,
                filename: 'chatgpt_to_markdown_settings.json',
                saveAs: true
            });
        });
    });

    // Import Settings
    importBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const settings = JSON.parse(event.target.result);
                chrome.storage.sync.set(settings, () => {
                    statusMsg.textContent = 'Settings imported!';
                    
                    // Update UI
                    if(settings.filenamePattern) filenameInput.value = settings.filenamePattern;
                    if(settings.frontmatterTemplate !== undefined) frontmatterInput.value = settings.frontmatterTemplate;
                    
                    initPreview();
                    setTimeout(() => statusMsg.textContent = '', 2000);
                });
            } catch (err) {
                statusMsg.textContent = 'Invalid JSON file.';
            }
        };
        reader.readAsText(file);
    });

    // Helper: Generate Filename
    function generateFilename(pattern, title) {
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
        return filename;
    }

    function saveMarkdownDirect(rawMarkdown, title, url, dirHandle, filename) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(['frontmatterTemplate'], async (result) => {
                 const template = result.frontmatterTemplate !== undefined ? result.frontmatterTemplate : DEFAULT_FRONTMATTER;
                 
                 let finalMarkdown = rawMarkdown;
    
                 if (template && template.trim() !== '') {
                     const date = new Date();
                     const dateStr = date.toISOString().split('T')[0];
                     const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
                     const safeTitle = (title || 'Conversation').replace(/[/\\?%*:|"<>]/g, '-').trim();
        
                     // displayFolderName = dirHandle.name
                     const displayFolderName = dirHandle.name;
        
                     let frontmatter = template
                        .replace(/{folder}/g, displayFolderName)
                        .replace(/{title}/g, safeTitle)
                        .replace(/{url}/g, url || '')
                        .replace(/{date}/g, dateStr)
                        .replace(/{time}/g, timeStr);
                     
                     finalMarkdown = frontmatter + rawMarkdown;
                 }
    
                 try {
                    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(finalMarkdown);
                    await writable.close();
    
                    statusMsg.textContent = `Saved to ${dirHandle.name}!`;
                    setTimeout(() => statusMsg.textContent = '', 3000);
                    resolve();
                 } catch (e) {
                     console.error(e);
                     statusMsg.textContent = 'Write error: ' + e.message;
                     reject(e);
                 }
            });
        });
    }

    // Event Listeners

    saveBtn.addEventListener('click', () => {
        statusMsg.textContent = 'Processing...';
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0].url && (tabs[0].url.includes('chatgpt.com') || tabs[0].url.includes('chat.openai.com'))) {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'get_markdown'}, async (response) => {
                    if (chrome.runtime.lastError) {
                        statusMsg.textContent = 'Error: ' + chrome.runtime.lastError.message;
                    } else if (response && response.markdown) {
                        try {
                            // 1. Get StartIn Handle
                            let startInHandle = undefined;
                            try {
                                startInHandle = await getDirHandle();
                            } catch (e) {
                                // Ignore if no default handle
                            }

                            // 2. Open Directory Picker
                            const finalDirHandle = await window.showDirectoryPicker({
                                id: 'save-folder-picker',
                                startIn: startInHandle,
                                mode: 'readwrite'
                            });
                            
                            // 3. Generate Filename (Need pattern from settings)
                            chrome.storage.sync.get(['filenamePattern'], async (res) => {
                                try {
                                    const pattern = res.filenamePattern || DEFAULT_PATTERN;
                                    const filename = generateFilename(pattern, response.title);
                                    
                                    // 4. Save Content FIRST
                                    await saveMarkdownDirect(response.markdown, response.title, tabs[0].url, finalDirHandle, filename);
                                    
                                    // 5. Save Handle LAST (Only if write succeeded)
                                    await saveDirHandle(finalDirHandle);
                                    
                                    folderNameDisplay.textContent = finalDirHandle.name;
                                    clearFolderBtn.style.display = 'inline-flex';
                                } catch (innerErr) {
                                    console.error("Save failed:", innerErr);
                                    // statusMsg handled in saveMarkdownDirect
                                }
                            });

                        } catch (e) {
                            if (e.name !== 'AbortError') {
                                console.error(e);
                                statusMsg.textContent = 'Save cancelled or failed.';
                            } else {
                                statusMsg.textContent = ''; // Cancelled
                            }
                        }
                    } else {
                        statusMsg.textContent = 'Failed to get content.';
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
    });

});
