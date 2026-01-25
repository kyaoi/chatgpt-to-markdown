class MarkdownConverter {
    constructor() {
        // No external dependencies for now
    }

    convert(element) {
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

                switch (tagName) {
                    case 'p':
                        text += this.domToMarkdown(child).trim() + "\n\n";
                        break;
                    case 'h1':
                        text += "# " + this.domToMarkdown(child).trim() + "\n\n";
                        break;
                    case 'h2':
                        text += "## " + this.domToMarkdown(child).trim() + "\n\n";
                        break;
                    case 'h3':
                        text += "### " + this.domToMarkdown(child).trim() + "\n\n";
                        break;
                    case 'h4':
                        text += "#### " + this.domToMarkdown(child).trim() + "\n\n";
                        break;
                    case 'h5':
                        text += "##### " + this.domToMarkdown(child).trim() + "\n\n";
                        break;
                    case 'h6':
                        text += "###### " + this.domToMarkdown(child).trim() + "\n\n";
                        break;
                    case 'blockquote':
                        const quoteContent = this.domToMarkdown(child).trim();
                        text += quoteContent.split('\n').map(line => '> ' + line).join('\n') + "\n\n";
                        break;
                    case 'ul':
                        text += this.processList(child, false) + "\n";
                        break;
                    case 'ol':
                        text += this.processList(child, true) + "\n";
                        break;
                    case 'li':
                        // Handled by processList, but for recursion safety:
                         text += this.domToMarkdown(child);
                        break;
                    case 'pre':
                        // Check for code block content
                        const codeBlock = child.querySelector('code');
                        if (codeBlock) {
                            const langClass = Array.from(codeBlock.classList).find(c => c.startsWith('language-'));
                            const lang = langClass ? langClass.replace('language-', '') : '';
                            text += "```" + lang + "\n" + codeBlock.innerText + "\n```\n\n";
                        } else {
                             text += "```\n" + child.innerText + "\n```\n\n";
                        }
                        break;
                    case 'code':
                        if (node.tagName.toLowerCase() !== 'pre') {
                            text += "`" + child.textContent + "`";
                        } else {
                            text += child.textContent;
                        }
                        break;
                    case 'a':
                        const linkText = this.domToMarkdown(child);
                        const href = child.getAttribute('href');
                        text += href ? `[${linkText}](${href})` : linkText;
                        break;
                    case 'strong':
                    case 'b':
                        text += "**" + this.domToMarkdown(child) + "**";
                        break;
                    case 'em':
                    case 'i':
                        text += "*" + this.domToMarkdown(child) + "*";
                        break;
                    case 'img':
                        const alt = child.getAttribute('alt') || '';
                        const src = child.getAttribute('src') || '';
                        text += `![${alt}](${src})`;
                        break;
                    case 'table':
                        text += this.processTable(child) + "\n\n";
                        break;
                    case 'br':
                        text += "\n";
                        break;
                    case 'div': 
                    case 'span':
                    case 'section':
                    case 'article':
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
}

