class MarkdownConverter {
    constructor() {
        // No external dependencies for now
    }

    convert(element) {
        let markdown = "";
        const articles = element.querySelectorAll('article');
        
        if (articles.length === 0) {
            // Fallback for when there might be no articles (e.g., shared link view or different layout)
             // Try to find the main chat container
             const main = element.querySelector('main');
             if (main) {
                 return this.domToMarkdown(main);
             }
             return "";
        }

        articles.forEach(article => {
            const roleElement = article.querySelector('[data-message-author-role]');
            const role = roleElement ? roleElement.getAttribute('data-message-author-role') : 'user'; // Default to user if not found/implicit
            
            markdown += `# ${role.charAt(0).toUpperCase() + role.slice(1)}\n\n`;
            
            // The content is usually in a div with class '.markdown' or just the text parts
            // We look for the main content wrapper.
            // In recent ChatGPT versions, it might be nested.
            let contentNode = article.querySelector('.markdown');
            
            if (!contentNode) {
                // Determine if it's a user message which might not have .markdown class
                // User messages are often just text in a specific div
                contentNode = roleElement ? roleElement.parentElement.parentElement : article; // Heuristic
                // Filter out the role header itself if we grabbed too high
            }
            
            if (contentNode) {
                 const textContent = this.domToMarkdown(contentNode);
                 markdown += textContent.trim() + "\n\n---\n\n";
            }
        });

        return markdown;
    }

    domToMarkdown(node) {
        if (!node) return "";
        let text = "";
        
        node.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
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
                    case 'ul':
                        text += this.processList(child, false) + "\n";
                        break;
                    case 'ol':
                        text += this.processList(child, true) + "\n";
                        break;
                    case 'li':
                        // Handled by processList usually, but if encountered standalone logic might be needed
                        // For recursion, just return content
                         text += this.domToMarkdown(child);
                        break;
                    case 'pre':
                        // Check for code block content
                        const codeBlock = child.querySelector('code');
                        if (codeBlock) {
                            // Extract language class
                            const langClass = Array.from(codeBlock.classList).find(c => c.startsWith('language-'));
                            const lang = langClass ? langClass.replace('language-', '') : '';
                            // Get direct text content, avoiding extra spans if possible, 
                            // though often innerText is enough for code blocks
                            text += "```" + lang + "\n" + codeBlock.innerText + "\n```\n\n";
                        } else {
                             text += "```\n" + child.innerText + "\n```\n\n";
                        }
                        break;
                    case 'code':
                        // Inline code - avoid double wrapping if inside pre
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
                        text += this.domToMarkdown(child);
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

