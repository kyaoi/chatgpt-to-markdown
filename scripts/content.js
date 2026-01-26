// content.js
// Listens for messages and orchestrates conversion

const converter = new MarkdownConverter();

// --- Bulk Export Logic ---

// UI State
let bulkUI = null;

// Create and inject the overlay UI
function createBulkUI(initialState = null) {
    if (bulkUI) return;

    // Inject styles (Modern / Glassmorphism)
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --ctm-bg: #202123;
            --ctm-card: #2d2f33; /* Slightly lighter for contrast */
            --ctm-text: #ececf1;
            --ctm-sub: #8e8ea0;
            --ctm-accent: #10a37f;
            --ctm-accent-hover: #1a7f64;
            --ctm-border: #4d4d4f;
            --ctm-danger: #ef4146;
            --ctm-radius: 8px;
            --ctm-shadow: 0 10px 30px rgba(0,0,0,0.5);
            --ctm-font: 'Söhne', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        #chatgpt-to-md-bulk-panel {
            position: fixed; bottom: 24px; right: 24px; width: 360px;
            background: var(--ctm-bg); color: var(--ctm-text);
            border: 1px solid var(--ctm-border); border-radius: var(--ctm-radius);
            box-shadow: var(--ctm-shadow); z-index: 10000;
            font-family: var(--ctm-font); font-size: 14px;
            display: flex; flex-direction: column; overflow: hidden;
            transition: all 0.3s ease; opacity: 0; transform: translateY(20px);
            animation: ctm-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes ctm-slide-up {
            to { opacity: 1; transform: translateY(0); }
        }
        #chatgpt-to-md-bulk-header {
            background: rgba(255,255,255,0.03); padding: 16px;
            border-bottom: 1px solid var(--ctm-border);
            display: flex; justify-content: space-between; align-items: center;
        }
        #chatgpt-to-md-bulk-header h3 {
             margin: 0; font-size: 14px; font-weight: 600; color: #fff;
        }
        #chatgpt-to-md-bulk-body { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
        .ctm-btn {
            border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer;
            font-weight: 500; font-size: 13px; width: 100%;
            transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .ctm-btn:active { transform: scale(0.98); }
        .ctm-primary { background: var(--ctm-accent); color: white; }
        .ctm-primary:hover { background: var(--ctm-accent-hover); }
        .ctm-danger { background: var(--ctm-danger); color: white; }
        .ctm-danger:hover { opacity: 0.9; }
        .ctm-secondary { background: transparent; border: 1px solid var(--ctm-border); color: var(--ctm-text); }
        .ctm-secondary:hover { background: rgba(255,255,255,0.05); border-color: #6e6e80; }
        
        .ctm-select {
            width: 100%; padding: 10px; background: #343541;
            border: 1px solid var(--ctm-border); color: var(--ctm-text);
            border-radius: 6px; outline: none; appearance: none;
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238e8ea0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat; background-position: right 10px center; background-size: 16px;
        }
        .ctm-select:focus { border-color: var(--ctm-accent); }

        .ctm-label { display: block; margin-bottom: 6px; font-size: 12px; font-weight: 500; color: var(--ctm-sub); }

        #bulk-status-container {
             background: #1a1b1e; border-radius: 6px; padding: 12px; border: 1px solid var(--ctm-border);
        }
        #bulk-status-text {
            font-family: 'Before-Mono', menlo, monospace; font-size: 11px; 
            white-space: pre-wrap; color: var(--ctm-text); 
            min-height: 60px; max-height: 150px; overflow-y: auto;
            line-height: 1.5;
        }
        /* Scrollbar */
        #bulk-status-text::-webkit-scrollbar { width: 6px; }
        #bulk-status-text::-webkit-scrollbar-track { background: transparent; }
        #bulk-status-text::-webkit-scrollbar-thumb { background: #565869; border-radius: 3px; }
    `;
    document.head.appendChild(style);

    const div = document.createElement('div');
    div.id = 'chatgpt-to-md-bulk-panel';
    div.innerHTML = `
        <div id="chatgpt-to-md-bulk-header">
            <h3>Export Manager</h3>
            <button id="bulk-close-btn" style="background:none; border:none; color:var(--ctm-sub); cursor:pointer; font-size:18px; line-height:1;">&times;</button>
        </div>
        <div id="chatgpt-to-md-bulk-body">
            <div id="bulk-controls">
                <div>
                    <label class="ctm-label">Source Project / Context</label>
                    <select id="bulk-project-select" class="ctm-select">
                        <option value="" disabled selected>Loading...</option>
                    </select>
                </div>
                <div style="margin-top: 20px;">
                    <button id="bulk-start-btn" class="ctm-btn ctm-primary">
                        <span>Start Export</span>
                    </button>
                </div>
            </div>

            <div id="bulk-status-container" style="display: none;">
                 <label class="ctm-label">Status Log</label>
                 <div id="bulk-status-text">Initializing...</div>
                 <div style="display:flex; gap:10px; margin-top:12px;">
                    <button id="bulk-stop-btn" class="ctm-btn ctm-danger">Stop</button>
                    <button id="bulk-save-btn" class="ctm-btn ctm-primary" style="display:none; width:100%;">Finalize & Save</button>
                 </div>
            </div>
        </div>
    `;

    document.body.appendChild(div);
    bulkUI = div;

    // Event Listeners
    div.querySelector('#bulk-close-btn').addEventListener('click', () => {
        div.style.opacity = '0';
        div.style.transform = 'translateY(20px)';
        setTimeout(() => {
            div.remove();
            bulkUI = null;
        }, 300);
    });

    div.querySelector('#bulk-start-btn').addEventListener('click', startNewExport);
    
    div.querySelector('#bulk-stop-btn').addEventListener('click', async () => {
        if (confirm("Stop export process? (Progress saved in memory)")) {
            await chrome.storage.local.set({ automationState: { isRunning: false } });
            window.location.reload();
        }
    });

    div.querySelector('#bulk-save-btn').addEventListener('click', saveAllToDisk);

    // Initial Load
    fetchProjects();

    if (initialState && initialState.isRunning) {
        showRunningState(initialState);
    } else if (initialState && initialState.results && initialState.queue && initialState.currentIndex >= initialState.queue.length) {
        // Finished state
        showFinishedState(initialState);
    }
}

function showRunningState(state) {
    const projectSelect = document.getElementById('bulk-controls');
    const statusContainer = document.getElementById('bulk-status-container');
    const statusText = document.getElementById('bulk-status-text');
    
    if (projectSelect) projectSelect.style.display = 'none';
    if (statusContainer) statusContainer.style.display = 'block';
    
    const total = state.queue ? state.queue.length : 0;
    const current = state.currentIndex || 0;
    const errors = state.errors || 0;
    
    if (statusText) statusText.textContent = `Processing: ${current}/${total}\nErrors: ${errors}\n(Do not close this tab)`;
}

function showFinishedState(state) {
    const projectSelect = document.getElementById('bulk-controls');
    const statusContainer = document.getElementById('bulk-status-container');
    const statusText = document.getElementById('bulk-status-text');
    const stopBtn = document.getElementById('bulk-stop-btn');
    const saveBtn = document.getElementById('bulk-save-btn');
    
    if (projectSelect) projectSelect.style.display = 'none';
    if (statusContainer) statusContainer.style.display = 'block';
    if (stopBtn) stopBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'flex'; // flex for valid layout

    const count = Object.keys(state.results || {}).length;
    if (statusText) statusText.textContent = `Completed!\nReady to save ${count} files.\nPress 'Finalize' to write to disk.`;
}


// --- Project Discovery ---
async function fetchProjects() {
    const select = document.getElementById('bulk-project-select');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Scanning...</option>';
    await new Promise(r => setTimeout(r, 1000));
    select.innerHTML = '';
    const personalOpt = document.createElement('option');
    personalOpt.value = "personal";
    personalOpt.textContent = "Personal / Current Context"; 
    select.appendChild(personalOpt);

    try {
        const projectLinks = document.querySelectorAll('nav a[href*="/project"]');
        projectLinks.forEach(link => {
            const href = link.getAttribute('href');
            const match = href.match(/\/g\/([^\/]+)\/project/);
            if (match) {
                const id = match[1];
                const nameDiv = link.querySelector('.truncate');
                const name = nameDiv ? nameDiv.textContent.trim() : id; 
                if (!select.querySelector(`option[value="${id}"]`)) {
                    const opt = document.createElement('option');
                    opt.value = id; opt.textContent = name; select.appendChild(opt);
                }
            }
        });
    } catch (e) {
        console.warn("Scan failed", e);
    }
}


// --- Logic: Start ---
async function startNewExport() {
    const projectId = document.getElementById('bulk-project-select').value;
    
    // 1. Get Settings
    const settings = await chrome.storage.sync.get(['filenamePattern', 'frontmatterTemplate']);
    
    // 2. Prepare State
    const state = {
        isRunning: true,
        projectId: projectId,
        queue: [],
        currentIndex: 0,
        results: {}, // Map<id, {markdown, title, filename}>
        errors: 0,
        settings: {
            filenamePattern: settings.filenamePattern || '{title}_{date}_{time}',
            frontmatterTemplate: settings.frontmatterTemplate || ''
        },
        mode: 'initializing' // initializing -> scanning -> processing -> finished
    };

    await chrome.storage.local.set({ automationState: state });
    
    // 3. Navigation to Project Source
    if (projectId === 'personal') {
        // Stay here and scan immediately.
        state.mode = 'scanning';
        await chrome.storage.local.set({ automationState: state });
        scanAndQueue(state);
    } else {
        // Navigate to project page first
        updateStatusUI("Navigating to project page...");
        window.location.href = `https://chatgpt.com/g/${projectId}/project`;
    }
}

