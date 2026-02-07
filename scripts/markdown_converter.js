class MarkdownConverter {
	constructor() {
		// No external dependencies for now
		this.lastImageSrc = null;
	}

	convert(element) {
		this.lastImageSrc = null; // Reset per conversion
		let markdown = "";
		const articles = element.querySelectorAll("article");

		// Find all message blocks
		articles.forEach((article) => {
			const roleElement = article.querySelector("[data-message-author-role]");
			const role = roleElement
				? roleElement.getAttribute("data-message-author-role")
				: "user";

			markdown += `# ${role.charAt(0).toUpperCase() + role.slice(1)}\n\n`;

			let contentNode = article.querySelector(".markdown");

			if (!contentNode) {
				contentNode = roleElement
					? roleElement.parentElement.parentElement
					: article;
			}

			if (contentNode) {
				const textContent = this.domToMarkdown(contentNode);
				markdown += `${textContent.trim()}\n\n---\n\n`;
			}
		});

		// Normalize bold spacing even if bold markers come from plain text
		markdown = this.normalizeBoldSpacing(markdown);

		// Final cleanup: Remove excessive newlines (3 or more becomes 2)
		return markdown.replace(/\n{3,}/g, "\n\n").trim();
	}

	domToMarkdown(node) {
		if (!node) return "";
		let text = "";

		// Block tags where pure whitespace children should be ignored
		const BLOCK_TAGS = [
			"div",
			"section",
			"article",
			"aside",
			"header",
			"footer",
			"ul",
			"ol",
			"pre",
			"blockquote",
			"table",
			"tbody",
			"thead",
			"tr",
		];
		const parentTag = node.tagName ? node.tagName.toLowerCase() : "";

		node.childNodes.forEach((child) => {
			if (child.nodeType === Node.TEXT_NODE) {
				// If parent is a structural block, usually direct text nodes are whitespace for formatting
				// We shouldn't strip inside 'p' or 'span' usually, but 'div' heavily depends.
				// ChatGPT structure is pretty clean though.
				if (
					BLOCK_TAGS.includes(parentTag) &&
					child.textContent.trim().length === 0
				) {
					return;
				}
				text += child.textContent;
			} else if (child.nodeType === Node.ELEMENT_NODE) {
				const tagName = child.tagName.toLowerCase();
				const isHidden = window.getComputedStyle(child).display === "none";
				if (isHidden) return;

				// --- PRIORITY: Code Blocks (pre) ---
				if (tagName === "pre") {
					const codeBlock = child.querySelector("code");
					// Header removal logic: sometimes 'pre' contains a header div (language + copy).
					// We want only the code.
					if (codeBlock) {
						const langClass = Array.from(codeBlock.classList).find((c) =>
							c.startsWith("language-"),
						);
						const lang = langClass ? langClass.replace("language-", "") : "";
						text += `\n\`\`\`${lang}\n${codeBlock.textContent}\n\`\`\`\n\n`;
					} else {
						// Fallback
						text += `\n\`\`\`\n${child.textContent}\n\`\`\`\n\n`;
					}
					return;
				}

				// --- UI Cleaning Filters ---

				// 1. Extension Icons (e.g. PDF viewer icon)
				if (tagName === "img" && child.src.startsWith("chrome-extension://")) {
					console.log("Skipping extension icon:", child.src);
					return;
				}

				// ... (skip 2) ...

				// 3. Thinking Process
				if (tagName === "div" || tagName === "span") {
					if (child.children.length > 0) {
						// Has children, continue
					} else {
						const text = child.textContent.trim();
						if (
							text.startsWith("Thinking time:") ||
							text.startsWith("思考時間:") ||
							text === "Thinking..."
						) {
							console.log("Skipping Thinking text:", text);
							return;
						}
					}
				}

				// ---------------------------

				switch (tagName) {
					// ... (skip cases) ...
					case "hr":
						text += "\n---\n\n";
						break;
					case "ul":
						text += this.processList(child, false);
						break;
					case "ol":
						text += this.processList(child, true);
						break;
					case "li": {
						// Fallback for stray <li> outside of <ul>/<ol>
						const content = this.domToMarkdown(child).trim();
						if (content) text += `- ${content}\n`;
						break;
					}
					case "p": {
						const content = this.domToMarkdown(child).trim();
						if (content) text += `${content}\n\n`;
						break;
					}
					case "h1":
					case "h2":
					case "h3":
					case "h4":
					case "h5":
					case "h6": {
						const level = Number(tagName.slice(1));
						const content = this.domToMarkdown(child).trim();
						if (content) text += `${"#".repeat(level)} ${content}\n\n`;
						break;
					}
					case "a": {
						const href = child.getAttribute("href") || "";
						const label = this.domToMarkdown(child).trim() || href;
						if (href) {
							text += `[${label}](${href})`;
						} else {
							text += label;
						}
						break;
					}
					case "code": {
						const parentTag = child.parentElement
							? child.parentElement.tagName.toLowerCase()
							: "";
						if (parentTag === "pre") break; // handled in <pre>
						const codeText = child.textContent;
						if (codeText) text += `\`${codeText.replace(/`/g, "\\`")}\``;
						break;
					}
					case "em":
					case "i":
						text += `*${this.domToMarkdown(child)}*`;
						break;
					case "del":
					case "s":
						text += `~~${this.domToMarkdown(child)}~~`;
						break;
					case "img": {
						const alt = child.getAttribute("alt") || "";
						// Escape parenthesis in URL
						const src = (child.src || "").replace(/\(/g, "%28").replace(/\)/g, "%29");
						console.log("Found Image:", src, "Alt:", alt);

						// Deduplication
						// Keep original URL for downloading later
						if (src) {
							text += `![${alt}](${src})`;
						} else {
							console.warn("Image has no src:", child);
						}
						break;
					}
					case "table":
						// ...
						this.lastImageSrc = null; // Reset on structural change
						text += `${this.processTable(child)}\n\n`;
						break;
					case "br":
						text += "\n";
						break;
					case "div":
					case "span":
					case "section":
					case "article":
						// Reset duplicate tracker for block elements to be safe?
						// Actually, images are often adjacent. Let's keep tracker valid unless we hit a new message block.
						// Ideally we reset in convert() loop.

						// Check for KaTeX math
						if (child.classList?.contains("katex")) {
							const annotation = child.querySelector(
								'annotation[encoding="application/x-tex"]',
							);
							if (annotation) {
								// Check if it's block math (often displayed as block - this is a heuristic)
								// Standard KaTeX generic is usually inline, but let's check display style
								// simpler: ChatGPT treats \[ ... \] as display and \( ... \) as inline usually,
								// but here we are extracting from DOM.
								// If it's a div.katex-display, use $$.
								const isBlock =
									child.classList.contains("katex-display") ||
									(child.tagName.toLowerCase() === "div" &&
										child.classList.contains("math-display")) ||
									child.parentElement?.classList.contains("katex-display");

								const latex = annotation.textContent;
								text += isBlock
									? `\n$$\n${latex}\n$$\n`
									: `$${latex.replace(/\n/g, " ").trim()}$`;
								break; // Skip default recursion for this node
							}
						}
						text += this.domToMarkdown(child);
						break;
					case "button":
						// Recurse into buttons if they contain images (e.g. ChatGPT reference images)
						if (child.querySelector("img")) {
							text += this.domToMarkdown(child);
						}
						break;
					case "math": {
						// fallback if we hit a raw math tag not wrapped in known katex structure
						const annotation = child.querySelector(
							'annotation[encoding="application/x-tex"]',
						);
						if (annotation) {
							text += `$${annotation.textContent.trim()}$`;
						} else {
							// Fallback to text content if no latex found (unlikely in this context but safe)
							text += child.textContent;
						}
						break;
					}
					case "strong":
					case "b":
						text += ` **${this.domToMarkdown(child)}** `;
						break;
					case "blockquote": {
						const quoteContent = this.domToMarkdown(child).trim();
						text +=
							"\n" +
							quoteContent
								.split("\n")
								.filter((l) => l.trim())
								.map((line) => `> ${line}`)
								.join("\n") +
							"\n\n";
						break;
					}
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

		listNode.childNodes.forEach((child) => {
			if (
				child.nodeType === Node.ELEMENT_NODE &&
				child.tagName.toLowerCase() === "li"
			) {
				const marker = isOrdered ? `${index}. ` : "- ";
				// Indent child lines for nested lists (basic approach)
				let content = this.domToMarkdown(child).trim();
				// Normalize excessive blank lines inside list items
				content = content.replace(/\n{2,}/g, "\n");
				if (content.includes("\n")) {
					content = content.replace(/\n/g, "\n  ");
				}
				text += `${marker}${content}\n`;
				index++;
			}
		});
		return `${text}\n`;
	}

	processTable(tableNode) {
		let text = "";
		const rows = tableNode.querySelectorAll("tr");
		if (rows.length === 0) return "";

		const headers = rows[0].querySelectorAll("th, td");

		// Header row
		let headerLine = "|";
		let separatorLine = "|";

		headers.forEach((h) => {
			headerLine += ` ${h.textContent.trim()} |`;
			separatorLine += " --- |";
		});

		text += `${headerLine}\n${separatorLine}\n`;

		// Data rows
		for (let i = 1; i < rows.length; i++) {
			const cells = rows[i].querySelectorAll("td");
			let rowLine = "|";
			cells.forEach((c) => {
				rowLine += ` ${c.textContent.trim()} |`;
			});
			text += `${rowLine}\n`;
		}

		return text;
	}


	normalizeBoldSpacing(text) {
		return this.applyToNonCode(text, (segment) => this.fixBoldSpacing(segment));
	}

	applyToNonCode(text, fn) {
		let result = "";
		let lastIndex = 0;
		const fenceRegex = /```[\s\S]*?```/g;
		let match = fenceRegex.exec(text);

		while (match !== null) {
			const before = text.slice(lastIndex, match.index);
			result += this.applyToNonInlineCode(before, fn);
			result += match[0]; // keep code fences as-is
			lastIndex = match.index + match[0].length;
			match = fenceRegex.exec(text);
		}

		result += this.applyToNonInlineCode(text.slice(lastIndex), fn);
		return result;
	}

	applyToNonInlineCode(text, fn) {
		let result = "";
		let lastIndex = 0;
		const inlineRegex = /`[^`]*`/g;
		let match = inlineRegex.exec(text);

		while (match !== null) {
			const before = text.slice(lastIndex, match.index);
			result += fn(before);
			result += match[0]; // keep inline code as-is
			lastIndex = match.index + match[0].length;
			match = inlineRegex.exec(text);
		}

		result += fn(text.slice(lastIndex));
		return result;
	}

	fixBoldSpacing(text) {
		let result = "";
		let i = 0;

		while (i < text.length) {
			if (text[i] === "*" && text[i + 1] === "*") {
				const end = text.indexOf("**", i + 2);
				if (end === -1) {
					result += text.slice(i);
					break;
				}

				const content = text.slice(i + 2, end);
				const prevChar = result.slice(-1);
				const nextChar = text[end + 2] || "";

				const prevNeedsSpace = prevChar && /[\p{L}\p{N}]/u.test(prevChar);
				const nextNeedsSpace = nextChar && /[\p{L}\p{N}]/u.test(nextChar);

				if (prevNeedsSpace && prevChar !== " ") {
					result += " ";
				}

				result += `**${content}**`;

				if (nextNeedsSpace) {
					result += " ";
				}

				i = end + 2;
				continue;
			}

			result += text[i];
			i++;
		}

		return result;
	}
}

globalThis.MarkdownConverter = MarkdownConverter;
