#!/usr/bin/env node

import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get API key from environment variable or .env file
let apiKey = process.env.PIXABAY_API_KEY;

if (!apiKey) {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/PIXABAY_API_KEY\s*=\s*(.+)/);
    if (match) {
      apiKey = match[1].trim().replace(/["']/g, "");
    }
  }
}

if (!apiKey) {
  console.error("❌ Error: PIXABAY_API_KEY not found");
  console.error("\n📌 Setup options:");
  console.error("Option 1 - Create .env file:");
  console.error('  echo "PIXABAY_API_KEY=your_key_here" > .env');
  console.error("\nOption 2 - Set environment variable:");
  console.error("  export PIXABAY_API_KEY=your_key_here\n");
  process.exit(1);
}

async function downloadPixabayVideo(pixabayUrl) {
  try {
    if (!pixabayUrl || !pixabayUrl.includes("pixabay.com/videos")) {
      throw new Error("Invalid Pixabay URL");
    }

    const videoIdMatch = pixabayUrl.match(/pixabay\.com\/videos\/[\w-]+-(\d+)/);
    if (!videoIdMatch) {
      throw new Error("Could not extract video ID from URL");
    }

    const videoId = videoIdMatch[1];
    const bgDir = path.join(__dirname, "public/backgrounds");
    if (!fs.existsSync(bgDir)) {
      fs.mkdirSync(bgDir, { recursive: true });
    }

    const filename = `pixabay-${videoId}.mp4`;
    const filepath = path.join(bgDir, filename);

    if (fs.existsSync(filepath)) {
      console.log(`✅ Video already cached: ${filename}`);
      console.log(`📝 Use this in your scene: ${filename}`);
      return;
    }

    console.log("📥 Fetching video from Pixabay API...");

    return new Promise((resolve, reject) => {
      const apiUrl = `https://pixabay.com/api/videos/?id=${videoId}&key=${apiKey}`;

      https.get(apiUrl, (response) => {
        let data = "";
        response.on("data", (chunk) => { data += chunk; });
        response.on("end", () => {
          try {
            const json = JSON.parse(data);

            if (!json.hits || !json.hits[0]) {
              throw new Error("Video not found on Pixabay");
            }

            const video = json.hits[0];
            const videoUrl = video.videos.large?.url || video.videos.medium?.url || video.videos.small?.url;

            if (!videoUrl) {
              throw new Error("No video URL available from Pixabay");
            }

            console.log("📥 Downloading video...");
            const file = fs.createWriteStream(filepath);
            https.get(videoUrl, (vid_res) => {
              vid_res.pipe(file);
              file.on("finish", () => {
                file.close();
                console.log(`✅ Successfully downloaded: ${filename}`);
                console.log(`📝 Use this in your scene: ${filename}`);
                resolve();
              });
            }).on("error", (err) => {
              fs.unlink(filepath, () => {});
              reject(new Error(`Download failed: ${err.message}`));
            });
          } catch (e) {
            reject(e);
          }
        });
      }).on("error", reject);
    });
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
  }
}

const pixabayUrl = process.argv[2];
if (!pixabayUrl) {
  console.log("Usage: node download-pixabay.js <PIXABAY_VIDEO_URL>");
  console.log("Example: node download-pixabay.js https://pixabay.com/videos/piggy-bank-money-finance-business-12924/");
  process.exit(1);
}

downloadPixabayVideo(pixabayUrl);
