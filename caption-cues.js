/**
 * Voice captions: split a scene's narration into short caption phrases and time each one
 * against the scene's actual voice audio.
 *
 * Timing sources, best first:
 *   'voicevox' — VOICEVOX's audio_query carries the length of every mora, so phrase starts
 *                are exact. Used when the scene's audio is VOICEVOX output and VOICEVOX is up.
 *   'audio'    — any other voice (gTTS, uploaded files): phrase lengths are estimated from the
 *                text, then each change is snapped to the nearest dip in the audio's loudness.
 *
 * A cue changes where speech resumes, and holds until the next cue, so no blank frames appear.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Bump when the splitting or timing logic changes, so stored cues are rebuilt.
const ALGO_VERSION = 2;

const JA_RE = /[぀-ヿ一-鿿]/;
const SMALL_KANA = new Set('ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ');
const PUNCT_HARD = /^[。！？!?…]+$/;
const PUNCT_SOFT = /^[、，,・：:；;]+$/;
const JA_PARTICLES_STRONG = new Set(['が', 'は', 'を', 'に', 'で', 'も', 'と', 'へ', 'て', 'って', 'から', 'けど', 'けれど', 'ので', 'のに', 'なら', 'たら', 'ば', 'し', 'ね', 'よ', 'よね', 'や', 'まで', 'より']);
const EN_BREAK_BEFORE = new Set(['and', 'but', 'so', 'because', 'or', 'to', 'with', 'for', 'of', 'in', 'on', 'that', 'which', 'when', 'if', 'while', 'then']);

// [word|#hex] highlight markup is display styling, not speech
const stripMarkup = (text) => String(text || '').replace(/\[([^\]|]+)(?:\|[^\]]+)?\]/g, '$1');

// ── Splitting ─────────────────────────────────────────────────────────────────

function tokenize(text, isJa) {
    // Returns [{ text, breakAfter }] where breakAfter is 0 (avoid) .. 3 (ideal)
    const tokens = [];
    if (isJa) {
        const seg = new Intl.Segmenter('ja', { granularity: 'word' });
        const parts = [...seg.segment(text)].map(s => s.segment).filter(s => s.length);
        for (let i = 0; i < parts.length; i++) {
            const cur = parts[i];
            const next = parts[i + 1] || '';
            let pr = 0;
            if (/^\s+$/.test(cur)) pr = 3;
            else if (PUNCT_HARD.test(cur) || PUNCT_SOFT.test(cur)) pr = 3;
            else if (JA_PARTICLES_STRONG.has(cur)) pr = 2;
            else if (cur === 'の') pr = 1;
            else if (/[぀-ゟ]$/.test(cur) && /^[゠-ヿ一-鿿0-9A-Za-z]/.test(next)) pr = 1;
            // a particle followed by hiragana is usually a verb phrase (上限に|なって, に|する)
            if (pr === 2 && /^[぀-ゟ]/.test(next)) pr = ['に', 'で', 'と'].includes(cur) ? 0 : 1;
            // never break before punctuation, a small kana or a long-vowel mark
            if (next && (PUNCT_HARD.test(next) || PUNCT_SOFT.test(next) || SMALL_KANA.has(next[0]) || next[0] === 'ー' || next[0] === 'っ')) pr = 0;
            tokens.push({ text: cur, breakAfter: pr });
        }
    } else {
        const words = text.split(/(\s+)/).filter(Boolean);
        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            if (/^\s+$/.test(w)) { if (tokens.length) tokens[tokens.length - 1].text += ' '; continue; }
            tokens.push({ text: w, breakAfter: 1 });
        }
        for (let i = 0; i < tokens.length; i++) {
            const bare = tokens[i].text.trim();
            if (/[.!?;:,]["')\]]?$/.test(bare)) tokens[i].breakAfter = 3;
            const next = tokens[i + 1]?.text.trim().toLowerCase().replace(/[^a-z']/g, '');
            if (next && EN_BREAK_BEFORE.has(next) && tokens[i].breakAfter < 2) tokens[i].breakAfter = 2;
        }
    }
    return tokens;
}

const displayLen = (s, isJa) => isJa ? [...s.replace(/\s/g, '')].length : s.trim().length;

// Trailing 、。 read as clutter on a caption; ！？ carry tone, so they stay.
const cleanChunk = (s, isJa) => {
    let t = s.trim();
    if (isJa) t = t.replace(/[、。，,]+$/u, '');
    return t;
};

/** Split narration into caption-sized phrases, preferring breaks at punctuation and particles. */
function splitCaptionText(rawText) {
    const text = stripMarkup(rawText).replace(/\s*\n\s*/g, isJaText(rawText) ? '　' : ' ').trim();
    if (!text) return [];
    const isJa = isJaText(text);
    const target = isJa ? 12 : 28;
    const hardMax = isJa ? 16 : 40;
    const tokens = tokenize(text, isJa);
    const n = tokens.length;
    if (!n) return [];

    // DP over break positions: best[j] = min cost of splitting tokens[0..j)
    const best = new Array(n + 1).fill(Infinity);
    const prev = new Array(n + 1).fill(-1);
    best[0] = 0;
    for (let j = 1; j <= n; j++) {
        let joined = '';
        for (let i = j - 1; i >= 0; i--) {
            joined = tokens[i].text + joined;
            const len = displayLen(cleanChunk(joined, isJa), isJa);
            if (len > hardMax * 2) break;
            let cost = ((len - target) / target) ** 2 * 4;
            if (len > hardMax) cost += 40 * (len - hardMax);
            if (j < n) {
                const pr = tokens[j - 1].breakAfter;
                cost += pr === 3 ? -3 : pr === 2 ? -1.5 : pr === 1 ? 0 : 10;
            }
            const total = best[i] + cost;
            if (total < best[j]) { best[j] = total; prev[j] = i; }
        }
    }
    const bounds = [];
    for (let j = n; j > 0; j = prev[j]) bounds.unshift([prev[j], j]);
    return bounds
        .map(([a, b]) => cleanChunk(tokens.slice(a, b).map(t => t.text).join(''), isJa))
        .filter(Boolean);
}