// --- Logic: Resume / Auto-Run ---
// Called on page load
async function checkAndResume() {
    const data = await chrome.storage.local.get(['automationState']);
    const state = data.automationState;
    if (!state || !state.isRunning) return;

    // We are running! Re-create UI
    createBulkUI(state); 

    // Dispatch based on mode/step
    if (state.mode === 'initializing') {
        // We just arrived at project page (hopefully)
        state.mode = 'scanning';
        await chrome.storage.local.set({ automationState: state });
        // Allow page to load
        setTimeout(() => scanAndQueue(state), 2000);
    } 
    else if (state.mode === 'scanning') {
         // Should not happen unless we reloaded during scan. Retry scan.
         scanAndQueue(state);
    }
    else if (state.mode === 'processing') {
         // Wait for page load before scraping
         updateStatusUI(`Waiting for page load...`);
         setTimeout(() => processCurrentItem(state), 2500);
    }
    else if (state.mode === 'finished') {
         // UI already shows finished state
    }
}


// --- Step: Scan ---
async function scanAndQueue(state) {
    updateStatusUI("Scanning for conversations...");
    
    await scrollAndCollectLinks(state);
    
    // Reload state in case scroll updated it
    if (state.queue.length === 0) {
        alert("No conversations found to export.");
        state.isRunning = false;
        await chrome.storage.local.set({ automationState: state });
        window.location.reload();
        return;
    }
    
    // Switch to processing
    state.mode = 'processing';
    state.currentIndex = 0;
    await chrome.storage.local.set({ automationState: state });
    
    // Start first item
    processCurrentItem(state);
}

