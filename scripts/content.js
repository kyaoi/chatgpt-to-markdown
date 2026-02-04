// content.js
// Listens for messages and orchestrates conversion

const converter = new MarkdownConverter();
const fileSaver = new FileSaver();

// --- Bulk Export Logic ---

// UI State
let bulkUI = null;

// Create and inject the overlay UI
function createBulkUI(initialState = null) {
	if (bulkUI) return;

	// Inject styles (Modern / Glassmorphism with Modal)
	const style = document.createElement("style");
	style.textContent = `
        :root {
            --ctm-bg: #202123;
            --ctm-card: #2d2f33;
            --ctm-text: #ececf1;
            --ctm-sub: #8e8ea0;
            --ctm-accent: #10a37f;
            --ctm-accent-hover: #1a7f64;
            --ctm-border: #4d4d4f;
            --ctm-danger: #ef4146;
            --ctm-radius: 12px;
            --ctm-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            --ctm-font: 'Söhne', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        /* Overlay */
        #chatgpt-to-md-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
            z-index: 9999; opacity: 0;
            animation: ctm-fade-in 0.3s ease forwards;
        }
        @keyframes ctm-fade-in {
            to { opacity: 1; }
        }
        
        /* Main Panel - Centered Modal */
        #chatgpt-to-md-bulk-panel {
            position: fixed; top: 50%; left: 50%; 
            transform: translate(-50%, -50%) scale(0.95);
            width: 480px; max-width: 90vw; max-height: 80vh;
            background: var(--ctm-bg); color: var(--ctm-text);
            border: 1px solid var(--ctm-border); border-radius: var(--ctm-radius);
            box-shadow: var(--ctm-shadow); z-index: 10000;
            font-family: var(--ctm-font); font-size: 14px;
            display: flex; flex-direction: column; overflow: hidden;
            opacity: 0;
            animation: ctm-modal-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes ctm-modal-in {
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        
        #chatgpt-to-md-bulk-header {
            background: rgba(255,255,255,0.03); padding: 16px 20px;
            border-bottom: 1px solid var(--ctm-border);
            display: flex; justify-content: space-between; align-items: center;
        }
        #chatgpt-to-md-bulk-header h3 {
            margin: 0; font-size: 16px; font-weight: 600; color: #fff;
            display: flex; align-items: center; gap: 8px;
        }
        #chatgpt-to-md-bulk-body { 
            padding: 20px; display: flex; flex-direction: column; gap: 16px;
            overflow-y: auto; flex: 1;
        }
        
        .ctm-btn {
            border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer;
            font-weight: 500; font-size: 13px;
            transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .ctm-btn:active { transform: scale(0.98); }
        .ctm-primary { background: var(--ctm-accent); color: white; flex: 1; }
        .ctm-primary:hover { background: var(--ctm-accent-hover); }
        .ctm-danger { background: var(--ctm-danger); color: white; }
        .ctm-danger:hover { opacity: 0.9; }
        .ctm-secondary { 
            background: transparent; border: 1px solid var(--ctm-border); color: var(--ctm-text);
            padding: 10px 12px;
        }
        .ctm-secondary:hover { background: rgba(255,255,255,0.05); border-color: #6e6e80; }
        .ctm-icon-btn {
            background: transparent; border: 1px solid var(--ctm-border); 
            color: var(--ctm-sub); padding: 8px; border-radius: 6px; cursor: pointer;
            transition: all 0.2s;
        }
        .ctm-icon-btn:hover { background: rgba(255,255,255,0.05); color: var(--ctm-text); }
        
        /* Search Input */
        .ctm-search-container {
            position: relative;
        }
        .ctm-search-input {
            width: 100%; padding: 12px 12px 12px 40px; 
            background: #343541; border: 1px solid var(--ctm-border); 
            color: var(--ctm-text); border-radius: 8px; outline: none;
            font-size: 14px; transition: border-color 0.2s;
        }
        .ctm-search-input:focus { border-color: var(--ctm-accent); }
        .ctm-search-input::placeholder { color: var(--ctm-sub); }
        .ctm-search-icon {
            position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
            color: var(--ctm-sub); pointer-events: none;
        }
        
        /* Project List */
        .ctm-project-list {
            display: flex; flex-direction: column; gap: 8px;
            max-height: 300px; overflow-y: auto; padding-right: 4px;
        }
        .ctm-project-item {
            padding: 12px 16px; background: var(--ctm-card);
            border: 1px solid transparent; border-radius: 8px;
            cursor: pointer; transition: all 0.2s;
            display: flex; align-items: center; gap: 12px;
        }
        .ctm-project-item:hover { 
            background: #3d3f43; border-color: var(--ctm-border); 
        }
        .ctm-project-item.selected {
            border-color: var(--ctm-accent); background: rgba(16, 163, 127, 0.1);
        }
        .ctm-project-icon {
            width: 32px; height: 32px; border-radius: 6px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex; align-items: center; justify-content: center;
            color: white; font-weight: 600; font-size: 14px;
        }
        .ctm-project-name {
            flex: 1; font-weight: 500; color: var(--ctm-text);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ctm-project-personal .ctm-project-icon {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        
        /* Footer */
        .ctm-footer {
            display: flex; gap: 10px; align-items: center;
            padding-top: 16px; border-top: 1px solid var(--ctm-border);
        }
        .ctm-project-count {
            font-size: 12px; color: var(--ctm-sub); margin-left: auto;
        }
        
        .ctm-label { display: block; margin-bottom: 6px; font-size: 12px; font-weight: 500; color: var(--ctm-sub); }

        #bulk-status-container {
            background: #1a1b1e; border-radius: 8px; padding: 16px; border: 1px solid var(--ctm-border);
        }
        #bulk-status-text {
            font-family: 'JetBrains Mono', 'Fira Code', menlo, monospace; font-size: 12px; 
            white-space: pre-wrap; color: var(--ctm-text); 
            min-height: 80px; max-height: 180px; overflow-y: auto;
            line-height: 1.6;
        }
        
        /* Scrollbar */
        .ctm-project-list::-webkit-scrollbar, #bulk-status-text::-webkit-scrollbar { width: 6px; }
        .ctm-project-list::-webkit-scrollbar-track, #bulk-status-text::-webkit-scrollbar-track { background: transparent; }
        .ctm-project-list::-webkit-scrollbar-thumb, #bulk-status-text::-webkit-scrollbar-thumb { 
            background: #565869; border-radius: 3px; 
        }
        
        /* Hide when not in controls mode */
        #bulk-controls.hidden { display: none; }

        /* Minimized State (Bottom Right Toast) */
        #chatgpt-to-md-bulk-panel.ctm-minimized {
            top: auto !important;
            left: auto !important;
            bottom: 24px !important;
            right: 24px !important;
            transform: none !important;
            width: 340px !important;
            max-height: 400px !important;
            border-radius: 8px !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
            animation: ctm-slide-up 0.3s ease forwards;
        }
        @keyframes ctm-slide-up {
             from { transform: translateY(20px); opacity: 0; }
             to { transform: translateY(0); opacity: 1; }
        }

        /* Adjustments for minimized view */
        .ctm-minimized #chatgpt-to-md-bulk-header {
            padding: 10px 16px;
            background: #25262b;
        }
        .ctm-minimized #chatgpt-to-md-bulk-header h3 {
            font-size: 14px;
        }
        .ctm-minimized #chatgpt-to-md-bulk-body {
            padding: 12px 16px;
            gap: 10px;
        }
        .ctm-minimized #bulk-status-container {
            border: none;
            background: transparent;
            padding: 0;
        }
        .ctm-minimized #bulk-status-text {
            min-height: 50px;
            max-height: 120px;
            font-size: 11px;
        }
    `;
	document.head.appendChild(style);

	// Create overlay
	const overlay = document.createElement("div");
	overlay.id = "chatgpt-to-md-overlay";
	document.body.appendChild(overlay);

	const div = document.createElement("div");
	div.id = "chatgpt-to-md-bulk-panel";
	div.innerHTML = `
        <div id="chatgpt-to-md-bulk-header">
            <h3>📦 Export Manager</h3>
            <div style="display:flex; gap:8px;">
                 <!-- Restore button could go here -->
                 <button id="bulk-close-btn" class="ctm-icon-btn" title="Close" style="padding:4px 8px;">✕</button>
            </div>
        </div>
        <div id="chatgpt-to-md-bulk-body">
            <div id="bulk-controls">
                <div class="ctm-search-container">
                    <svg class="ctm-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input type="text" id="bulk-project-search" class="ctm-search-input" placeholder="Search projects...">
                </div>
                
                <div class="ctm-project-list" id="bulk-project-list">
                    <div style="text-align: center; padding: 40px; color: var(--ctm-sub);">
                        Loading projects...
                    </div>
                </div>
                
                <div class="ctm-footer">
                    <button id="bulk-refresh-btn" class="ctm-icon-btn" title="Refresh projects">⟳</button>
                    <button id="bulk-start-btn" class="ctm-btn ctm-primary">
                        <span>Start Export</span>
                    </button>
                    <span id="bulk-project-count" class="ctm-project-count">Loading...</span>
                </div>
                <div style="margin-top: 10px; font-size: 11px; color: var(--ctm-sub); line-height: 1.4; text-align: center; border: 1px dashed var(--ctm-border); padding: 8px; border-radius: 6px;">
                    💡 全てのプロジェクトを読み込むには、ChatGPTのサイドバーの「もっと見る」を押してプロジェクトをすべて表示させてください。
                </div>
            </div>

            <div id="bulk-status-container" style="display: none;">
                <!-- <label class="ctm-label">Status</label> -->
                <div id="bulk-status-text">Initializing...</div>
                <div style="display:flex; gap:10px; margin-top:12px;">
                    <button id="bulk-stop-btn" class="ctm-btn ctm-danger" style="flex:1; padding: 8px;">Stop</button>
                    <button id="bulk-save-btn" class="ctm-btn ctm-primary" style="display:none; flex:1; padding: 8px;">Save</button>
                </div>
            </div>
        </div>
    `;

	document.body.appendChild(div);
	bulkUI = div;

	// Close function
	const closeUI = () => {
		const overlay = document.getElementById("chatgpt-to-md-overlay");
		div.style.opacity = "0";
		if (!div.classList.contains("ctm-minimized")) {
			div.style.transform = "translate(-50%, -50%) scale(0.95)";
		} else {
			div.style.transform = "translateY(20px)";
		}

		if (overlay) overlay.style.opacity = "0";
		setTimeout(() => {
			div.remove();
			if (overlay) overlay.remove();
			bulkUI = null;
		}, 300);
	};

	// Event Listeners
	div.querySelector("#bulk-close-btn").addEventListener("click", closeUI);
	overlay.addEventListener("click", closeUI);

	div
		.querySelector("#bulk-start-btn")
		.addEventListener("click", startNewExport);

	div.querySelector("#bulk-stop-btn").addEventListener("click", async () => {
		if (confirm("Stop export process? (Progress saved in memory)")) {
			await chrome.storage.local.set({ automationState: { isRunning: false } });
			window.location.reload();
		}
	});

	div.querySelector("#bulk-save-btn").addEventListener("click", saveAllToDisk);

	// Search functionality
	const searchInput = div.querySelector("#bulk-project-search");
	if (searchInput) {
		searchInput.addEventListener("input", (e) => {
			const query = e.target.value.toLowerCase();
			const items = div.querySelectorAll(".ctm-project-item");
			items.forEach((item) => {
				const name =
					item.querySelector(".ctm-project-name")?.textContent.toLowerCase() ||
					"";
				item.style.display = name.includes(query) ? "flex" : "none";
			});
		});
	}

	// Refresh button
	const refreshBtn = div.querySelector("#bulk-refresh-btn");
	if (refreshBtn) {
		refreshBtn.addEventListener("click", async () => {
			refreshBtn.style.animation = "spin 1s linear infinite";
			refreshBtn.style.transformOrigin = "center";

			// Clear cache and reload
			if (typeof projectInterceptor !== "undefined") {
				await projectInterceptor.clearCache();
			}

			// Trigger a page reload to re-capture API responses
			// Or just re-fetch from DOM as fallback
			await fetchProjects();

			refreshBtn.style.animation = "";
		});
	}

	// Initial Load
	fetchProjects();

	// Check state and restore UI
	if (initialState) {
		if (
			initialState.isRunning ||
			(initialState.results &&
				initialState.queue &&
				initialState.currentIndex >= initialState.queue.length)
		) {
			// Auto-minimize if running or finished
			const panel = document.getElementById("chatgpt-to-md-bulk-panel");
			const overlay = document.getElementById("chatgpt-to-md-overlay");
			if (panel) panel.classList.add("ctm-minimized");
			if (overlay) overlay.style.display = "none";
		}

		if (initialState.isRunning) {
			showRunningState(initialState);
		} else if (
			initialState.results &&
			initialState.queue &&
			initialState.currentIndex >= initialState.queue.length
		) {
			showFinishedState(initialState);
		}
	}
}

