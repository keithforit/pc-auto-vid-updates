/**
 * Voice levels: per-scene loudness and speech activity, measured from each scene's voice file.
 *
 *   voiceLoudness  { i, tp }  integrated loudness (LUFS) and true peak (dBTP). The renderer turns
 *                             this into a gain so every scene's voice sits at the same level.
 *   voiceActivity  [[s, e]]   seconds where someone is speaking, relative to the scene start.
 *                             The renderer lifts background music outside these spans.
 *
 * Measurements are cached per scene and only redone when the voice file changes.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { loudnessEnvelope, ffmpegCandidates } = require('./caption-cues');

const ALGO_VERSION = 1;
const FRAME_SEC = 0.01;

function runLoudnorm({ bin, libDir }, audioPath) {
    return new Promise((resolve, reject) => {
        const env = libDir ? { ...process.env, DYLD_LIBRARY_PATH: libDir, LD_LIBRARY_PATH: libDir } : process.env;
        const proc = spawn(bin, ['-hide_banner', '-nostats', '-i', audioPath, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], { env });
        let err = '';
        proc.stderr.on('data', d => { err += d; });
        proc.on('error', reject);
        proc.on('close', code => {
            const json = err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1);
            if (code !== 0 || !json) return reject(new Error(`ffmpeg loudnorm exited ${code}`));
            try { resolve(JSON.parse(json)); } catch (e) { reject(e); }
        });
    });
}

/** Integrated loudness and true peak, or null when the clip is too short or silent to measure. */
async function measureLoudness(audioPath) {
    let lastErr = null;
    for (const cand of ffmpegCandidates()) {
        try {
            const r = await runLoudnorm(cand, audioPath);
            const i = parseFloat(r.input_i), tp = parseFloat(r.input_tp);
            return Number.isFinite(i) && Number.isFinite(tp) && i > -70 ? { i: Math.round(i * 100) / 100, tp: Math.round(tp * 100) / 100 } : null;
        } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('ffmpeg not available');
}

/** Spans of speech, with pauses shorter than `bridge` seconds treated as part of the speech. */
function speechSpans(env, bridge = 0.35, pad = 0.05) {
    if (!env.length) return [];
    const peak = Math.max(...env);
    const threshold = Math.max(peak - 30, -45);
    const spans = [];
    let start = -1;
    env.forEach((v, f) => {
        if (v > threshold && start < 0) start = f;
        if ((v <= threshold || f === env.length - 1) && start >= 0) { spans.push([start, f]); start = -1; }
    });
    const merged = [];
    for (const [s, e] of spans) {
        const last = merged[merged.length - 1];
        if (last && (s - last[1]) * FRAME_SEC < bridge) last[1] = e;
        else merged.push([s, e]);
    }
    const total = env.length * FRAME_SEC;
    return merged
        .filter(([s, e]) => (e - s) * FRAME_SEC >= 0.06) // clicks and breaths aren't speech
        .map(([s, e]) => [Math.max(0, s * FRAME_SEC - pad), Math.min(total, e * FRAME_SEC + pad)].map(t => Math.round(t * 100) / 100));
}

function levelsKey(seg, audioPath) {
    let mtime = 0;
    try { mtime = fs.statSync(audioPath).mtimeMs; } catch { }
    return crypto.createHash('sha1').update(JSON.stringify([ALGO_VERSION, seg.audioFile || '', Math.round(mtime)])).digest('hex').slice(0, 16);
}

/** Measure every scene whose voice file changed since it was last measured. Returns scenes updated. */
async function refreshVoiceLevels({ contentPath, voiceDir, log = () => {} }) {
    const segments = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    const results = [];
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const audioPath = seg.audioFile && seg.audioFile !== 'null' ? path.join(voiceDir, seg.audioFile) : null;
        if (!audioPath || !fs.existsSync(audioPath)) continue;
        const key = levelsKey(seg, audioPath);
        if (seg.voiceLevelsKey === key) continue;
        try {
            const loudness = await measureLoudness(audioPath);
            const activity = speechSpans(await loudnessEnvelope(audioPath));
            results.push({ i, audioFile: seg.audioFile, key, loudness, activity });
        } catch (e) {
            log(i, e);
        }
    }
    if (!results.length) return 0;
    // Same merge-on-write as the captions: another save may have landed while ffmpeg ran.
    const fresh = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    let merged = 0;
    for (const r of results) {
        const cur = fresh[r.i];
        if (!cur || cur.audioFile !== r.audioFile) continue;
        if (r.loudness) cur.voiceLoudness = r.loudness; else delete cur.voiceLoudness;
        cur.voiceActivity = r.activity;
        cur.voiceLevelsKey = r.key;
        merged++;
    }
    if (merged) fs.writeFileSync(contentPath, JSON.stringify(fresh, null, 2));
    return merged;
}

module.exports = { refreshVoiceLevels, measureLoudness, speechSpans };