// Reuse scroll logic but purely for collecting HREFs
async function scrollAndCollectLinks(state) {
    // Determine container
    const isProject = window.location.href.includes('/project');
    const selector = isProject ? 'div[data-scroll-root="true"]' : 'nav[aria-label="チャット履歴"]';
    let container = document.querySelector(selector);
    
    if (!container && !isProject) {
         container = document.querySelector('nav div.overflow-y-auto');
    }

    if (!container) {
        console.warn("No scroll container found. Using visible links only.");
    }
    
    const collectedIds = new Set();
    const queue = [];

    // Simple scroll loop
    let previousHeight = 0;
    let noChangeCount = 0;
    
    for (let i=0; i<40; i++) { // Max 40 scrolls (safe limit)
        if (container) {
            container.scrollTo(0, container.scrollHeight);
            await new Promise(r => setTimeout(r, 1000));
            if (container.scrollHeight === previousHeight) {
                noChangeCount++;
                if (noChangeCount >= 3) break;
            } else {
                noChangeCount = 0;
            }
            previousHeight = container.scrollHeight;
        } else {
            break; // No container, just scan once
        }
        
        // Update UI intermittently
        // Limit scope based on context
        let currentScope = document;
        if (isProject) {
             currentScope = document.querySelector('main') || document;
        } else {
             // Personal mode: usually sidebar or container
             currentScope = container || document;
        }

        const links = currentScope.querySelectorAll('a[href*="/c/"]');
        updateStatusUI(`Scanning... Found ${links.length} potential links.`);
    }

    // Capture final list
    let finalScope = document;
    if (isProject) {
         finalScope = document.querySelector('main') || document;
    } else {
         finalScope = container || document;
    }

    const finalLinks = finalScope.querySelectorAll('a[href*="/c/"]');
    
    finalLinks.forEach(a => {
        const id = a.href.split('/').pop();
        if (!collectedIds.has(id)) {
            collectedIds.add(id);
            queue.push({
                id: id,
                href: a.href,
                title: (a.innerText || a.getAttribute('aria-label') || "Untitled").trim().split('\n')[0]
            });
        }
    });

    // Update state
    state.queue = queue;
    // Don't save here, caller will save
}