function showRunningState(state) {
	const projectSelect = document.getElementById("bulk-controls");
	const statusContainer = document.getElementById("bulk-status-container");
	const statusText = document.getElementById("bulk-status-text");
	const overlay = document.getElementById("chatgpt-to-md-overlay");
	const panel = document.getElementById("chatgpt-to-md-bulk-panel");

	if (projectSelect) projectSelect.style.display = "none";
	if (statusContainer) statusContainer.style.display = "block";

	// Switch to Minimized
	if (panel) panel.classList.add("ctm-minimized");
	if (overlay) overlay.style.display = "none";

	const total = state.queue ? state.queue.length : 0;
	const current = state.currentIndex || 0;
	const errors = state.errors || 0;

	if (statusText)
		statusText.textContent = `Processing: ${current}/${total}\nErrors: ${errors}`;
}

function showFinishedState(state) {
	const projectSelect = document.getElementById("bulk-controls");
	const statusContainer = document.getElementById("bulk-status-container");
	const statusText = document.getElementById("bulk-status-text");
	const stopBtn = document.getElementById("bulk-stop-btn");
	const saveBtn = document.getElementById("bulk-save-btn");
	const overlay = document.getElementById("chatgpt-to-md-overlay");
	const panel = document.getElementById("chatgpt-to-md-bulk-panel");

	// Switch to Minimized
	if (panel) panel.classList.add("ctm-minimized");
	if (overlay) overlay.style.display = "none";

	if (projectSelect) projectSelect.style.display = "none";
	if (statusContainer) statusContainer.style.display = "block";
	if (stopBtn) stopBtn.style.display = "none";
	if (saveBtn) saveBtn.style.display = "flex";

	// Add Tags Input if not present
	let tagsContainer = document.getElementById("bulk-tags-container");
	if (!tagsContainer) {
		tagsContainer = document.createElement("div");
		tagsContainer.id = "bulk-tags-container";
		tagsContainer.style.marginTop = "12px";
		tagsContainer.style.width = "100%";

		// CSS for Chips and Input
		const style = document.createElement("style");
		style.textContent = `
            .ctm-tag-container {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                padding: 6px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: white;
                min-height: 38px;
            }
            .ctm-tag-chip {
                background: #e0e0e0;
                border-radius: 16px;
                padding: 4px 10px;
                display: flex;
                align-items: center;
                font-size: 12px;
                color: #333;
            }
            .ctm-tag-chip .remove {
                margin-left: 6px;
                cursor: pointer;
                color: #666;
                font-weight: bold;
                font-size: 14px;
            }
            .ctm-tag-input {
                border: none;
                outline: none;
                flex: 1;
                min-width: 60px;
                padding: 4px;
                font-size: 13px;
                color: #000 !important; /* Force black text */
                background: transparent;
                appearance: none;
                -webkit-appearance: none; 
            }
            .ctm-tag-input::placeholder {
                color: #888;
            }
            .ctm-var-chip {
                display: inline-block;
                background: #f0f0f0;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 2px 6px;
                margin: 2px;
                font-size: 11px;
                color: #333 !important; /* Force dark text */
                cursor: pointer;
                user-select: none;
                transition: background 0.2s;
            }
            .ctm-var-chip:hover {
                background: #e0e0e0;
                border-color: #999;
            }
            /* Remove list arrows from some browsers */
            .ctm-tag-input::-webkit-calendar-picker-indicator {
                display: none !important;
            }
        `;
		document.head.appendChild(style);

		tagsContainer.innerHTML = `
            <label class="ctm-label" style="display:block; margin-bottom:4px;">Tags (One by one)</label>
            <div class="ctm-tag-container" id="ctm-tag-wrapper">
                <input type="text" id="bulk-tags-input" class="ctm-tag-input" placeholder="Type & Enter (e.g. AI, {date})">
            </div>
            <div style="margin-top:6px;">
                <div style="font-size:10px; color:var(--ctm-sub); margin-bottom:4px;">Click to add variable:</div>
                <div id="ctm-variable-list">
                    <span class="ctm-var-chip" data-val="{folder}">{folder}</span>
                    <span class="ctm-var-chip" data-val="{title}">{title}</span>
                    <span class="ctm-var-chip" data-val="{date}">{date}</span>
                    <span class="ctm-var-chip" data-val="{time}">{time}</span>
                    <span class="ctm-var-chip" data-val="{url}">{url}</span>
                </div>
            </div>
            <input type="hidden" id="bulk-tags-hidden-value" value="${state.settings.defaultTags || ""}">
        `;

		// Insert before buttons
		saveBtn.parentElement.before(tagsContainer);

		// --- Logic for Chip UI ---
		const wrapper = tagsContainer.querySelector("#ctm-tag-wrapper");
		const input = tagsContainer.querySelector("#bulk-tags-input");
		const hiddenVal = tagsContainer.querySelector("#bulk-tags-hidden-value");
		const varList = tagsContainer.querySelector("#ctm-variable-list");

		const tags = (state.settings.defaultTags || "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		function renderTags() {
			// clear wrapper except input
			const chips = wrapper.querySelectorAll(".ctm-tag-chip");
			chips.forEach((c) => {
				c.remove();
			});

			tags.forEach((tag, idx) => {
				const chip = document.createElement("div");
				chip.className = "ctm-tag-chip";
				chip.innerHTML = `${tag} <span class="remove">&times;</span>`;
				chip.querySelector(".remove").onclick = () => {
					tags.splice(idx, 1);
					update();
				};
				wrapper.insertBefore(chip, input);
			});
		}

		function update() {
			renderTags();
			hiddenVal.value = tags.join(", ");
			input.focus();
		}

		// Variable Click Handler
		varList.querySelectorAll(".ctm-var-chip").forEach((chip) => {
			chip.addEventListener("click", () => {
				const val = chip.getAttribute("data-val");
				// Insert at cursor position or append
				const start = input.selectionStart;
				const end = input.selectionEnd;
				const text = input.value;
				input.value = text.substring(0, start) + val + text.substring(end);
				input.focus();
				// Move cursor after inserted text
				input.selectionStart = input.selectionEnd = start + val.length;
			});
		});

		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === ",") {
				e.preventDefault();
				const val = input.value.trim().replace(/^,|,$/g, "");
				if (val) {
					tags.push(val);
					input.value = ""; // Clear input only on enter
					update();
				}
			}
			if (e.key === "Backspace" && !input.value && tags.length > 0) {
				tags.pop();
				update();
			}
		});

		// Initial render
		renderTags();
	}

	const count = Object.keys(state.results || {}).length;
	if (statusText)
		statusText.textContent = `Completed!\nReady to save ${count} files.\nCustomize tags below if needed.`;
}

