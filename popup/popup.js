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
    const subfolderInput = document.getElementById('subfolder-name');
    const frontmatterInput = document.getElementById('frontmatter-template');
    const exportBtn = document.getElementById('export-settings-btn');
    const importBtn = document.getElementById('import-settings-btn');
    const importFileInput = document.getElementById('import-file-input');

    // State
    let currentTitle = '';
    let currentUrl = '';

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
    const DEFAULT_FRONTMATTER = `---
tags:
  - {folder}
status: false
createdAt: {date}
updatedAt: {date}
---

`;

    // Load settings
    chrome.storage.sync.get(['filenamePattern', 'frontmatterTemplate', 'subfolderName'], async (result) => {
        if (result.filenamePattern) {
            filenameInput.value = result.filenamePattern;
        } else {
            filenameInput.value = 'ChatGPT_{date}_{time}_{title}'; // Default
        }

        if (result.subfolderName) {
            subfolderInput.value = result.subfolderName;
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
        
        // Also clear visually
        // Note: We don't clear frontmatter variable binding but {folder} will be empty or default
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
                    statusMsg.textContent = 'Settings imported! Reloading...';
                    setTimeout(() => location.reload(), 1000);
                });
            } catch (err) {
                statusMsg.textContent = 'Invalid JSON file.';
            }
        };
        reader.readAsText(file);
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
                        saveMarkdown(response.markdown, response.title, tabs[0].url);
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
            frontmatterTemplate: frontmatterInput.value
            // subfolderName Removed
        });
    });

    const subfolderList = document.getElementById('subfolder-list');

    // ... (IDB helpers and existing code)

    async function verifyPermission(fileHandle, readWrite) {
        const options = {};
        if (readWrite) {
            options.mode = 'readwrite';
        }
        if ((await fileHandle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await fileHandle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    }

    async function scanSubfolders(rootHandle) {
        if (!rootHandle) return;
        
        // Verify read permission
        // Note: scanning requires read permission, which we might need to request if not already granted.
        // However, auto-scanning on load might fail if permission is not persisted.
        // We will try silent scan, if fails, we just don't populate list until user interacts.
        try {
             // We won't force requestPermission here to avoid popup spam on open
             // Just check if we can iterate
             subfolderList.innerHTML = '';
             for await (const [name, handle] of rootHandle.entries()) {
                 if (handle.kind === 'directory') {
                     const option = document.createElement('option');
                     option.value = name;
                     subfolderList.appendChild(option);
                 }
             }
        } catch (e) {
            console.log('Scanning subfolders failed (likely no permission yet):', e);
        }
    }

    async function verifyPermission(fileHandle, readWrite) {
        const options = {};
        if (readWrite) {
            options.mode = 'readwrite';
        }
        if ((await fileHandle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await fileHandle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    }

    async function scanSubfolders(rootHandle) {
        if (!rootHandle) return;
        
        try {
             folderDatalist.innerHTML = '';
             for await (const [name, handle] of rootHandle.entries()) {
                 if (handle.kind === 'directory') {
                     const option = document.createElement('option');
                     option.value = name;
                     folderDatalist.appendChild(option);
                 }
             }
        } catch (e) {
            console.log('Scanning subfolders failed (likely no permission yet):', e);
        }
    }

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

    // Load settings
    chrome.storage.sync.get(['filenamePattern', 'frontmatterTemplate'], async (result) => {
        if (result.filenamePattern) {
            filenameInput.value = result.filenamePattern;
        } else {
            filenameInput.value = 'ChatGPT_{date}_{time}_{title}'; // Default
        }
        
        if (result.frontmatterTemplate !== undefined) {
             frontmatterInput.value = result.frontmatterTemplate;
        } else {
             frontmatterInput.value = DEFAULT_FRONTMATTER;
        }
        
        // Get Root Handle for display
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
             // ...
        }
    });

    // ... (Clear handler)

    async function saveMarkdown(rawMarkdown, title, url, targetSubfolder, targetFilename) {
        chrome.storage.sync.get(['frontmatterTemplate'], async (result) => {
            const template = result.frontmatterTemplate !== undefined ? result.frontmatterTemplate : DEFAULT_FRONTMATTER;
            
            const date = new Date();
            const dateStr = date.toISOString().split('T')[0];
            const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
            const safeTitle = (title || 'Conversation').replace(/[/\\?%*:|"<>]/g, '-').trim();

            let targetDirHandle = null;
            let dirName = 'Downloads';
            let rootHandle = null;

            try {
                rootHandle = await getDirHandle();
            } catch(e) { console.error(e); }

            if (rootHandle) {
                // We MUST verify/request permission here because we are about to write
                const permitted = await verifyPermission(rootHandle, true);
                if (!permitted) {
                    statusMsg.textContent = 'Permission denied.';
                    return;
                }

                try {
                    if (targetSubfolder) {
                        targetDirHandle = await rootHandle.getDirectoryHandle(targetSubfolder, { create: true });
                        dirName = targetDirHandle.name; // This should be targetSubfolder
                    } else {
                        targetDirHandle = rootHandle;
                        dirName = rootHandle.name;
                    }
                } catch (err) {
                    console.error("Failed to get/create folder:", err);
                    statusMsg.textContent = 'Folder error: ' + err.message;
                    return;
                }
            }

            // Process Frontmatter
            // Use targetSubfolder if present, otherwise just root name? 
            // The requirement is "get 'fuga' and use as folder name".
            // So if targetSubfolder is used, {folder} = targetSubfolder.
            // If empty, {folder} = rootDirName.
            const displayFolderName = targetSubfolder || (rootHandle ? rootHandle.name : 'Downloads');

            let frontmatter = template
                .replace(/{folder}/g, displayFolderName)
                .replace(/{title}/g, safeTitle)
                .replace(/{url}/g, url || '')
                .replace(/{date}/g, dateStr)
                .replace(/{time}/g, timeStr);

            const finalMarkdown = frontmatter + rawMarkdown;
            const filename = targetFilename || 'output.md';

            try {
                if (targetDirHandle) {
                    // Direct Write (Silent Save)
                    const fileHandle = await targetDirHandle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(finalMarkdown);
                    await writable.close();
                    
                    statusMsg.textContent = `Saved to ${displayFolderName}!`;
                    
                    // Re-scan if new folder
                    if (targetSubfolder && rootHandle) {
                         scanSubfolders(rootHandle);
                    }
                    setTimeout(() => statusMsg.textContent = '', 2000);

                } else {
                    // Fallback to chrome.downloads
                    let finalDLFilename = filename;
                    if (targetSubfolder) {
                         finalDLFilename = targetSubfolder + '/' + filename;
                    }

                    const blob = new Blob([finalMarkdown], {type: 'text/markdown'});
                    const blobUrl = URL.createObjectURL(blob);
                    
                    chrome.downloads.download({
                        url: blobUrl,
                        filename: finalDLFilename,
                        saveAs: false 
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