// --- Step: Process Item ---
async function processCurrentItem(state) {
    const { queue, currentIndex } = state;
    
    // Check completion
    if (currentIndex >= queue.length) {
        state.mode = 'finished';
        state.isRunning = false; // Stop auto-resume
        await chrome.storage.local.set({ automationState: state });
        
        // Show UI one last time
        createBulkUI(state);
        showFinishedState(state);
        return;
    }

    const item = queue[currentIndex];
    
    // Are we on the right page?
    if (!window.location.href.includes(item.id)) {
        updateStatusUI(`Navigating to ${currentIndex+1}/${queue.length}: ${item.title}...`);
        window.location.href = item.href;
        return; // Will resume after reload
    }
    
    // We are on page. Wait for load.
    try {
        updateStatusUI(`Converting ${currentIndex+1}/${queue.length}...`);
        await waitForPageLoad();
        
        // Convert
        // Converter embeds images as Base64 (Canvas).
        // To fix performance, we Extract these Base64 images and save them as files.
        let markdown = converter.convert(document.body);
        
        // --- Image Extraction (Base64 -> File) ---
        // 1. Create images folder (lazy, only if needed)
        // We can't easily "check" if folder exists in FileSystemAccessAPI without try/catch
        // We'll assume we write to 'images/' relative filename
        
        const imgRegex = /!\[(.*?)\]\((data:image\/([^;]+);base64,[^)]+)\)/g;
        let imgMatch;
        const processedImages = new Map(); // dataURI -> filename
        let imgIndex = 1;

        // We need to replace async, so we'll matchAll first
        const matches = [...markdown.matchAll(imgRegex)];
        
        if (matches.length > 0) {
            updateStatusUI(`Saving ${matches.length} images...`);
            
            // Try to create/get images directory handle? 
            // Actually, we can just save to "images/filename.png" if we are in the root dir handle?
            // FileSystemDirectoryHandle.getFileHandle('images/foo.png') might not work directly if subfolder doesn't exist.
            // We usually need to getDirectoryHandle('images', {create: true}) first.
            
            // However, processCurrentItem doesn't have reference to the ROOT dirHandle easily 
            // unless we pass it or store it globally.
            // Wait, saveAllToDisk handles the actual writing!
            
            // CRITICAL: processCurrentItem runs in the content script context gathering data.
            // saveAllToDisk runs LATER when the user clicks "Save".
            // We CANNOT write files here in processCurrentItem because we don't have the User Gesture / DirHandle yet!
            
            // SOLUTION:
            // We must keep the Base64 data IN MEMORY (in state.results) until saveAllToDisk is called.
            // BUT the user complains the file is too big to open. (Presumably referring to the final output?)
            // OR did they mean "The extension crashes"?
            // "画像のBaseが大きすぎて開くのにくそほど時間がかかります" -> "Resulting Markdown is slow to open".
            // So we just need to ensure the FINAL file on disk is clean.
            // Storing Base64 in `state` (Chrome Storage) MIGHT hit the 5MB/unlimited quota limits or slow down the extension.
            // But if we can't write to disk yet... we have no choice but to keep it in memory.
            
            // wait, `state.results` acts as the buffer.
            // If we keep Base64 there, `saveAllToDisk` can perform the Extraction.
            // So content.js `processCurrentItem` is actually fine leaving it as Base64!
            // The Extraction logic should move to `saveAllToDisk`.
        }
        
        // Metadata for Frontmatter (Defer application to save time)
        const date = new Date();

        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
        const safeTitle = (item.title || 'Conversation').replace(/[/\\?%*:|"<>]/g, '-').trim();

        // Generate Filename
        const config = state.settings;
        const filename = generateFilename(config.filenamePattern, item.title, item.id);
        
        // Store Result
        state.results = state.results || {};
        state.results[item.id] = {
            filename: filename,
            content: markdown,
            frontmatterData: {
                title: safeTitle,
                url: item.href || '',
                date: dateStr,
                time: timeStr
            }
        };
        
    } catch (e) {
        console.error("Conversion error", e);
        state.errors = (state.errors || 0) + 1;
    }
    
    // Next
    state.currentIndex++;
    await chrome.storage.local.set({ automationState: state });
    
    // Trigger navigation to next
    processCurrentItem(state); 
}

// Helper: Fetch image and convert to Base64
async function fetchImageAsBase64(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Image fetch failed", e);
        return null;
    }
}