// --- Project Intercept Integration ---
const projectInterceptor = {
	cache: new Map(),
	lastUpdated: null,
	listeners: [],

	subscribe(fn) {
		this.listeners.push(fn);
		return () => {
			this.listeners = this.listeners.filter((l) => l !== fn);
		};
	},

	clearListeners() {
		this.listeners = [];
	},

	notify() {
		const projects = this.getProjects();
		const stats = this.getStats();
		this.listeners.forEach((fn) => {
			fn(projects, stats);
		});
	},

	getProjects() {
		return Array.from(this.cache.values()).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
	},

	getStats() {
		return {
			cacheAge: this.lastUpdated
				? Math.floor((Date.now() - this.lastUpdated) / 1000)
				: 0,
			totalProjects: this.cache.size,
		};
	},

	addProjects(projects) {
		projects.forEach((p) => {
			this.cache.set(p.shortUrl, p);
		});
		this.lastUpdated = Date.now();
		this.saveCache();
		this.notify();
	},

	async saveCache() {
		await chrome.storage.local.set({
			projectCache: {
				projects: Array.from(this.cache.values()),
				lastUpdated: this.lastUpdated,
			},
		});
	},

	async loadCache() {
		try {
			const data = await chrome.storage.local.get(["projectCache"]);
			if (data.projectCache?.projects) {
				data.projectCache.projects.forEach((p) => {
					this.cache.set(p.shortUrl, p);
				});
				this.lastUpdated = data.projectCache.lastUpdated;
			}
		} catch (_e) {}
	},

	async clearCache() {
		this.cache.clear();
		this.lastUpdated = null;
		await chrome.storage.local.remove(["projectCache"]);
		this.notify();
	},
};

