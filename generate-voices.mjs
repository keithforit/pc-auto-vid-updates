import fs from "fs";
import path from "path";
import { Communicate } from "edge-tts-universal";
import mp3Duration from "mp3-duration";

const contentPath = "./src/Content.json";
const voiceoversDir = "./public/voiceovers";

if (!fs.existsSync(voiceoversDir)) fs.mkdirSync(voiceoversDir, { recursive: true });

const VOICE = "en-US-AvaNeural";

async function main() {
    const segments = JSON.parse(fs.readFileSync(contentPath, "utf-8"));

    for (let i = 0; i < segments.length; i++) {
        // Uses the voiceover_text from the parsed Content.json
        const text = segments[i].voiceover_text || segments[i].text;
        const filePath = path.join(voiceoversDir, `segment_${i}.mp3`);

        // Build Edge TTS voice options from per-segment settings
        const seg = segments[i];
        const speedPct  = Math.round(((seg.voiceSpeed  ?? 1) - 1) * 100);
        const pitchHz   = Math.round( (seg.voicePitch  ?? 0) * 100);
        const volumePct = Math.round(((seg.voiceVolume ?? 1) - 1) * 100);
        const rate   = `${speedPct  >= 0 ? '+' : ''}${speedPct}%`;
        const pitch  = `${pitchHz   >= 0 ? '+' : ''}${pitchHz}Hz`;
        const volume = `${volumePct >= 0 ? '+' : ''}${volumePct}%`;

        console.log(`🎙️ Generating Voice ${i}: ${text.substring(0, 40)}...`);
        const communicate = new Communicate(text, VOICE, { rate, pitch, volume });
        const chunks = [];
        for await (const chunk of communicate.stream()) {
            if (chunk.type === "audio") chunks.push(chunk.data);
        }
        
        fs.writeFileSync(filePath, Buffer.concat(chunks));

        // Measures audio length and updates Content.json duration
        const duration = await mp3Duration(filePath);
        segments[i].duration = duration + 0.5; 
    }

    fs.writeFileSync(contentPath, JSON.stringify(segments, null, 2));
    console.log("✅ All voiceovers generated and synced.");
}

main();