// --- Step: Finalize (Save All) ---
async function saveAllToDisk() {
    // Reload state to be sure
    const data = await chrome.storage.local.get(['automationState']);
    const state = data.automationState;
    if (!state || !state.results) return;
    
    try {
        const dirHandle = await window.showDirectoryPicker();
        const folderName = dirHandle.name;
        
        // Create images subdirectory
        const imagesDir = await dirHandle.getDirectoryHandle('images', { create: true });
        
        updateStatusUI("Writing files...");
        const results = Object.values(state.results);
        let saved = 0;
        
        for (const file of results) {
            // FIX: Hoist finalContent here so it's accessible in catch block
            let finalContent = file.content;
            
            try {
                // --- Image Extraction & Externalization ---
                const imgRegex = /!\[(.*?)\]\((data:image\/([^;]+);base64,[^)]+)\)/g;
                
                // Find all matches
                const matches = [...finalContent.matchAll(imgRegex)];
                let imgCount = 0;
                
                for (const match of matches) {
                    try {
                        const fullMatch = match[0];
                        const alt = match[1]; // unused for filename but good to know
                        const dataURI = match[2];
                        const ext = match[3] === 'jpeg' ? 'jpg' : match[3]; // png, jpeg, etc
                        
                        // Generate simplified image filename
                        const baseName = file.filename.replace('.md', '');
                        const imgFilename = `${baseName}_img${imgCount}.${ext}`;
                        
                        // Convert to Blob
                        const blob = dataURItoBlob(dataURI);
                        
                        // Write image file
                        const imgHandle = await imagesDir.getFileHandle(imgFilename, { create: true });
                        const writable = await imgHandle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                        
                        // Replace in Markdown (Use relative path)
                        finalContent = finalContent.replace(fullMatch, `![${alt}](images/${imgFilename})`);
                        
                        imgCount++;
                    } catch (imgErr) {
                        console.error("Failed to save extracted image", imgErr);
                        // Log but continue, maybe content stays base64?
                    }
                }
                // ------------------------------------------

                // Apply Frontmatter if metadata exists
                if (file.frontmatterData && state.settings.frontmatterTemplate) {
                     let fm = state.settings.frontmatterTemplate
                        .replace(/{folder}/g, folderName)
                        .replace(/{title}/g, file.frontmatterData.title)
                        .replace(/{url}/g, file.frontmatterData.url)
                        .replace(/{date}/g, file.frontmatterData.date)
                        .replace(/{time}/g, file.frontmatterData.time);
                     finalContent = fm + finalContent;
                }

                const fileHandle = await dirHandle.getFileHandle(file.filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(finalContent);
                await writable.close();
                saved++;
                if (saved % 5 === 0) updateStatusUI(`Saved ${saved}/${results.length}...`);
            } catch (e) {
                console.error(`Write failed for ${file.filename}:`, e.name, e.message);
                updateStatusUI(`Error: ${e.name} on ${file.filename.substring(0,20)}... Retrying...`);
                
                // Cleanup the empty file
                try {
                    await dirHandle.removeEntry(file.filename);
                } catch (delErr) {
                    console.warn("Cleanup failed:", delErr);
                }

                try {
                    // Fallback: Use simple ID filename
                    // NOTE: Keep images/ links?? They might point to "OldName_img0.png".
                    // That's fine, the image file exists.
                    const safeName = `${state.results[Object.keys(state.results).find(k => state.results[k] === file)]?.id || Date.now()}.md`; 
                    const fileHandle = await dirHandle.getFileHandle(safeName, { create: true });
                    const writable = await fileHandle.createWritable();
                    // Fix: finalContent is now available here
                    await writable.write(`<!-- Original Title: ${file.frontmatterData?.title || 'Unknown'} -->\n` + finalContent); 
                    await writable.close();
                    saved++;
                    updateStatusUI(`Saved (Fallback) ${saved}/${results.length}...`);
                } catch (retryErr) {
                    console.error("Fallback failed:", retryErr);
                    updateStatusUI(`CRITICAL: Failed to save ${file.filename} fallback. ${retryErr.name}`);
                }
            }
        }
        
        updateStatusUI(`Done! Saved ${saved} files.`);
        alert(`Bulk Export Completed!\n\nSaved: ${saved}\n(Reloading extension to reset)`);
        
        // Cleanup
        await chrome.storage.local.set({ automationState: { isRunning: false } });
        window.location.reload();
        
    } catch (e) {
        alert("Save cancelled or failed: " + e.message + "\n" + e.name);
    }
}