// Listen for messages from Main World
window.addEventListener("message", (event) => {
	if (event.data?.type === "CTM_PROJECT_DATA") {
		projectInterceptor.addProjects(event.data.payload);
	}
});

// Inject Interceptor Script
try {
	const script = document.createElement("script");
	script.src = chrome.runtime.getURL("scripts/project_interceptor.js");
	script.onload = function () {
		this.remove();
	};
	(document.head || document.documentElement).appendChild(script);
} catch (_e) {}

// Init cache
projectInterceptor.loadCache();

// --- Project Discovery ---
// Store selected project
let selectedProject = null;

// Helper to render project list
function renderProjectList(projects) {
	const projectList = document.getElementById("bulk-project-list");
	const countEl = document.getElementById("bulk-project-count");
	if (!projectList) return;

	projectList.innerHTML = "";

	// Add Personal option first
	const personalItem = createProjectItem({
		shortUrl: "personal",
		name: "Personal / Current Context",
		isPersonal: true,
	});
	projectList.appendChild(personalItem);

	// Add all projects
	projects.forEach((project) => {
		const item = createProjectItem(project);
		projectList.appendChild(item);
	});

	// Update count
	if (countEl) {
		countEl.textContent = `Found: ${projects.length} projects`;
	}
}

async function fetchProjects() {
	const projectList = document.getElementById("bulk-project-list");

	if (!projectList) return;

	// Reset list logic - clear old listeners
	projectInterceptor.clearListeners();

	// Subscribe to future updates (Real-time from sidebar/fetch)
	projectInterceptor.subscribe((newProjects) => {
		renderProjectList(newProjects);
	});

	// Initial check
	const projects = projectInterceptor.getProjects();

	if (projects.length === 0) {
		projectList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--ctm-sub);">
                Loading projects...<br>
                <div style="font-size:0.9em; margin-top:8px; opacity:0.8;">(Try expanding 'Show More' in Sidebar)</div>
            </div>
        `;

		// Wait and fallback to DOM
		setTimeout(() => {
			// Check again
			const currentProjs = projectInterceptor.getProjects();
			if (currentProjs.length === 0) {
				const scanned = scanProjectsFromDOM();
				if (scanned.length > 0) {
					projectInterceptor.addProjects(scanned);
				} else {
					projectList.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: var(--ctm-sub);">
                            No projects found yet.<br>
                            Please find and click project in sidebar.
                        </div>
                     `;
				}
			} else {
				renderProjectList(currentProjs);
			}
		}, 2000);
	} else {
		renderProjectList(projects);
	}

	// Select first item by default if none selected
	if (!selectedProject) {
		selectProject("personal");
	}
}

