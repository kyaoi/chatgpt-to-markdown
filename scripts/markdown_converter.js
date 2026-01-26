class MarkdownConverter {
    constructor() {
        // No external dependencies for now
        this.lastImageSrc = null;
    }

    convert(element) {
        this.lastImageSrc = null; // Reset per conversion
        let markdown = "";
        const articles = element.querySelectorAll('article');
        
        // Find all message blocks
        articles.forEach(article => {
            const roleElement = article.querySelector('[data-message-author-role]');
            const role = roleElement ? roleElement.getAttribute('data-message-author-role') : 'user'; 
            
            markdown += `# ${role.charAt(0).toUpperCase() + role.slice(1)}\n\n`;
            
            let contentNode = article.querySelector('.markdown');
            
            if (!contentNode) {
                contentNode = roleElement ? roleElement.parentElement.parentElement : article; 
            }
            
            if (contentNode) {
                 const textContent = this.domToMarkdown(contentNode);
                 markdown += textContent.trim() + "\n\n---\n\n";
            }
        });

        // Final cleanup: Remove excessive newlines (3 or more becomes 2)
        return markdown.replace(/\n{3,}/g, '\n\n').trim();
    }

    domToMarkdown(node) {
        if (!node) return "";
        let text = "";
        
        // Block tags where pure whitespace children should be ignored
        const BLOCK_TAGS = ['div', 'section', 'article', 'aside', 'header', 'footer', 'ul', 'ol', 'pre', 'blockquote', 'table', 'tbody', 'thead', 'tr'];
        const parentTag = node.tagName ? node.tagName.toLowerCase() : '';

        node.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                // If parent is a structural block, usually direct text nodes are whitespace for formatting
                // We shouldn't strip inside 'p' or 'span' usually, but 'div' heavily depends. 
                // ChatGPT structure is pretty clean though.
                if (BLOCK_TAGS.includes(parentTag) && child.textContent.trim().length === 0) {
                    return; 
                }
                text += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const tagName = child.tagName.toLowerCase();
                const isHidden = window.getComputedStyle(child).display === 'none';
                if (isHidden) return;

                // --- UI Cleaning Filters ---
                
                // 1. Extension Icons (e.g. PDF viewer icon)
                if (tagName === 'img' && child.src.startsWith('chrome-extension://')) {
                    console.log("Skipping extension icon:", child.src);
                    return;
                }

                // ... (skip 2) ...

                // 3. Thinking Process
                if (tagName === 'div' || tagName === 'span') {
                     if (child.children.length > 0) {
                         // Has children, continue
                     } else {
                         const text = child.textContent.trim();
                         if (text.startsWith('Thinking time:') || text.startsWith('思考時間:') || text === 'Thinking...') {
                             console.log("Skipping Thinking text:", text);
                             return;
                         }
                     }
                }
                
                // ---------------------------

                switch (tagName) {
                    // ... (skip cases) ...
                    case 'img':
                        const alt = child.getAttribute('alt') || '';
                        const src = child.getAttribute('src') || '';
                        console.log("Found Image:", src, "Alt:", alt);
                        
                        // Deduplication
                        if (src === this.lastImageSrc) {
                            console.log("Skipping duplicate image:", src);
                            return; 
                        }
                        this.lastImageSrc = src;

                        // Try Base64
                        let base64 = this.imageToBase64(child);
                        console.log("Canvas conversion result:", base64 ? "Success (Length: " + base64.length + ")" : "Failed/Null");
                        
                        if (!base64 && src) {
                             base64 = src;
                        }

                        text += `![${alt}](${base64})`;
                        break;
                    case 'table':
                        // ...
                        this.lastImageSrc = null; // Reset on structural change
                        text += this.processTable(child) + "\n\n";
                        break;
                    case 'br':
                        text += "\n";
                        break;
                    case 'div': 
                    case 'span':
                    case 'section':
                    case 'article':
                        // Reset duplicate tracker for block elements to be safe? 
                        // Actually, images are often adjacent. Let's keep tracker valid unless we hit a new message block.
                        // Ideally we reset in convert() loop.

                        // Check for KaTeX math
                        if (child.classList && child.classList.contains('katex')) {
                            const annotation = child.querySelector('annotation[encoding="application/x-tex"]');
                            if (annotation) {
                                // Check if it's block math (often displayed as block - this is a heuristic)
                                // Standard KaTeX generic is usually inline, but let's check display style
                                // simpler: ChatGPT treats \[ ... \] as display and \( ... \) as inline usually, 
                                // but here we are extracting from DOM.
                                // If it's a div.katex-display, use $$.
                                const isBlock = child.classList.contains('katex-display') || 
                                                (child.tagName.toLowerCase() === 'div' && child.classList.contains('math-display')) ||
                                                (child.parentElement && child.parentElement.classList.contains('katex-display'));
                                
                                const latex = annotation.textContent;
                                text += isBlock ? `\n$$\n${latex}\n$$\n` : `$${latex.replace(/\n/g, ' ')}$`;
                                break; // Skip default recursion for this node
                            }
                        }
                        text += this.domToMarkdown(child);
                        break;
                    case 'math': // fallback if we hit a raw math tag not wrapped in known katex structure
                         const annotation = child.querySelector('annotation[encoding="application/x-tex"]');
                         if (annotation) {
                                                           text += `$${annotation.textContent}$`;
                         } else {
                             // Fallback to text content if no latex found (unlikely in this context but safe)
                             text += child.textContent;
                         }
                         break;
                    default:
                        text += this.domToMarkdown(child);
                }
            }
        });
        
        return text;
    }


    processList(listNode, isOrdered) {
        let text = "";
        let index = 1;
        
        listNode.childNodes.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'li') {
                const marker = isOrdered ? `${index}. ` : "- ";
                // Indent child lines for nested lists (basic approach)
                let content = this.domToMarkdown(child).trim();
                // If content has newlines, indent them? Complex for nested, but simple list for now.
                text += `${marker}${content}\n`;
                index++;
            }
        });
        return text + "\n";
    }

    processTable(tableNode) {
        let text = "";
        const rows = tableNode.querySelectorAll('tr');
        if (rows.length === 0) return "";
        
        const headers = rows[0].querySelectorAll('th, td');
        
        // Header row
        let headerLine = "|";
        let separatorLine = "|";
        
        headers.forEach(h => {
            headerLine += ` ${h.textContent.trim()} |`;
            separatorLine += " --- |";
        });
        
        text += headerLine + "\n" + separatorLine + "\n";
        
        // Data rows
        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td');
            let rowLine = "|";
            cells.forEach(c => {
                rowLine += ` ${c.textContent.trim()} |`;
            });
            text += rowLine + "\n";
        }
        
        return text;
    }
    imageToBase64(img) {
        try {
            if (!img.complete || img.naturalWidth === 0) return null;

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            return canvas.toDataURL('image/png');
        } catch (e) {
            console.warn("Canvas conversion failed (likely tainted)", e);
            return null;
        }
    }
}

