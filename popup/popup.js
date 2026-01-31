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
    const launchBulkBtn = document.getElementById('launch-bulk-btn');
    // subfolder-name removed
    const frontmatterInput = document.getElementById('frontmatter-template');
    const defaultTagsInput = document.getElementById('default-tags'); // Added missing definition
    const subfolderInput = document.getElementById('subfolder-name'); 

    // State
    const DEFAULT_PATTERN = '{title}_{date}_{time}';
    
    // ...

    // Default Frontmatter
    const DEFAULT_FRONTMATTER = '';
    const DEFAULT_TAGS = ''; // Added missing constant
    // In popup.html we removed subfolderName? Yes.
    // But `chrome.storage.sync.get... subfolderName` relies on it?
    // Line 76: get(['subfolderName'])
    // Line 83: if (result.subfolderName) { subfolderInput.value = ... }
    // If subfolderInput is null, line 84 throws error.
    // I should check if I should remove subfolderName usage.
    // User requested "No input field". The "subfolder" logic was for the old mechanism.
    // I should likely remove subfolderInput related code too.


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

    // Load settings
    chrome.storage.sync.get({
        filenamePattern: DEFAULT_PATTERN,
        frontmatterTemplate: DEFAULT_FRONTMATTER,
        defaultTags: DEFAULT_TAGS
    }, async (result) => {
        filenameInput.value = result.filenamePattern;
        frontmatterInput.value = result.frontmatterTemplate;
        if (defaultTagsInput) defaultTagsInput.value = result.defaultTags;
        
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
            frontmatterTemplate: frontmatterInput.value,
            defaultTags: defaultTagsInput ? defaultTagsInput.value : DEFAULT_TAGS
        }, () => {
             // Re-init preview to reflect pattern changes
             initPreview();
        });
    }

    filenameInput.addEventListener('input', saveSettings);
    frontmatterInput.addEventListener('input', saveSettings);
    if (defaultTagsInput) defaultTagsInput.addEventListener('input', saveSettings);

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
    // Note: The input is now overlaying the button, so we don't need a click listener on the button.
    // importBtn.addEventListener('click', () => { importFileInput.click(); });

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
        const safeTitle = (title || 'Conversation').replace(/[/\\?%*:|"<>]/g, '-').trim().substring(0, 100);

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
             // Retrieve defaults and template
             chrome.storage.sync.get({
                defaultTags: DEFAULT_TAGS,
                frontmatterTemplate: DEFAULT_FRONTMATTER
             }, async (settings) => {
                 let finalMarkdown = rawMarkdown;
                 const template = settings.frontmatterTemplate;
                 const defaultTags = settings.defaultTags;
                 
                 // --- Frontmatter Processing ---
                 if (template && template.trim() !== '') {
                     const date = new Date();
                     const dateStr = date.toISOString().split('T')[0];
                     const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
                     const safeTitle = (title || 'Conversation').replace(/[/\\?%*:|"<>]/g, '-').trim();
                     const displayFolderName = dirHandle.name;

                     // Variable Substitution for Tags
                     let processedTags = defaultTags || '';
                     processedTags = processedTags
                             .replace(/{title}/g, safeTitle)
                             .replace(/{date}/g, dateStr)
                             .replace(/{time}/g, timeStr)
                             .replace(/{folder}/g, displayFolderName);
                     
                     // Format tags as [tag1, tag2]
                     const tagArrayString = '[' + processedTags.split(',').map(t => t.trim()).filter(Boolean).join(', ') + ']';

                     const frontmatter = template
                        .replace(/{folder}/g, displayFolderName)
                        .replace(/{title}/g, safeTitle)
                        .replace(/{url}/g, url || '')
                        .replace(/{date}/g, dateStr)
                        .replace(/{time}/g, timeStr)
                        .replace(/{tags}/g, tagArrayString);
                     
                     finalMarkdown = frontmatter + rawMarkdown;
                 }

                 // --- File Writing Logic ---
                 try {
                    // Image Extraction
                    const imgRegex = /!\[(.*?)\]\((data:image\/([^;]+);base64,[^)]+)\)/g;
                    const matches = [...finalMarkdown.matchAll(imgRegex)];
                    
                    if (matches.length > 0) {
                        try {
                            const imagesDir = await dirHandle.getDirectoryHandle('images', { create: true });
                            let imgCount = 0;
                            const baseName = filename.replace('.md', '');

                            for (const match of matches) {
                                try {
                                    const fullMatch = match[0];
                                    const alt = match[1];
                                    const dataURI = match[2];
                                    const ext = match[3] === 'jpeg' ? 'jpg' : match[3];
                                    
                                    const imgFilename = `${baseName}_img${imgCount}.${ext}`;
                                    const blob = dataURItoBlob(dataURI);
                                    
                                    const imgHandle = await imagesDir.getFileHandle(imgFilename, { create: true });
                                    const writable = await imgHandle.createWritable();
                                    await writable.write(blob);
                                    await writable.close();
                                    
                                    finalMarkdown = finalMarkdown.replace(fullMatch, `![[images/${imgFilename}]]`);
                                    imgCount++;
                                } catch (imgErr) {
                                    console.error("Popup: Failed to save extracted image", imgErr);
                                }
                            }
                        } catch (dirErr) {
                            console.error("Popup: Failed to create images directory", dirErr);
                            statusMsg.textContent = 'Warning: Could not save images.';
                        }
                    }

                    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(finalMarkdown);
                    await writable.close();

                    statusMsg.textContent = `Saved to ${dirHandle.name}!`;
                    setTimeout(() => statusMsg.textContent = '', 3000);
                    resolve();

                 } catch (e) {
                     console.error("Save Error:", e);
                     if (e.name === 'InvalidStateError') {
                          statusMsg.textContent = 'Error: Folder access lost. Please re-select folder.';
                     } else if (e.name === 'NotAllowedError') {
                          statusMsg.textContent = 'Error: Permission denied. Re-select folder.';
                     } else {
                          statusMsg.textContent = 'Write error: ' + e.message;
                     }
                     reject(e);
                 }
             });
        });
    }

// Helper: Convert Base64 DataURI to Blob (Duplicate from content.js for standalone popup)
function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], {type: mimeString});
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
                            // Use try/catch to handle user cancellation
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

    launchBulkBtn.addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0].url && (tabs[0].url.includes('chatgpt.com') || tabs[0].url.includes('chat.openai.com'))) {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'show_bulk_ui'}, (response) => {
                     if (chrome.runtime.lastError) {
                         statusMsg.textContent = 'Error: ' + chrome.runtime.lastError.message;
                     } else {
                         window.close(); // Close popup so user can use the injected UI
                     }
                });
            } else {
                statusMsg.textContent = 'Open ChatGPT first.';
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