function isJaText(text) { return JA_RE.test(String(text || '')); }

// Rough spoken length of a phrase, in morae (JA) or syllable-ish units (EN).
function estimateWeight(text) {
    if (!isJaText(text)) {
        return text.split(/\s+/).filter(Boolean).reduce((sum, w) => {
            const groups = w.toLowerCase().replace(/[^a-z]/g, '').match(/[aeiouy]+/g);
            const digits = (w.match(/\d/g) || []).length;
            return sum + Math.max(1, groups ? groups.length : 0) + digits * 1.2;
        }, 0);
    }
    let w = 0;
    for (const ch of text) {
        if (SMALL_KANA.has(ch)) continue;
        if (/[぀-ヿ]/.test(ch)) w += 1;
        else if (/[一-鿿]/.test(ch)) w += 1.8;
        else if (/[0-9０-９]/.test(ch)) w += 1.5;
        else if (/[A-Za-z]/.test(ch)) w += 0.8;
        else if (/[、，,]/.test(ch)) w += 1.2;
        else if (/[。！？!?]/.test(ch)) w += 2;
    }
    return Math.max(1, w);
}

// ── Audio analysis ────────────────────────────────────────────────────────────

const FRAME_SEC = 0.01;

// System ffmpeg first (an install prerequisite), then the copy Remotion bundles for rendering.
function ffmpegCandidates() {
    const list = [{ bin: 'ffmpeg', libDir: null }];
    const scope = path.join(__dirname, 'node_modules', '@remotion');
    try {
        for (const name of fs.readdirSync(scope)) {
            if (!name.startsWith(`compositor-${process.platform}-${process.arch}`)) continue;
            const dir = path.join(scope, name);
            list.push({ bin: path.join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'), libDir: dir });
        }
    } catch { /* Remotion not installed */ }
    return list;
}

// Remotion's bundled ffmpeg has no raw s16le muxer, so decode to WAV and skip to the data chunk.
// Piped WAVs carry placeholder sizes (and often a LIST chunk), so walk chunks rather than assume 44 bytes.
function wavSamples(buf) {
    let off = 12;
    while (off + 8 <= buf.length) {
        const id = buf.toString('ascii', off, off + 4);
        const size = buf.readUInt32LE(off + 4);
        if (id === 'data') return buf.subarray(off + 8);
        off += 8 + size + (size % 2);
    }
    throw new Error('no audio data in decoded WAV');
}

function decodeMono16k({ bin, libDir }, audioPath) {
    return new Promise((resolve, reject) => {
        const env = libDir ? { ...process.env, DYLD_LIBRARY_PATH: libDir, LD_LIBRARY_PATH: libDir } : process.env;
        const proc = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-i', audioPath, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-f', 'wav', '-'], { env });
        const chunks = [];
        proc.stdout.on('data', d => chunks.push(d));
        proc.on('error', reject);
        proc.on('close', code => code === 0 ? resolve(wavSamples(Buffer.concat(chunks))) : reject(new Error(`ffmpeg exited ${code}`)));
    });
}

