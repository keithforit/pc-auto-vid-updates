import fs from "fs";
import { execSync } from "child_process";

const contentData = JSON.parse(fs.readFileSync("./src/content.json", "utf-8"));
const rendersDir = "./renders";

if (!fs.existsSync(rendersDir)) {
    fs.mkdirSync(rendersDir);
}

for (const item of contentData) {
    const id = item.id;
    const fileName = `renders/video-${id}.mp4`;
    console.log(`Rendering composition ${id} to ${fileName}...`);

    try {
        // Run the Remotion CLI command synchronously
        execSync(`npx remotion render ${id} ${fileName}`, { stdio: "inherit" });
        console.log(`Successfully rendered ${fileName}\n`);
    } catch (error) {
        console.error(`Failed to render composition ${id}`, error);
    }
}

console.log("All renders completed!");
