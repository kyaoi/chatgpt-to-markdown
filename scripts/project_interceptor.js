// project_interceptor.js
// This script is injected into the Main World to intercept fetch requests
// It must NOT use chrome.* APIs

(() => {
	// Prevent multiple injections
	if (window.__ctm_interceptor_installed) return;
	window.__ctm_interceptor_installed = true;

	// URL Patterns
	// Strict pattern: only match the project info endpoint, not conversations
	const singleProjectPattern = /\/backend-api\/gizmos\/g-p-[^/?]+$/;
	const multiProjectPattern = /\/backend-api\/gizmos\/.*\/sidebar/;

	const originalFetch = window.fetch;

	window.fetch = async function (...args) {
		const response = await originalFetch.apply(this, args);

		const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";

		try {
			if (singleProjectPattern.test(url)) {
				const clonedResponse = response.clone();
				handleSingleProjectResponse(clonedResponse);
			} else if (multiProjectPattern.test(url)) {
				const clonedResponse = response.clone();
				handleMultiProjectResponse(clonedResponse);
			}
		} catch (e) {
			// Silently fail
		}

		return response;
	};

	async function handleSingleProjectResponse(response) {
		try {
			const data = await response.json();
			if (data?.gizmo?.short_url && data?.gizmo?.display?.name) {
				sendToContentScript({
					type: "CTM_PROJECT_DATA",
					payload: [
						{
							shortUrl: data.gizmo.short_url,
							name: data.gizmo.display.name,
							source: "single",
							capturedAt: Date.now(),
						},
					],
				});
			}
		} catch (e) {
			/* ignore */
		}
	}

	async function handleMultiProjectResponse(response) {
		try {
			const data = await response.json();

			if (Array.isArray(data?.items)) {
				const projects = [];
				for (const item of data.items) {
					// Handle nested structure: item.gizmo.gizmo or item.gizmo
					const gizmo = item.gizmo?.gizmo || item.gizmo;

					if (gizmo?.short_url && gizmo?.display?.name) {
						projects.push({
							shortUrl: gizmo.short_url,
							name: gizmo.display.name,
							source: "sidebar",
							capturedAt: Date.now(),
						});
					}
				}
				if (projects.length > 0) {
					sendToContentScript({
						type: "CTM_PROJECT_DATA",
						payload: projects,
					});
				}
			}
		} catch (e) {
			// Silent
		}
	}

	function sendToContentScript(message) {
		window.postMessage(message, "*");
	}
})();