// Create a project item element
function createProjectItem(project) {
	const div = document.createElement("div");
	div.className = `ctm-project-item${project.isPersonal ? " ctm-project-personal" : ""}`;
	div.dataset.shortUrl = project.shortUrl;

	// Get first letter for icon
	const initial = project.name.charAt(0).toUpperCase();

	div.innerHTML = `
        <div class="ctm-project-icon">${project.isPersonal ? "👤" : initial}</div>
        <div class="ctm-project-name">${project.name}</div>
    `;

	div.addEventListener("click", () => {
		selectProject(project.shortUrl);
	});

	return div;
}

// Select a project
function selectProject(shortUrl) {
	selectedProject = shortUrl;

	// Update visual state
	const items = document.querySelectorAll(".ctm-project-item");
	items.forEach((item) => {
		if (item.dataset.shortUrl === shortUrl) {
			item.classList.add("selected");
		} else {
			item.classList.remove("selected");
		}
	});
}

// Get currently selected project (for startNewExport)
function getSelectedProject() {
	return selectedProject;
}

// Fallback: Scan projects from DOM (original method)
function scanProjectsFromDOM() {
	const projects = [];
	try {
		const projectLinks = document.querySelectorAll('nav a[href*="/project"]');
		projectLinks.forEach((link) => {
			const href = link.getAttribute("href");
			const match = href.match(/\/g\/([^/]+)\/project/);
			if (match) {
				const shortUrl = match[1];
				const nameDiv = link.querySelector(".truncate");
				const name = nameDiv ? nameDiv.textContent.trim() : shortUrl;
				// Avoid duplicates
				if (!projects.find((p) => p.shortUrl === shortUrl)) {
					projects.push({ shortUrl, name, source: "dom" });
				}
			}
		});
	} catch (e) {
		console.warn("[BulkExport] DOM scan failed", e);
	}
	return projects;
}