function generateFilename(pattern, title, id) {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
    const safeTitle = (title || 'Conversation').replace(/[/\\?%*:|"<>]/g, '-').trim().substring(0, 100); // Truncate title

    let filename = pattern
        .replace('{title}', safeTitle)
        .replace('{date}', dateStr)
        .replace('{time}', timeStr)
        .replace('{id}', id || Date.now().toString());

    if (!filename.endsWith('.md')) filename += '.md';
    return filename;
}

// Simpler Wait
async function waitForPageLoad() {
    let checks = 0;
    while(checks < 30) {
        const articles = document.querySelectorAll('article');
        const spinner = document.querySelector('.text-token-text-tertiary > svg.animate-spin');
        
        if (articles.length > 0 && !spinner) {
            await new Promise(r => setTimeout(r, 1000));
            return;
        }
        await new Promise(r => setTimeout(r, 500));
        checks++;
    }
}

function updateStatusUI(text) {
    const el = document.getElementById('bulk-status-text');
    if (el) el.textContent = text;
}

// Startup Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "get_markdown") {
        try {
            const markdown = converter.convert(document.body);
            const title = document.title.replace('ChatGPT', '').trim() || "Conversation";
            sendResponse({markdown: markdown, title: title});
        } catch (e) {
            sendResponse({error: e.message});
        }
    } else if (request.action === "show_bulk_ui") {
        createBulkUI();
        sendResponse({status: "ok"});
    }
    return true; 
});

// Check resume on load
checkAndResume();

console.log("ChatGPT to Markdown extension loaded (V2).");

// Helper: Convert Base64 DataURI to Blob
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
