class FileSaver {
	/**
	 * Generate a filename based on the pattern and metadata.
	 * @param {string} pattern - Filename pattern (e.g. "{title}_{date}")
	 * @param {string} title - Conversation title
	 * @param {string} id - Conversation ID (or timestamp if not available)
	 * @returns {string} - The generated filename ending with .md
	 */
	generateFilename(pattern, title, id) {
		const date = new Date();
		const dateStr = date.toISOString().split("T")[0];
		const timeStr = date.toTimeString().split(" ")[0].replace(/:/g, "");
		// Safe title: allow CJK but remove dangerous OS characters
		// Original popup logic: .replace(/[/\\?%*:|"<>]/g, '-')
		// Original content logic fallback: .replace(/[^\w\u00C0-\u024f\u3000-\u30ff\u4e00-\u9faf\uff01-\uff5e ]/g, '_')
		// We will use the popup logic as it's more standard for filenames, but maybe slightly stricter to be safe.
		const safeTitle = (title || "Conversation")
			.replace(/[/\\?%*:|"<>]/g, "-")
			.trim()
			.substring(0, 100);

		let filename = pattern
			.replace("{title}", safeTitle)
			.replace("{date}", dateStr)
			.replace("{time}", timeStr)
			.replace("{id}", id || Date.now().toString());

		if (!filename.endsWith(".md")) {
			filename += ".md";
		}
		return filename;
	}

	/**
	 * Main method to save Markdown processing frontmatter and images.
	 * @param {FileSystemDirectoryHandle} dirHandle - Root directory handle
	 * @param {string} filename - Target filename
	 * @param {string} content - Raw markdown content
	 * @param {object} options - Configuration options
	 * @param {string} options.frontmatterTemplate - Template for frontmatter
	 * @param {string} options.defaultTags - Default tags string
	 * @param {object} options.metadata - { title, url, date, time, folderName }
	 * @returns {Promise<void>}
	 */
	async saveMarkdown(dirHandle, filename, content, options) {
		let finalContent = content;
		const { frontmatterTemplate, defaultTags, metadata } = options;
		const folderName = dirHandle.name || "Folder";

		// 1. Process Images (Extract Base64 -> Files)
		// We do this first so the markdown links are updated before saving the file
		try {
			finalContent = await this._extractAndSaveImages(
				dirHandle,
				finalContent,
				filename,
			);
		} catch (e) {
			console.error("FileSaver: Image extraction failed", e);
			// Continue saving text even if images fail
		}

		// 2. Process Frontmatter
		if (frontmatterTemplate && frontmatterTemplate.trim() !== "") {
			finalContent = this._processFrontmatter(
				finalContent,
				frontmatterTemplate,
				defaultTags,
				{
					...metadata,
					folderName: folderName,
				},
			);
		}

		// 3. Write File
		await this._writeFile(dirHandle, filename, finalContent);
	}

	async _writeFile(dirHandle, filename, content) {
		try {
			const fileHandle = await dirHandle.getFileHandle(filename, {
				create: true,
			});
			const writable = await fileHandle.createWritable({
				keepExistingData: true,
			});
			const blob = new Blob([content], { type: "text/markdown" });
			await writable.write({ type: "write", position: 0, data: blob });
			await writable.truncate(blob.size);
			await writable.close();
		} catch (e) {
			// Fallback logic if filename is invalid
			console.error(`FileSaver: Write failed for ${filename}`, e);

			// Try a safer filename
			const safeName = `backup_${Date.now()}.md`;
			console.log(`FileSaver: Retrying with ${safeName}`);

			const fileHandle = await dirHandle.getFileHandle(safeName, {
				create: true,
			});
			const writable = await fileHandle.createWritable({
				keepExistingData: true,
			});
			const backupContent = `<!-- Original Filename: ${filename} -->\n${content}`;
			const blob = new Blob([backupContent], { type: "text/markdown" });
			await writable.write({ type: "write", position: 0, data: blob });
			await writable.truncate(blob.size);
			await writable.close();
		}
	}

	/**
	 * Extracts Base64 images, saves them to 'images/' folder, and updates Markdown links.
	 */
	/**
	 * Extracts images, downloads them, saves to 'images/' folder, and updates Markdown links.
	 */
	async _extractAndSaveImages(dirHandle, markdown, filename) {
		// Match standard markdown images: ![alt](url)
		// Relaxed regex to capture any non-closing-paren URL character
		const imgRegex = /!\[(.*?)\]\((.+?)\)/g;
		const matches = [...markdown.matchAll(imgRegex)];

		if (matches.length === 0) {
            console.log("FileSaver: No images found in markdown.");
            return markdown;
        }

        console.log(`FileSaver: Found ${matches.length} images to save.`);

		let newMarkdown = markdown;
		let imgCount = 0;
		const baseName = filename.replace(".md", "");

		// Create images directory
		let imagesDir;
		try {
			imagesDir = await dirHandle.getDirectoryHandle("images", {
				create: true,
			});
		} catch (e) {
			console.error("FileSaver: Could not create images directory", e);
            // Alert user if possible, or just return.
            // Since we process in background often, console.error is best we can do here.
			return markdown;
		}

		for (const match of matches) {
			try {
				const fullMatch = match[0];
				const alt = match[1];
				const url = match[2];

                // Skip if URL is a reference to already saved local file (re-run safety)
                if (url.startsWith("images/")) continue;

				// Basic extension detection
				let ext = "png";
                // Helper to check extension
                const lowerUrl = url.toLowerCase();
				if (lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg")) ext = "jpg";
				else if (lowerUrl.includes(".webp")) ext = "webp";
				else if (lowerUrl.includes(".gif")) ext = "gif";
                else if (lowerUrl.startsWith("data:image/jpeg")) ext = "jpg";
                else if (lowerUrl.startsWith("data:image/webp")) ext = "webp";

				const imgFilename = `${baseName}_img${imgCount}.${ext}`;

				// Clean the URL (remove tracking/resizing params)
				const cleanUrl = this._cleanImageUrl(url);
				
				// Fetch the image (works for http, blob:, data:)
				const response = await fetch(cleanUrl);
				if (!response.ok)
					throw new Error(`Failed to fetch image: ${response.statusText}`);
				const blob = await response.blob();

				// Write to file
				const imgHandle = await imagesDir.getFileHandle(imgFilename, {
					create: true,
				});
				const writable = await imgHandle.createWritable();
				await writable.write(blob);
				await writable.close();

				// Update Markdown link results in ![[images/filename.png]] for Obsidian
				newMarkdown = newMarkdown.replace(
					fullMatch,
					`![[images/${imgFilename}]]\n`,
				);
				imgCount++;
			} catch (err) {
				console.error("FileSaver: Failed to save specific image", err);
			}
		}
		return newMarkdown;
	}

	/**
	 * Remove specific query parameters from the image URL.
	 * @param {string} url - The original URL
	 * @returns {string} - The cleaned URL
	 */
	_cleanImageUrl(url) {
		try {
			const urlObj = new URL(url);
			// params to remove: u, h, c, p
			const paramsToRemove = ["u", "h", "c", "p"];
			paramsToRemove.forEach((param) => urlObj.searchParams.delete(param));
			return urlObj.toString();
		} catch (e) {
			// If URL parsing fails (e.g. data URI), return original
			return url;
		}
	}



	/**
	 * Convert blob: and signed URLs to Data URIs (Base64) to persist them across navigations.
	 * @param {string} markdown - The markdown content
	 * @returns {Promise<string>} - The markdown with inlined images
	 */
	async inlineImages(markdown) {
		const imgRegex = /!\[(.*?)\]\((.+?)\)/g;
		const matches = [...markdown.matchAll(imgRegex)];

		if (matches.length === 0) return markdown;

		let newMarkdown = markdown;

		for (const match of matches) {
			const fullMatch = match[0];
			const url = match[2];

			// Only inline temporary/private URLs
			if (
				url.startsWith("blob:") ||
				url.includes("files.oaiusercontent.com") ||
				url.startsWith("data:") // already data, but maybe we want to normalize? No, skip.
			) {
				if (url.startsWith("data:")) continue;

				try {
					const response = await fetch(url);
					const blob = await response.blob();
					
					// Convert to Base64
					const reader = new FileReader();
					const base64 = await new Promise((resolve, reject) => {
						reader.onloadend = () => resolve(reader.result);
						reader.onerror = reject;
						reader.readAsDataURL(blob);
					});

					newMarkdown = newMarkdown.replace(fullMatch, `![${match[1]}](${base64})`);
				} catch (e) {
					console.error("FileSaver: Failed to inline image", url, e);
				}
			}
		}
		return newMarkdown;
	}

	_processFrontmatter(content, template, defaultTags, metadata) {
		const { title, url, date, time, folderName } = metadata;

		// Prepare Tags
		const tagsRaw = defaultTags || "";

		// Variable Substitution for Tags
		const fileTags = tagsRaw
			.replace(/{title}/g, title)
			.replace(/{date}/g, date)
			.replace(/{time}/g, time)
			.replace(/{folder}/g, folderName)
			.replace(/{url}/g, url || "");

		// Format tags as [tag1, tag2]
		const tagList = fileTags
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
		const tagArrayString = `[${tagList.join(", ")}]`;

		// Smart Override: If template lacks {tags} but we have tags, force update the template
		// Only if there are actual tags to add
		let activeTemplate = template;
		if (!activeTemplate.includes("{tags}") && tagList.length > 0) {
			// Regex to match "tags:" followed by list items or inline array
			const listRegex = /tags:\s*(\n\s*-\s*.*)+/g;
			const inlineRegex = /tags:.*$/gm;

			if (listRegex.test(activeTemplate)) {
				activeTemplate = activeTemplate.replace(listRegex, "tags: {tags}");
			} else if (inlineRegex.test(activeTemplate)) {
				activeTemplate = activeTemplate.replace(inlineRegex, "tags: {tags}");
			} else {
				// Attempt to insert before last "---" if present
				const lastDash = activeTemplate.lastIndexOf("---");
				if (lastDash > 3) {
					activeTemplate =
						activeTemplate.substring(0, lastDash) +
						"tags: {tags}\n" +
						activeTemplate.substring(lastDash);
				} else {
					activeTemplate = `${activeTemplate}\ntags: {tags}`;
				}
			}
		}

		const frontmatter = activeTemplate
			.replace(/{folder}/g, folderName)
			.replace(/{title}/g, title)
			.replace(/{url}/g, url || "")
			.replace(/{date}/g, date)
			.replace(/{time}/g, time)
			.replace(/{tags}/g, tagArrayString);

		return frontmatter + content;
	}


}

globalThis.FileSaver = FileSaver;
