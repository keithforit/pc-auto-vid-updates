/**
 * Local speech recognition with whisper.cpp — runs on this computer, no account, no online
 * service. Used by Video to Scenes to caption a clip that has no subtitles.
 *
 *   binary   `whisper-cli`: found on the PATH / Homebrew, or on Windows downloaded once from
 *            the whisper.cpp release into ./whisper-bin. (Mac/Linux: brew install whisper-cpp.)
 *   model    ggml-<name>.bin from the official whisper.cpp files, downloaded once into
 *            ./whisper-models.
 *   output   caption cues { text, start, end } in seconds. Whisper's sentence segments are
 *            re-split with the same particle-aware splitter the voice captions use, and each
 *            piece takes the timestamp of its first token.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawn, spawnSync } = require('child_process');
const { splitCaptionText, ffmpegCandidates } = require('./caption-cues');

const WHISPER_VERSION = '1.9.2';   // last release that ships whisper-bin-x64.zip (checked 2026-09-17)
const BIN_DIR = path.join(__dirname, 'whisper-bin');
const MODEL_DIR = path.join(__dirname, 'whisper-models');
const MODELS = {
    base:  { file: 'ggml-base.bin',  mb: 148 },
    small: { file: 'ggml-small.bin', mb: 488 },
};
const MODEL_URL = (file) => `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${file}`;
const WIN_ZIP_URL = `https://github.com/ggerganov/whisper.cpp/releases/download/v${WHISPER_VERSION}/whisper-bin-x64.zip`;

// ── binary ────────────────────────────────────────────────────────────────────

function findFileRecursive(dir, name, depth = 4) {
    if (depth < 0 || !fs.existsSync(dir)) return null;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.toLowerCase() === name) return p;
        if (entry.isDirectory()) { const hit = findFileRecursive(p, name, depth - 1); if (hit) return hit; }
    }
    return null;
}

const runs = (bin) => { try { return spawnSync(bin, ['--help'], { timeout: 8000 }).status !== null; } catch { return false; } };

/** Path to a working whisper-cli, or null. */
function findWhisperBinary() {
    const exe = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
    const candidates = [
        process.env.WHISPER_CLI,
        findFileRecursive(BIN_DIR, exe),
        '/opt/homebrew/bin/whisper-cli',
        '/usr/local/bin/whisper-cli',
        'whisper-cli',
    ].filter(Boolean);
    for (const c of candidates) {
        if (c === 'whisper-cli' ? runs(c) : (fs.existsSync(c) && runs(c))) return c;
    }
    return null;
}

function download(url, dest, onProgress, redirects = 5) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'pc-auto-vid' } }, (r) => {
            if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location && redirects > 0) {
                r.resume();
                return download(new URL(r.headers.location, url).toString(), dest, onProgress, redirects - 1).then(resolve, reject);
            }
            if (r.statusCode !== 200) { r.resume(); return reject(new Error(`download failed (${r.statusCode}) ${url}`)); }
            const total = parseInt(r.headers['content-length'] || '0', 10);
            let got = 0;
            const tmp = dest + '.part';
            const out = fs.createWriteStream(tmp);
            r.on('data', d => { got += d.length; if (total && onProgress) onProgress(Math.min(99, Math.round(got / total * 100))); });
            r.pipe(out);
            out.on('finish', () => { fs.renameSync(tmp, dest); resolve(); });
            out.on('error', reject);
            r.on('error', reject);
        }).on('error', reject);
    });
}

/** Make sure whisper-cli exists; on Windows fetch the release build once. */
async function ensureWhisperBinary(onProgress = () => {}) {
    const found = findWhisperBinary();
    if (found) return found;
    if (process.platform !== 'win32') {
        const hint = process.platform === 'darwin' ? 'brew install whisper-cpp' : 'install whisper.cpp and put whisper-cli on the PATH';
        const err = new Error(`whisper-cli not found — ${hint}`);
        err.code = 'WHISPER_MISSING'; err.hint = hint;
        throw err;
    }
    fs.mkdirSync(BIN_DIR, { recursive: true });
    const zip = path.join(BIN_DIR, 'whisper-bin-x64.zip');
    onProgress({ phase: 'binary', pct: 0 });
    await download(WIN_ZIP_URL, zip, pct => onProgress({ phase: 'binary', pct }));
    const ps = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `Expand-Archive -Force -LiteralPath '${zip}' -DestinationPath '${BIN_DIR}'`], { timeout: 120000 });
    try { fs.unlinkSync(zip); } catch { }
    const bin = findFileRecursive(BIN_DIR, 'whisper-cli.exe');
    if (ps.status !== 0 || !bin) throw new Error('could not unpack whisper.cpp for Windows');
    return bin;
}

/** Make sure the model file exists; download it once. */
async function ensureModel(name, onProgress = () => {}) {
    const m = MODELS[name] || MODELS.small;
    fs.mkdirSync(MODEL_DIR, { recursive: true });
    const dest = path.join(MODEL_DIR, m.file);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1e6) return dest;
    onProgress({ phase: 'model', pct: 0, mb: m.mb });
    await download(MODEL_URL(m.file), dest, pct => onProgress({ phase: 'model', pct, mb: m.mb }));
    return dest;
}