/** Loudness envelope in dB, one value per 10ms. */
async function loudnessEnvelope(audioPath) {
    let pcm = null, lastErr = null;
    for (const cand of ffmpegCandidates()) {
        try { pcm = await decodeMono16k(cand, audioPath); break; } catch (e) { lastErr = e; }
    }
    if (!pcm) throw lastErr || new Error('ffmpeg not available');
    const hop = 160; // 10ms at 16kHz
    const env = [];
    for (let off = 0; off + hop <= pcm.length / 2; off += hop) {
        let sum = 0;
        for (let k = 0; k < hop; k++) { const v = pcm.readInt16LE((off + k) * 2) / 32768; sum += v * v; }
        env.push(10 * Math.log10(sum / hop + 1e-10));
    }
    // light 3-frame smoothing so single-frame spikes don't read as speech
    return env.map((v, i) => (v + (env[i - 1] ?? v) + (env[i + 1] ?? v)) / 3);
}

function timeAudioCues(chunks, env) {
    const peak = Math.max(...env);
    const threshold = Math.max(peak - 35, -50);
    let onset = env.findIndex(v => v > threshold);
    let offset = env.length - 1 - [...env].reverse().findIndex(v => v > threshold);
    if (onset < 0) { onset = 0; offset = env.length - 1; }
    const span = Math.max(1, offset - onset);

    const weights = chunks.map(estimateWeight);
    const totalW = weights.reduce((a, b) => a + b, 0);
    const starts = [onset];
    let cum = 0;
    for (let k = 1; k < chunks.length; k++) {
        cum += weights[k - 1];
        const est = onset + span * (cum / totalW);
        const neighbour = Math.min(weights[k - 1], weights[k]) / totalW * span;
        const win = Math.max(30, Math.round(neighbour * 0.25));
        const lo = Math.max(starts[k - 1] + 25, Math.round(est - win));
        const hi = Math.min(offset - 10, Math.round(est + win));
        let bestIdx = Math.round(est), bestScore = Infinity;
        for (let f = lo; f <= hi; f++) {
            // quieter is better; drift from the estimate costs 6 dB per second
            const score = env[f] + Math.abs(f - est) * FRAME_SEC * 6;
            if (score < bestScore) { bestScore = score; bestIdx = f; }
        }
        // start the cue where speech resumes after the dip, not in the middle of it
        let s = bestIdx;
        const floor = env[bestIdx];
        while (s < hi && env[s + 1] < floor + 3) s++;
        starts.push(Math.max(starts[k - 1] + 25, Math.min(s, offset - 10)));
    }
    return starts.map(f => Math.max(0, f * FRAME_SEC - 0.03));
}

// ── VOICEVOX exact timing ─────────────────────────────────────────────────────

const VOICEVOX_URL = 'http://localhost:50021';

