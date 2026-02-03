class FileSaver {
    constructor() {
        // No dependencies
    }

    /**
     * Generate a filename based on the pattern and metadata.
     * @param {string} pattern - Filename pattern (e.g. "{title}_{date}")
     * @param {string} title - Conversation title
     * @param {string} id - Conversation ID (or timestamp if not available)
     * @returns {string} - The generated filename ending with .md
     */
    generateFilename(pattern, title, id) {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
        // Safe title: allow CJK but remove dangerous OS characters
        // Original popup logic: .replace(/[/\\?%*:|"<>]/g, '-')
        // Original content logic fallback: .replace(/[^\w\u00C0-\u024f\u3000-\u30ff\u4e00-\u9faf\uff01-\uff5e ]/g, '_')
        // We will use the popup logic as it's more standard for filenames, but maybe slightly stricter to be safe.
        const safeTitle = (title || 'Conversation').replace(/[/\\?%*:|"<>]/g, '-').trim().substring(0, 100);

        let filename = pattern
            .replace('{title}', safeTitle)
            .replace('{date}', dateStr)
            .replace('{time}', timeStr)
            .replace('{id}', id || Date.now().toString());

        if (!filename.endsWith('.md')) {
            filename += '.md';
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
        const folderName = dirHandle.name || 'Folder';

        // 1. Process Images (Extract Base64 -> Files)
        // We do this first so the markdown links are updated before saving the file
        try {
            finalContent = await this._extractAndSaveImages(dirHandle, finalContent, filename);
        } catch (e) {
            console.error("FileSaver: Image extraction failed", e);
            // Continue saving text even if images fail
        }

        // 2. Process Frontmatter
        if (frontmatterTemplate && frontmatterTemplate.trim() !== '') {
            finalContent = this._processFrontmatter(finalContent, frontmatterTemplate, defaultTags, {
                ...metadata,
                folderName: folderName
            });
        }

        // 3. Write File
        await this._writeFile(dirHandle, filename, finalContent);
    }

    async _writeFile(dirHandle, filename, content) {
        try {
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
        } catch (e) {
            // Fallback logic if filename is invalid
             console.error(`FileSaver: Write failed for ${filename}`, e);
             
             // Try a safer filename
             const safeName = `backup_${Date.now()}.md`;
             console.log(`FileSaver: Retrying with ${safeName}`);
             
             const fileHandle = await dirHandle.getFileHandle(safeName, { create: true });
             const writable = await fileHandle.createWritable();
             // Prepend original filename hint
             await writable.write(`<!-- Original Filename: ${filename} -->\n` + content);
             await writable.close();
        }
    }

    /**
     * Extracts Base64 images, saves them to 'images/' folder, and updates Markdown links.
     */
    async _extractAndSaveImages(dirHandle, markdown, filename) {
        const imgRegex = /!\[(.*?)\]\((data:image\/([^;]+);base64,[^)]+)\)/g;
        const matches = [...markdown.matchAll(imgRegex)];
        
        if (matches.length === 0) return markdown;

        let newMarkdown = markdown;
        let imgCount = 0;
        const baseName = filename.replace('.md', '');

        // Create images directory
        let imagesDir;
        try {
            imagesDir = await dirHandle.getDirectoryHandle('images', { create: true });
        } catch (e) {
            console.error("FileSaver: Could not create images directory", e);
            return markdown; // Abort image extraction if we can't create folder
        }

        for (const match of matches) {
            try {
                const fullMatch = match[0];
                // const alt = match[1]; // Unused
                const dataURI = match[2];
                const ext = match[3] === 'jpeg' ? 'jpg' : match[3];
                
                const imgFilename = `${baseName}_img${imgCount}.${ext}`;
                const blob = this._dataURItoBlob(dataURI);
                
                const imgHandle = await imagesDir.getFileHandle(imgFilename, { create: true });
                const writable = await imgHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                
                newMarkdown = newMarkdown.replace(fullMatch, `![[images/${imgFilename}]]`);
                imgCount++;
            } catch (err) {
                console.error("FileSaver: Failed to save specific image", err);
            }
        }
        return newMarkdown;
    }

    _processFrontmatter(content, template, defaultTags, metadata) {
        const { title, url, date, time, folderName } = metadata;
        
        // Prepare Tags
        let tagsRaw = defaultTags || '';
        
        // Variable Substitution for Tags
        const fileTags = tagsRaw
            .replace(/{title}/g, title)
            .replace(/{date}/g, date)
            .replace(/{time}/g, time)
            .replace(/{folder}/g, folderName)
            .replace(/{url}/g, url || '');

        // Format tags as [tag1, tag2]
        const tagList = fileTags.split(',').map(t => t.trim()).filter(Boolean);
        const tagArrayString = '[' + tagList.join(', ') + ']';

        // Smart Override: If template lacks {tags} but we have tags, force update the template
        // Only if there are actual tags to add
        let activeTemplate = template;
        if (!activeTemplate.includes('{tags}') && tagList.length > 0) {
            // Regex to match "tags:" followed by list items or inline array
            const listRegex = /tags:\s*(\n\s*-\s*.*)+/g;
            const inlineRegex = /tags:.*$/gm;

            if (listRegex.test(activeTemplate)) {
                activeTemplate = activeTemplate.replace(listRegex, 'tags: {tags}');
            } else if (inlineRegex.test(activeTemplate)) {
                activeTemplate = activeTemplate.replace(inlineRegex, 'tags: {tags}');
            } else {
                // Attempt to insert before last "---" if present
                const lastDash = activeTemplate.lastIndexOf('---');
                if (lastDash > 3) {
                    activeTemplate = activeTemplate.substring(0, lastDash) + 'tags: {tags}\n' + activeTemplate.substring(lastDash);
                } else {
                    activeTemplate = activeTemplate + '\ntags: {tags}';
                }
            }
        }

        const frontmatter = activeTemplate
            .replace(/{folder}/g, folderName)
            .replace(/{title}/g, title)
            .replace(/{url}/g, url || '')
            .replace(/{date}/g, date)
            .replace(/{time}/g, time)
            .replace(/{tags}/g, tagArrayString);

        return frontmatter + content;
    }

    _dataURItoBlob(dataURI) {
        const byteString = atob(dataURI.split(',')[1]);
        const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], {type: mimeString});
    }
}