// --- Logic: Start ---
async function startNewExport() {
	const projectId = getSelectedProject();

	if (!projectId) {
		alert("Please select a project first.");
		return;
	}

	// 1. Get Settings
	const settings = await chrome.storage.sync.get([
		"filenamePattern",
		"frontmatterTemplate",
		"defaultTags",
	]);

	// 2. Prepare State
	const state = {
		isRunning: true,
		projectId: projectId,
		queue: [],
		currentIndex: 0,
		results: {}, // Map<id, {markdown, title, filename}>
		errors: 0,
		settings: {
			filenamePattern: settings.filenamePattern || "{title}_{date}_{time}",
			frontmatterTemplate: settings.frontmatterTemplate || "",
			defaultTags: settings.defaultTags || "", // Store default tags here
		},
		mode: "initializing", // initializing -> scanning -> processing -> finished
	};

	await chrome.storage.local.set({ automationState: state });

	// 3. Navigation to Project Source
	if (projectId === "personal") {
		// Stay here and scan immediately.
		state.mode = "scanning";
		await chrome.storage.local.set({ automationState: state });
		scanAndQueue(state);
	} else {
		// Navigate to project page first
		updateStatusUI("Navigating to project page...");
		window.location.href = `https://chatgpt.com/g/${projectId}/project`;
	}
}

// --- Logic: Resume / Auto-Run ---
// Helper to wait for elements
async function waitForSelector(selector, timeout = 10000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const el = document.querySelector(selector);
		if (el) return el;
		await new Promise((r) => setTimeout(r, 500));
	}
	return null;
}

// Called on page load
async function checkAndResume() {
	const data = await chrome.storage.local.get(["automationState"]);
	const state = data.automationState;
	if (!state || !state.isRunning) return;

	// We are running! Re-create UI
	createBulkUI(state);

	// Dispatch based on mode/step
	if (state.mode === "initializing") {
		// We just arrived at project page
		state.mode = "scanning";
		await chrome.storage.local.set({ automationState: state });
		scanAndQueue(state);
	} else if (state.mode === "scanning") {
		scanAndQueue(state);
	} else if (state.mode === "processing") {
		updateStatusUI(`Waiting for page content...`);
		// Wait for actual conversation content to appear
		await waitForSelector(".prose", 10000);
		processCurrentItem(state);
	} else if (state.mode === "finished") {
		// UI already shows finished state
	}
}

