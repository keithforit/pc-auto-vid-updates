import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function extractVideoIdFromUrl(url) {
  const match = url.match(/pixabay\.com\/videos\/[\w-]+-(\d+)/);
  return match ? match[1] : null;
}

function fetchPixabayVideo(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      let html = "";
      res.on("data", (chunk) => { html += chunk; });
      res.on("end", () => {
        try {
          // Extract video URLs from the HTML page
          const videoUrlMatch = html.match(/"(?:contentUrl|url)"\s*:\s*"(https:\/\/[^"]*\.mp4[^"]*)"/);
          const altMatch = html.match(/src="(https:\/\/[^"]*\/videos\/[^"]*\.mp4[^"]*)"/);

          const videoUrl = videoUrlMatch?.[1] || altMatch?.[1];
          if (videoUrl) {
            resolve(videoUrl);
          } else {
            // Try finding data in script tag
            const scriptMatch = html.match(/window\.__NUXT__.*?"url":"(https:\/\/[^"]*\.mp4[^"]*)/);
            if (scriptMatch?.[1]) {
              resolve(scriptMatch[1]);
            } else {
              reject(new Error("Could not extract video URL from Pixabay page"));
            }
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function downloadVideo(videoUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(videoUrl, (res) => {
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve(outputPath);
      });
    }).on("error", (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function downloadPixabayVideo(pixabayUrl) {
  try {
    console.log("🎬 Fetching Pixabay video metadata...");
    const videoUrl = await fetchPixabayVideo(pixabayUrl);

    const videoId = extractVideoIdFromUrl(pixabayUrl);
    const bgDir = path.join(__dirname, "public/backgrounds");
    if (!fs.existsSync(bgDir)) {
      fs.mkdirSync(bgDir, { recursive: true });
    }

    const outputPath = path.join(bgDir, `pixabay-${videoId}.mp4`);

    if (fs.existsSync(outputPath)) {
      console.log(`✅ Video already downloaded to ${outputPath}`);
      return `pixabay-${videoId}.mp4`;
    }

    console.log(`📥 Downloading video to ${outputPath}...`);
    await downloadVideo(videoUrl, outputPath);
    console.log(`✅ Successfully downloaded to ${outputPath}`);

    return `pixabay-${videoId}.mp4`;
  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  }
}

export { downloadPixabayVideo, fetchPixabayVideo };