function whisperStatus() {
    return {
        platform: process.platform,
        binary: findWhisperBinary(),
        models: Object.fromEntries(Object.entries(MODELS).map(([k, m]) => [k, { mb: m.mb, present: fs.existsSync(path.join(MODEL_DIR, m.file)) }])),
    };
}

// ── audio ─────────────────────────────────────────────────────────────────────

function extractWav(inputPath, wavPath) {
    return new Promise(async (resolve, reject) => {
        let lastErr = null;
        for (const { bin, libDir } of ffmpegCandidates()) {
            const env = libDir ? { ...process.env, DYLD_LIBRARY_PATH: libDir, LD_LIBRARY_PATH: libDir } : process.env;
            const ok = await new Promise(res => {
                const p = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wavPath], { env });
                p.on('error', e => { lastErr = e; res(false); });
                p.on('close', code => res(code === 0));
            });
            if (ok) return resolve(wavPath);
        }
        reject(lastErr || new Error('ffmpeg could not extract the audio'));
    });
}

// ── cues ──────────────────────────────────────────────────────────────────────

/** whisper's full-JSON transcription → caption cues, re-split at natural phrase boundaries. */
function segmentsToCues(transcription) {
    const cues = [];
    for (const seg of transcription || []) {
        const tokens = (seg.tokens || []).filter(t => t.text && !/^\[_[A-Z]+_\d*\]$/.test(t.text));
        const text = tokens.length ? tokens.map(t => t.text).join('') : String(seg.text || '');
        const segStart = (seg.offsets?.from ?? 0) / 1000, segEnd = (seg.offsets?.to ?? 0) / 1000;
        const chunks = splitCaptionText(text);
        if (!chunks.length) continue;
        // character offset → start time of the token containing that character
        const starts = [];
        let acc = 0;
        for (const t of tokens) { for (let k = 0; k < [...t.text].length; k++) starts.push((t.offsets?.from ?? 0) / 1000); acc++; }
        const chars = [...text];
        let cursor = 0;
        const local = [];
        for (const c of chunks) {
            // find the chunk in the text after the cursor (splitter may drop trailing 、。)
            const key = [...c][0];
            let pos = cursor;
            while (pos < chars.length && chars[pos] !== key) pos++;
            if (pos >= chars.length) pos = cursor;
            local.push({ text: c, start: starts[pos] ?? segStart });
            cursor = pos + [...c].length;
        }
        local.forEach((c, i) => {
            const start = Math.max(segStart, c.start);
            const end = i + 1 < local.length ? Math.max(start + 0.2, local[i + 1].start) : Math.max(start + 0.2, segEnd);
            cues.push({ text: c.text, start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100 });
        });
    }
    // no overlaps between segments
    for (let i = 0; i + 1 < cues.length; i++) if (cues[i].end > cues[i + 1].start) cues[i].end = cues[i + 1].start;
    return cues.filter(c => c.text && c.end > c.start);
}

/**
 * Transcribe a video/audio file. language: 'auto' | 'ja' | 'en' | …; model: 'base' | 'small'.
 * onProgress gets { phase: 'binary'|'model'|'audio'|'transcribe', pct, mb? }.
 */
async function transcribeFile({ inputPath, language = 'auto', model = 'small', onProgress = () => {} }) {
    const bin = await ensureWhisperBinary(onProgress);
    const modelPath = await ensureModel(model, onProgress);
    const tmpBase = path.join(os.tmpdir(), `pcav-whisper-${Date.now()}`);
    const wav = `${tmpBase}.wav`;
    onProgress({ phase: 'audio', pct: 0 });
    await extractWav(inputPath, wav);
    onProgress({ phase: 'transcribe', pct: 0 });
    const args = ['-m', modelPath, '-f', wav, '-ojf', '-of', tmpBase, '-np', '-pp', '-t', String(Math.max(2, Math.min(8, os.cpus().length)))];
    if (language && language !== 'auto') args.push('-l', language); else args.push('-l', 'auto');
    const code = await new Promise((resolve) => {
        const p = spawn(bin, args);
        p.stderr.on('data', d => { const m = String(d).match(/progress\s*=\s*(\d+)%/); if (m) onProgress({ phase: 'transcribe', pct: Math.min(99, +m[1]) }); });
        p.stdout.on('data', d => { const m = String(d).match(/progress\s*=\s*(\d+)%/); if (m) onProgress({ phase: 'transcribe', pct: Math.min(99, +m[1]) }); });
        p.on('error', () => resolve(-1));
        p.on('close', resolve);
    });
    try { fs.unlinkSync(wav); } catch { }
    const jsonPath = `${tmpBase}.json`;
    if (code !== 0 || !fs.existsSync(jsonPath)) throw new Error(`whisper-cli exited with code ${code}`);
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    try { fs.unlinkSync(jsonPath); } catch { }
    const cues = segmentsToCues(data.transcription);
    onProgress({ phase: 'transcribe', pct: 100 });
    return { cues, language: data.result?.language || language };
}

module.exports = { transcribeFile, whisperStatus, ensureWhisperBinary, ensureModel, segmentsToCues, MODELS };