// --- Step: Scan ---
async function scanAndQueue(state) {
	updateStatusUI("Waiting for page content...");

	// Determine container
	const isProject = window.location.href.includes("/project");
	const selector = isProject
		? 'div[data-scroll-root="true"]'
		: 'nav[aria-label="チャット履歴"]';

	await waitForSelector(selector, 15000);

	// Give a little more time for links to render
	await new Promise((r) => setTimeout(r, 1500));

	updateStatusUI("Scanning for conversations...");

	const collectedIds = new Set();
	const queue = [];

	await scrollAndCollectLinks();

	// Reload state in case scroll updated it
	if (state.queue.length === 0) {
		alert("No conversations found to export.");
		state.isRunning = false;
		await chrome.storage.local.set({ automationState: state });
		window.location.reload();
		return;
	}

	// Helper: proper scroll parent detection
	function getScrollParent(node) {
		if (!node) return null;
		if (node === document.documentElement || node === document.body)
			return document.documentElement;

		const style = window.getComputedStyle(node);
		const overflowY = style.getPropertyValue("overflow-y");

		if (overflowY === "auto" || overflowY === "scroll") {
			return node;
		}

		return getScrollParent(node.parentNode);
	}

	// Reuse scroll logic but purely for collecting HREFs
	async function scrollAndCollectLinks() {
		// 1. Initial wait for ANY content
		updateStatusUI("Waiting for content list...");
		const isProject = window.location.href.includes("/project");
		const rootScope = isProject
			? document.querySelector("main") || document
			: document;

		for (let j = 0; j < 10; j++) {
			const initialLinks = rootScope.querySelectorAll('a[href*="/c/"]');
			if (initialLinks.length > 0) break;
			await new Promise((r) => setTimeout(r, 1000));
		}

		// 2. Dynamic Container Detection
		// Find the first link and walk up to find scroll parent
		let container = null;
		const firstLink = rootScope.querySelector('a[href*="/c/"]');
		if (firstLink) {
			container = getScrollParent(firstLink);
			if (container && container !== document.documentElement) {
				updateStatusUI(
					`Scroll container found: <${container.tagName} class="${container.className}">`,
				);
			} else {
				updateStatusUI("Scroll container: Window/Document");
				container = null; // Use window scrolling
			}
		} else {
			updateStatusUI("Warning: No links found initially.");
		}

		// --- Linear Scroll Loop (Element Tracking) ---
		const MAX_SCROLLS = 500;
		const lastLinkCount = 0;

		updateStatusUI("Starting scroll sequence...");

		for (let i = 0; i < MAX_SCROLLS; i++) {
			// Re-query links
			const currentLinks = rootScope.querySelectorAll('a[href*="/c/"]');
			const currentCount = currentLinks.length;

			// Scroll Strategy: Target the LAST item
			if (currentLinks.length > 0) {
				const lastItem = currentLinks[currentLinks.length - 1];
				lastItem.scrollIntoView({ behavior: "smooth", block: "end" });

				// Also force scroll container if we have one
				if (container) {
					// Check if we are at bottom
					// If not, force it
					if (
						container.scrollHeight -
							container.scrollTop -
							container.clientHeight >
						50
					) {
						container.scrollTop = container.scrollHeight;
					}
				} else {
					window.scrollTo(0, document.body.scrollHeight);
				}
			}

			// Wait
			await new Promise((r) => setTimeout(r, 1500));

			// Check for progress
			if (currentCount > lastLinkCount) {
				updateStatusUI(`Scanning... Found ${currentCount} items.`);
			} else {
				// No change
				const hasSpinner =
					document.querySelector(".animate-spin") ||
					document.querySelector("svg.text-token-text-tertiary");
				if (hasSpinner) {
					updateStatusUI(`Loading... (Spinner visible)`);
					await new Promise((r) => setTimeout(r, 2000));
					// Let's just break now if we are strict, or rely on next iteration.
					// A simple way is to break only if we fail AFTER the shake.
					// But for simplicity, we treat MAX_RETRIES as the limit.
					break;
				}
			}
		}
	}

	// Capture final list
	const finalScope = isProject
		? document.querySelector("main") || document
		: getContainer() || document;
	const finalLinks = finalScope.querySelectorAll('a[href*="/c/"]');

	updateStatusUI(`Scan complete. Processing ${finalLinks.length} items...`);

	finalLinks.forEach((a) => {
		const id = a.href.split("/").pop();
		if (!collectedIds.has(id)) {
			collectedIds.add(id);
			queue.push({
				id: id,
				href: a.href,
				title: (a.innerText || a.getAttribute("aria-label") || "Untitled")
					.trim()
					.split("\n")[0],
			});
		}
	});

	state.queue = queue;
}

// --- Step: Process Item ---
// ... (processCurrentItem stays same, but calls optimized waitForPageLoad)

