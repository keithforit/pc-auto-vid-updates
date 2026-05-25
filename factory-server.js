const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { bundle } = require("@remotion/bundler");
const { renderVideo, selectComposition } = require("@remotion/renderer");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const https = require("https");
const { URL } = require("url");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(cors());
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

function parseScript(text) {
    const segments = [];
    const blocks = text.split(/(?=Rank #|HOOK|CTA)/i);

    blocks.forEach((block) => {
        if (!block.trim()) return;

        const textMatch = block.match(/On-screen text:\s*(.*)/i);
        // 🛠️ TARGET: Captures full "Spoken narration" even with periods
        const narrationMatch = block.match(/Spoken (?:narration|hook|CTA):\s*[“"]?([\s\S]*?)[”"]?(?=\r?\nWhy this|\r?\nOn-screen|\r?\nVisual idea|Visual \/|$)/i);
        const visualMatch = block.match(/(?:Visual idea|Visual \/ stock footage idea):\s*(.*)/i);

        if (textMatch) {
            segments.push({
                text: textMatch[1].trim(),
                // 🎙️ Save the long sentence for the voiceover
                voiceover_text: narrationMatch ? narrationMatch[1].trim().replace(/\r?\n|\r/g, " ") : textMatch[1].trim(),
                duration: 7, 
                background_query: visualMatch ? visualMatch[1].trim() : textMatch[1].trim()
            });
        }
    });
    return segments.length > 0 ? segments : null;
}

app.post("/render", async (req, res) => {
    const { rawText } = req.body;
    try {
        io.emit("status", "🧹 Clearing old audio cache...");
        const voiceDir = path.join(__dirname, "public/voiceovers");
        if (fs.existsSync(voiceDir)) fs.rmSync(voiceDir, { recursive: true, force: true });
        
        io.emit("status", "📝 Updating Content.json with new script...");
        const script = parseScript(rawText);
        // 🛠️ Overwrites the file with the NEW narration
        fs.writeFileSync(path.join(__dirname, "src/Content.json"), JSON.stringify(script, null, 2));

        io.emit("status", "🎙️ Generating NEW Narration...");
        execSync("node generate-audio.js", { stdio: "inherit" });

        const finalScript = JSON.parse(fs.readFileSync(path.join(__dirname, "src/Content.json"), "utf-8"));

        io.emit("status", "🚀 Rendering Video...");
        const bundleLocation = await bundle(path.join(__dirname, "src/index.ts"));
        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: "1",
            inputProps: { segments: finalScript }
        });

        await renderVideo({
            composition,
            serveUrl: bundleLocation,
            outputLocation: `renders/factory_${Date.now()}.mp4`,
            codec: "h264",
            puppeteerTimeout: 120000, 
            onProgress: ({ progress }) => io.emit("progress", Math.round(progress * 100)),
        });

        res.send({ success: true });
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
});

app.post("/fetch-pixabay", async (req, res) => {
    const { pixabayUrl } = req.body;
    try {
        if (!pixabayUrl || !pixabayUrl.includes("pixabay.com/videos")) {
            return res.status(400).send({ error: "Invalid Pixabay URL" });
        }

        const videoIdMatch = pixabayUrl.match(/pixabay\.com\/videos\/[\w-]+-(\d+)/);
        if (!videoIdMatch) {
            return res.status(400).send({ error: "Could not extract video ID from URL" });
        }

        const videoId = videoIdMatch[1];
        const bgDir = path.join(__dirname, "public/backgrounds");
        if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });

        const filename = `pixabay-${videoId}.mp4`;
        const filepath = path.join(bgDir, filename);

        if (fs.existsSync(filepath)) {
            return res.json({ filename, cached: true });
        }

        io.emit("status", `📥 Fetching Pixabay video metadata...`);

        https.get(pixabayUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, (response) => {
            let html = "";
            response.on("data", (chunk) => { html += chunk; });
            response.on("end", () => {
                try {
                    // Extract video URL from HTML
                    const videoUrlMatch = html.match(/["']url["']\s*:\s*["'](https:\/\/[^"']*\/videos\/[^"']*\.mp4[^"']*)/);
                    const videoUrl = videoUrlMatch ? videoUrlMatch[1] : null;

                    if (!videoUrl) {
                        return res.status(400).send({ error: "Could not extract video URL from Pixabay page" });
                    }

                    io.emit("status", `📥 Downloading Pixabay video...`);
                    const file = fs.createWriteStream(filepath);
                    https.get(videoUrl, (vid_res) => {
                        vid_res.pipe(file);
                        file.on("finish", () => {
                            file.close();
                            io.emit("status", `✅ Pixabay video ready: ${filename}`);
                            res.json({ filename, cached: false });
                        });
                    }).on("error", (err) => {
                        fs.unlink(filepath, () => {});
                        res.status(500).send({ error: `Download failed: ${err.message}` });
                    });
                } catch (e) {
                    res.status(500).send({ error: e.message });
                }
            });
        }).on("error", (err) => {
            res.status(500).send({ error: `Failed to fetch page: ${err.message}` });
        });
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
});

server.listen(3001);