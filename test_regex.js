
const markdown = `
![User uploaded image](https://files.oaiusercontent.com/file-xyz?se=2024-10-10)
![Complex Alt [Text]](https://example.com/image.png)
![Image with ) in url](https://example.com/image(1).png)
`;

const imgRegex = /!\[(.*?)\]\((https?:\/\/[^)]+)\)/g;
const matches = [...markdown.matchAll(imgRegex)];

console.log("Matches found:", matches.length);
matches.forEach(m => console.log(m[0], "->", m[2]));