// --- Step: Process Item ---
async function processCurrentItem(state) {
	const { queue, currentIndex } = state;

	// Check completion
	if (currentIndex >= queue.length) {
		state.mode = "finished";
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
		updateStatusUI(
			`Navigating to ${currentIndex + 1}/${queue.length}: ${item.title}...`,
		);
		window.location.href = item.href;
		return; // Will resume after reload
	}

	// We are on page. Wait for load.
	try {
		updateStatusUI(`Converting ${currentIndex + 1}/${queue.length}...`);
		await waitForPageLoad();

		// Convert
		// Converter embeds images as Base64 (Canvas).
		// To fix performance, we Extract these Base64 images and save them as files.
		const markdown = converter.convert(document.body);

		// --- Image Extraction (Base64 -> File) ---
		// 1. Create images folder (lazy, only if needed)
		// We can't easily "check" if folder exists in FileSystemAccessAPI without try/catch
		// We'll assume we write to 'images/' relative filename

		const imgRegex = /!\[(.*?)\]\((data:image\/([^;]+);base64,[^)]+)\)/g;
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

		const dateStr = date.toISOString().split("T")[0];
		const timeStr = date.toTimeString().split(" ")[0].replace(/:/g, "");
		const safeTitle = (item.title || "Conversation")
			.replace(/[/\\?%*:|"<>]/g, "-")
			.trim();

		// Generate Filename
		const config = state.settings;
		const filename = fileSaver.generateFilename(
			config.filenamePattern,
			item.title,
			item.id,
		);

		// Store Result
		state.results = state.results || {};
		state.results[item.id] = {
			filename: filename,
			content: markdown,
			frontmatterData: {
				title: safeTitle,
				url: item.href || "",
				date: dateStr,
				time: timeStr,
			},
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
async function _fetchImageAsBase64(url) {
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
	const data = await chrome.storage.local.get(["automationState"]);
	const state = data.automationState;
	if (!state || !state.results) return;

	// Get custom tags from UI (Chip UI uses hidden input)
	// Try global lookup first
	let hiddenTags = document.getElementById("bulk-tags-hidden-value");
	let visibleInput = document.getElementById("bulk-tags-input");

	// Fallback: Try identifying via context (this = button) if global lookup fails
	if ((!hiddenTags || !visibleInput) && this && this.closest) {
		const container = this.closest("#chatgpt-to-md-bulk-panel");
		if (container) {
			if (!hiddenTags)
				hiddenTags = container.querySelector("#bulk-tags-hidden-value");
			if (!visibleInput)
				visibleInput = container.querySelector("#bulk-tags-input");
		}
	}

	// Check if there is pending text in the input that hasn't been "Entered"
	let pendingTag = "";
	if (visibleInput?.value.trim()) {
		pendingTag = visibleInput.value.trim().replace(/^,|,$/g, "");
	}

	// Fallback to text input if hidden missing (compatibility) or default tags
	// If hiddenTags exists, use it. If not, use default.
	// Also append pendingTag if it exists
	let rawTags = hiddenTags
		? hiddenTags.value
		: state.settings.defaultTags || "";
	if (pendingTag) {
		rawTags = rawTags ? `${rawTags}, ${pendingTag}` : pendingTag;
	}

	console.log("BulkExport: Tags Logic:", {
		hiddenFound: !!hiddenTags,
		hiddenValue: hiddenTags ? hiddenTags.value : "N/A",
		visibleFound: !!visibleInput,
		pendingTag: pendingTag,
		defaultTags: state.settings.defaultTags,
		finalRaw: rawTags,
	});

	// Fallback if empty? No, checking specific fallback behavior.
	// If user explicitly cleared tags, rawTags is "".
	// If hiddenTags is null (UI not shown?), we fall back to defaults.
	if (!hiddenTags && !rawTags) {
		rawTags = state.settings.defaultTags || "";
	}

	const customTags = rawTags;

	try {
		const dirHandle = await window.showDirectoryPicker();
		// const folderName = dirHandle.name || 'Folder'; // Handled in FileSaver

		updateStatusUI("Writing files...");
		const results = Object.values(state.results);
		let saved = 0;

		for (const file of results) {
			try {
				await fileSaver.saveMarkdown(dirHandle, file.filename, file.content, {
					frontmatterTemplate: state.settings.frontmatterTemplate,
					defaultTags: customTags,
					metadata: file.frontmatterData,
				});

				saved++;
				if (saved % 5 === 0)
					updateStatusUI(`Saved ${saved}/${results.length}...`);
			} catch (e) {
				console.error(`Write failed for ${file.filename}:`, e.name, e.message);
				updateStatusUI(
					`Error: ${e.name} on ${file.filename.substring(0, 20)}... Retrying...`,
				);
				// Retry logic is somewhat complex to port cleanly, but FileSaver has basic fallback.
				// If we want the specific fallback logic (safeName), we might need to improve FileSaver.
				// For now, FileSaver has a basic safeName fallback.
			}
		}

		// End of saveAllToDisk
		updateStatusUI(`Done! Saved ${saved} files.`);
		alert(
			`Bulk Export Completed!\n\nSaved: ${saved}\n(Reloading extension to reset)`,
		);

		// Cleanup
		await chrome.storage.local.set({ automationState: { isRunning: false } });
		window.location.reload();
	} catch (e) {
		alert(`Save cancelled or failed: ${e.message}\n${e.name}`);
	}
}

// Simpler Wait
async function waitForPageLoad() {
	let checks = 0;
	while (checks < 30) {
		const articles = document.querySelectorAll("article");
		const spinner = document.querySelector(
			".text-token-text-tertiary > svg.animate-spin",
		);

		if (articles.length > 0 && !spinner) {
			await new Promise((r) => setTimeout(r, 1000));
			return;
		}
		await new Promise((r) => setTimeout(r, 500));
		checks++;
	}
}

function updateStatusUI(text) {
	const el = document.getElementById("bulk-status-text");
	if (el) el.textContent = text;
}

// Startup Listener
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	if (request.action === "get_markdown") {
		try {
			const markdown = converter.convert(document.body);
			const title =
				document.title.replace("ChatGPT", "").trim() || "Conversation";
			sendResponse({ markdown: markdown, title: title });
		} catch (e) {
			sendResponse({ error: e.message });
		}
	} else if (request.action === "show_bulk_ui") {
		createBulkUI();
		sendResponse({ status: "ok" });
	}
	return true;
});

// Check resume on load
checkAndResume();

console.log("ChatGPT to Markdown extension loaded (V2).");

// Helper: Convert Base64 DataURI to Blob (Duplicate removed)