async function voicevoxQuery(axios, text, speakerId) {
    const { data } = await axios.post(`${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, {}, { timeout: 8000 });
    return data;
}

const countMoras = (q) => q.accent_phrases.reduce((n, ap) => n + ap.moras.length, 0);

async function timeVoicevoxCues(chunks, fullText, speakerId, speedScale, audioDuration) {
    const axios = require('axios');
    const q = await voicevoxQuery(axios, fullText, speakerId);
    // start time of every mora, plus which mora indices begin an accent phrase
    const moraStart = [];
    const phraseStarts = new Set([0]);
    let t = q.prePhonemeLength;
    for (const ap of q.accent_phrases) {
        phraseStarts.add(moraStart.length);
        for (const m of ap.moras) { moraStart.push(t); t += (m.consonant_length || 0) + m.vowel_length; }
        if (ap.pause_mora) t += ap.pause_mora.vowel_length;
    }
    const total = t + q.postPhonemeLength;
    const M = moraStart.length;
    if (!M) throw new Error('empty query');

    const counts = [];
    for (const c of chunks) counts.push(countMoras(await voicevoxQuery(axios, c, speakerId)));
    const sum = counts.reduce((a, b) => a + b, 0) || 1;
    const ratio = M / sum;

    const idx = [0];
    let cum = 0;
    for (let k = 1; k < chunks.length; k++) {
        cum += counts[k - 1];
        const target = cum * ratio;
        let pick = Math.round(target), dist = Infinity;
        for (const p of phraseStarts) {
            if (p <= idx[k - 1]) continue;
            const d = Math.abs(p - target);
            if (d < dist) { dist = d; pick = p; }
        }
        if (dist > 2) pick = Math.round(target); // no phrase edge nearby: split at the mora itself
        idx.push(Math.min(M - 1, Math.max(idx[k - 1] + 1, pick)));
    }
    // query lengths are pre-speed; scale onto the real file so small synthesis drift cancels out
    const scale = audioDuration > 0 ? audioDuration / total : 1 / (speedScale || 1);
    return idx.map(i => Math.max(0, moraStart[i] * scale - 0.03));
}

// ── Public API ────────────────────────────────────────────────────────────────

function cueKey(seg, audioPath) {
    let mtime = 0;
    try { mtime = fs.statSync(audioPath).mtimeMs; } catch { }
    return crypto.createHash('sha1')
        .update(JSON.stringify([ALGO_VERSION, seg.voiceover_text || '', seg.audioFile || '', Math.round(mtime), seg.voicevoxSpeaker || '', seg.voiceSpeed ?? null]))
        .digest('hex').slice(0, 16);
}

/**
 * Build cues for one scene. Returns { cues: [{ text, start, end }], source }.
 * `voicevox` is { speakerId, speedScale } when the audio came from VOICEVOX, else null.
 */
async function buildSceneCues({ text, audioPath, audioDuration, voicevox }) {
    const chunks = splitCaptionText(text);
    if (!chunks.length) return { cues: [], source: 'none' };
    let starts = null, source = 'audio';
    if (voicevox && chunks.length > 1) {
        try {
            starts = await timeVoicevoxCues(chunks, stripMarkup(text), voicevox.speakerId, voicevox.speedScale, audioDuration);
            source = 'voicevox';
        } catch { starts = null; }
    }
    if (!starts) {
        const env = await loudnessEnvelope(audioPath);
        starts = chunks.length > 1 ? timeAudioCues(chunks, env) : [Math.max(0, env.findIndex(v => v > Math.max(...env) - 35)) * FRAME_SEC - 0.03];
        source = chunks.length > 1 ? 'audio' : source;
    }
    // Speech normally starts a few frames in; showing the first phrase from the scene's first
    // frame avoids a blank flicker between the previous scene's last caption and this one.
    if (starts[0] < 0.5) starts[0] = 0;
    const cues = chunks.map((c, k) => ({
        text: c,
        start: Math.round(Math.max(0, starts[k]) * 100) / 100,
        // holds to the next cue; the last one is held to the scene end by the renderer
        end: k + 1 < chunks.length ? Math.round(starts[k + 1] * 100) / 100 : null,
    }));
    return { cues, source };
}

/**
 * Bring every scene's stored cues up to date. Scenes whose narration, audio file or voice
 * settings are unchanged keep their cues. Returns the number of scenes rebuilt.
 */
async function refreshCaptionCues({ contentPath, settings, voiceDir, log = () => {} }) {
    const segments = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    const globalOn = settings.voiceCaptions === true;
    const usesVoicevox = settings.voice === 'voicevox';
    let speakers = null;
    const results = [];

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const on = seg.voiceCaptions === true || (seg.voiceCaptions !== false && globalOn);
        const text = String(seg.voiceover_text || '').trim();
        const audioPath = seg.audioFile && seg.audioFile !== 'null' ? path.join(voiceDir, seg.audioFile) : null;
        if (!on || !text || !audioPath || !fs.existsSync(audioPath)) continue;

        const key = cueKey(seg, audioPath);
        if (seg.captionCuesKey === key && Array.isArray(seg.captionCues)) continue;

        // VOICEVOX output is always segment_N.wav; uploads keep their own names
        let voicevox = null;
        const speakerName = seg.voicevoxSpeaker || (usesVoicevox ? settings.voicevoxSpeaker : '');
        if (speakerName && /^segment_\d+\.wav$/.test(seg.audioFile)) {
            try {
                if (!speakers) speakers = (await require('axios').get(`${VOICEVOX_URL}/speakers`, { timeout: 3000 })).data;
                const sp = speakers.find(s => s.name === speakerName) || speakers.find(s => s.name.includes(speakerName) || speakerName.includes(s.name));
                if (sp) voicevox = { speakerId: sp.styles[0].id, speedScale: seg.voiceSpeed ?? 1 };
            } catch { speakers = []; }
        }

        try {
            const { cues, source } = await buildSceneCues({ text, audioPath, audioDuration: Number(seg.audioDuration) || 0, voicevox });
            results.push({ i, text: seg.voiceover_text, audioFile: seg.audioFile, cues, key, source });
            log(i, cues, source);
        } catch (e) {
            log(i, null, 'error', e);
        }
    }
    if (!results.length) return 0;
    // Timing awaited on VOICEVOX and ffmpeg, and the editor may have saved scene edits meanwhile.
    // Re-read and merge only the caption fields (sync read+write, so nothing lands in between),
    // skipping any scene whose narration or audio changed under us.
    const fresh = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    let merged = 0;
    for (const r of results) {
        const cur = fresh[r.i];
        if (!cur || cur.voiceover_text !== r.text || cur.audioFile !== r.audioFile) continue;
        cur.captionCues = r.cues;
        cur.captionCuesKey = r.key;
        cur.captionCuesSource = r.source;
        merged++;
    }
    if (merged) fs.writeFileSync(contentPath, JSON.stringify(fresh, null, 2));
    return merged;
}

module.exports = { splitCaptionText, buildSceneCues, refreshCaptionCues, loudnessEnvelope, estimateWeight };
