document.addEventListener("DOMContentLoaded", () => {
	const saveBtn = document.getElementById("save-btn");
	const statusMsg = document.getElementById("status-msg");
	const settingsPanel = document.getElementById("settings-panel");
	const openSettingsBtn = document.getElementById("open-settings");
	const closeSettingsBtn = document.getElementById("close-settings");
	const exportBtn = document.getElementById("export-settings-btn");
	const importBtn = document.getElementById("import-settings-btn");
	const importFileInput = document.getElementById("import-file-input");

	// UI Elements
	const previewFilename = document.getElementById("preview-filename");
	const previewDate = document.getElementById("preview-date");
	const connectionStatus = document.getElementById("connection-status");

	// Settings elements
	const filenameInput = document.getElementById("filename-pattern");
	const selectFolderBtn = document.getElementById("select-folder-btn");
	const folderNameDisplay = document.getElementById("folder-name");
	const clearFolderBtn = document.getElementById("clear-folder-btn");
	const launchBulkBtn = document.getElementById("launch-bulk-btn");
	// subfolder-name removed
	const frontmatterInput = document.getElementById("frontmatter-template");
	const defaultTagsInput = document.getElementById("default-tags"); // Added missing definition
	const subfolderInput = document.getElementById("subfolder-name");

	// State
	const DEFAULT_PATTERN = "{title}_{date}_{time}";

	// ...

	// Default Frontmatter
	const DEFAULT_FRONTMATTER = "";
	const DEFAULT_TAGS = ""; // Added missing constant
	// In popup.html we removed subfolderName? Yes.
	// But `chrome.storage.sync.get... subfolderName` relies on it?
	// Line 76: get(['subfolderName'])
	// Line 83: if (result.subfolderName) { subfolderInput.value = ... }
	// If subfolderInput is null, line 84 throws error.
	// I should check if I should remove subfolderName usage.
	// User requested "No input field". The "subfolder" logic was for the old mechanism.
	// I should likely remove subfolderInput related code too.

	// State
	const currentTitle = "";
	const currentUrl = "";

	// Initialize Preview
	function initPreview() {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (
				tabs[0].url &&
				(tabs[0].url.includes("chatgpt.com") ||
					tabs[0].url.includes("chat.openai.com"))
			) {
				// Connected
				if (connectionStatus) connectionStatus.classList.add("connected");

				// Get Title
				let title = tabs[0].title || "Conversation";
				title = title
					.replace("ChatGPT", "")
					.replace(/ - OpenAI$/, "")
					.trim();
				if (!title) title = "Conversation";

				// Generate Preview Filename
				chrome.storage.sync.get(["filenamePattern"], (res) => {
					const pattern = res.filenamePattern || DEFAULT_PATTERN;
					const filename = generateFilename(pattern, title);

					if (previewFilename) previewFilename.textContent = filename;

					const date = new Date();
					if (previewDate) previewDate.textContent = date.toLocaleString();
				});
			} else {
				if (previewFilename)
					previewFilename.textContent = "No ChatGPT Tab Detected";
				if (previewDate) previewDate.textContent = "Please open ChatGPT";
				if (statusMsg)
					statusMsg.textContent = "Please open a ChatGPT conversation.";
			}
		});
	}

	// Call init
	initPreview();

	// IDB Helper
	const DB_NAME = "ChatGPTToMarkdownDB";
	const STORE_NAME = "settings";

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
			const transaction = db.transaction(STORE_NAME, "readonly");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.get("dirHandle");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	async function saveDirHandle(handle) {
		const db = await openDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, "readwrite");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.put(handle, "dirHandle");
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	async function clearDirHandle() {
		const db = await openDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, "readwrite");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.delete("dirHandle");
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	// Load settings
	chrome.storage.sync.get(
		{
			filenamePattern: DEFAULT_PATTERN,
			frontmatterTemplate: DEFAULT_FRONTMATTER,
			defaultTags: DEFAULT_TAGS,
		},
		async (result) => {
			filenameInput.value = result.filenamePattern;
			frontmatterInput.value = result.frontmatterTemplate;
			if (defaultTagsInput) defaultTagsInput.value = result.defaultTags;

			try {
				const handle = await getDirHandle();
				if (handle) {
					folderNameDisplay.textContent = handle.name;
					clearFolderBtn.style.display = "inline-flex";
				}
			} catch (e) {
				console.error(e);
			}
		},
	);

	// Save settings on input change
	function saveSettings() {
		chrome.storage.sync.set(
			{
				filenamePattern: filenameInput.value,
				frontmatterTemplate: frontmatterInput.value,
				defaultTags: defaultTagsInput ? defaultTagsInput.value : DEFAULT_TAGS,
			},
			() => {
				// Re-init preview to reflect pattern changes
				initPreview();
			},
		);
	}

	filenameInput.addEventListener("input", saveSettings);
	frontmatterInput.addEventListener("input", saveSettings);
	if (defaultTagsInput)
		defaultTagsInput.addEventListener("input", saveSettings);

	// selectFolderBtn listener
	selectFolderBtn.addEventListener("click", async () => {
		try {
			const handle = await window.showDirectoryPicker();
			await saveDirHandle(handle);
			folderNameDisplay.textContent = handle.name;
			clearFolderBtn.style.display = "inline-flex";
		} catch (e) {
			if (e.name !== "AbortError") {
				console.error(e);
				statusMsg.textContent = "Error selecting folder";
			}
		}
	});

	clearFolderBtn.addEventListener("click", async () => {
		await clearDirHandle();
		folderNameDisplay.textContent = "No folder selected";
		clearFolderBtn.style.display = "none";
	});

	// Export Settings
	exportBtn.addEventListener("click", () => {
		chrome.storage.sync.get(null, (items) => {
			const json = JSON.stringify(items, null, 2);
			const blob = new Blob([json], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			chrome.downloads.download({
				url: url,
				filename: "chatgpt_to_markdown_settings.json",
				saveAs: true,
			});
		});
	});

	// Import Settings
	// Note: The input is now overlaying the button, so we don't need a click listener on the button.
	// importBtn.addEventListener('click', () => { importFileInput.click(); });

	importFileInput.addEventListener("change", (e) => {
		const file = e.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const settings = JSON.parse(event.target.result);
				chrome.storage.sync.set(settings, () => {
					statusMsg.textContent = "Settings imported!";

					// Update UI
					if (settings.filenamePattern)
						filenameInput.value = settings.filenamePattern;
					if (settings.frontmatterTemplate !== undefined)
						frontmatterInput.value = settings.frontmatterTemplate;

					initPreview();
					setTimeout(() => (statusMsg.textContent = ""), 2000);
				});
			} catch (err) {
				statusMsg.textContent = "Invalid JSON file.";
			}
		};
		reader.readAsText(file);
	});

	const fileSaver = new FileSaver();

	// Helper: Generate Filename (Delegated to FileSaver)
	function generateFilename(pattern, title) {
		// Use pattern from storage or default
		// We need to fetch pattern first usually, but here we just wrap for convenience or use direct call
		// Actually, let's keep it simple and just use fileSaver.generateFilename where needed.
		return fileSaver.generateFilename(pattern, title, Date.now().toString());
	}

	function saveMarkdownDirect(rawMarkdown, title, url, dirHandle, filename) {
		return new Promise((resolve, reject) => {
			// Retrieve defaults and template
			chrome.storage.sync.get(
				{
					defaultTags: DEFAULT_TAGS,
					frontmatterTemplate: DEFAULT_FRONTMATTER,
				},
				async (settings) => {
					try {
						const date = new Date();
						const metadata = {
							title: title,
							url: url,
							date: date.toISOString().split("T")[0],
							time: date.toTimeString().split(" ")[0].replace(/:/g, ""),
							id: Date.now().toString(),
						};

						await fileSaver.saveMarkdown(dirHandle, filename, rawMarkdown, {
							frontmatterTemplate: settings.frontmatterTemplate,
							defaultTags: settings.defaultTags,
							metadata: metadata,
						});

						statusMsg.textContent = `Saved to ${dirHandle.name}!`;
						setTimeout(() => (statusMsg.textContent = ""), 3000);
						resolve();
					} catch (e) {
						console.error("Save Error:", e);
						if (e.name === "InvalidStateError") {
							statusMsg.textContent =
								"Error: Folder access lost. Please re-select folder.";
						} else if (e.name === "NotAllowedError") {
							statusMsg.textContent =
								"Error: Permission denied. Re-select folder.";
						} else {
							statusMsg.textContent = "Write error: " + e.message;
						}
						reject(e);
					}
				},
			);
		});
	}

	// Helper: dataURItoBlob removed (handled in FileSaver)

	// Event Listeners

	saveBtn.addEventListener("click", () => {
		statusMsg.textContent = "Processing...";
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (
				tabs[0].url &&
				(tabs[0].url.includes("chatgpt.com") ||
					tabs[0].url.includes("chat.openai.com"))
			) {
				chrome.tabs.sendMessage(
					tabs[0].id,
					{ action: "get_markdown" },
					async (response) => {
						if (chrome.runtime.lastError) {
							statusMsg.textContent =
								"Error: " + chrome.runtime.lastError.message;
						} else if (response && response.markdown) {
							try {
								// 1. Get StartIn Handle
								let startInHandle ;
								try {
									startInHandle = await getDirHandle();
								} catch (e) {
									// Ignore if no default handle
								}

								// 2. Open Directory Picker
								// Use try/catch to handle user cancellation
								const finalDirHandle = await window.showDirectoryPicker({
									id: "save-folder-picker",
									startIn: startInHandle,
									mode: "readwrite",
								});

								// 3. Generate Filename (Need pattern from settings)
								chrome.storage.sync.get(["filenamePattern"], async (res) => {
									try {
										const pattern = res.filenamePattern || DEFAULT_PATTERN;
										const filename = generateFilename(pattern, response.title);

										// 4. Save Content FIRST
										await saveMarkdownDirect(
											response.markdown,
											response.title,
											tabs[0].url,
											finalDirHandle,
											filename,
										);

										// 5. Save Handle LAST (Only if write succeeded)
										await saveDirHandle(finalDirHandle);

										folderNameDisplay.textContent = finalDirHandle.name;
										clearFolderBtn.style.display = "inline-flex";
									} catch (innerErr) {
										console.error("Save failed:", innerErr);
										// statusMsg handled in saveMarkdownDirect
									}
								});
							} catch (e) {
								if (e.name !== "AbortError") {
									console.error(e);
									statusMsg.textContent = "Save cancelled or failed.";
								} else {
									statusMsg.textContent = ""; // Cancelled
								}
							}
						} else {
							statusMsg.textContent = "Failed to get content.";
						}
					},
				);
			} else {
				statusMsg.textContent = "Please open a ChatGPT conversation.";
			}
		});
	});

	launchBulkBtn.addEventListener("click", () => {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (
				tabs[0].url &&
				(tabs[0].url.includes("chatgpt.com") ||
					tabs[0].url.includes("chat.openai.com"))
			) {
				chrome.tabs.sendMessage(
					tabs[0].id,
					{ action: "show_bulk_ui" },
					(response) => {
						if (chrome.runtime.lastError) {
							statusMsg.textContent =
								"Error: " + chrome.runtime.lastError.message;
						} else {
							window.close(); // Close popup so user can use the injected UI
						}
					},
				);
			} else {
				statusMsg.textContent = "Open ChatGPT first.";
			}
		});
	});

	openSettingsBtn.addEventListener("click", () => {
		settingsPanel.classList.remove("hidden");
	});

	closeSettingsBtn.addEventListener("click", () => {
		settingsPanel.classList.add("hidden");
	});
});
