
// Mock FileSaver for testing _cleanImageUrl
class FileSaver {
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
}

const saver = new FileSaver();
const testUrl = "https://tse4.mm.bing.net/th/id/OIP.y1Jg-UlhT4eed1EU6TTvkQHaFj?w=474&h=474&c=7&p=0";
const expectedUrl = "https://tse4.mm.bing.net/th/id/OIP.y1Jg-UlhT4eed1EU6TTvkQHaFj?w=474";

const cleaned = saver._cleanImageUrl(testUrl);

console.log("Original:", testUrl);
console.log("Cleaned: ", cleaned);

if (cleaned === expectedUrl) {
    console.log("✅ Custom params removed correctly.");
} else {
    console.error("❌ Failed. Expected:", expectedUrl, "Got:", cleaned);
}

// Test other params remain
const otherUrl = "https://example.com/image.png?q=high&u=1";
const cleanedOther = saver._cleanImageUrl(otherUrl);
if (cleanedOther === "https://example.com/image.png?q=high") {
     console.log("✅ Other params preserved.");
} else {
     console.error("❌ Failed preservation. Got:", cleanedOther);
}
