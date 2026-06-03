#!/usr/bin/env node
/**
 * push-update.js
 * Run from inside your pc-auto-vid project folder:
 *   node push-update.js "What you fixed" 1.2.0
 *
 * This will:
 *  1. Copy the latest updatable files into the update repo
 *  2. Bump version.json
 *  3. Commit and push to GitHub
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const UPDATE_REPO_PATH = path.join(__dirname, '..', 'pc-auto-vid-updates');
const UPDATABLE_FILES = [
    'index.html', 'server.js', 'parser-captions.js', 'parser.js',
    'generate-audio.js', 'generate-audio-ja.js', 'generate-audio-voicevox.js',
    'src/Caption.tsx', 'src/Main.tsx', 'src/Background.tsx',
];

const notes   = process.argv[2] || 'Bug fixes and improvements';
const version = process.argv[3] || bumpPatch();

function bumpPatch() {
    try {
        const vf = path.join(UPDATE_REPO_PATH, 'version.json');
        const v = JSON.parse(fs.readFileSync(vf, 'utf8')).version || '1.0.0';
        const parts = v.split('.').map(Number);
        parts[2] = (parts[2] || 0) + 1;
        return parts.join('.');
    } catch { return '1.0.1'; }
}

console.log(`\n🚀 Pushing update v${version}: "${notes}"\n`);

// 1. Check the update repo exists
if (!fs.existsSync(UPDATE_REPO_PATH)) {
    console.error(`❌ Update repo not found at: ${UPDATE_REPO_PATH}`);
    console.error('   Make sure pc-auto-vid-updates is cloned next to this project folder.');
    process.exit(1);
}

// 2. Copy files
for (const file of UPDATABLE_FILES) {
    const src  = path.join(__dirname, file);
    const dest = path.join(UPDATE_REPO_PATH, file);
    if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        console.log(`  ✅ Copied ${file}`);
    } else {
        console.warn(`  ⚠️  Skipped ${file} (not found)`);
    }
}

// 3. Write version.json
const versionData = {
    version,
    date: new Date().toISOString().slice(0, 10),
    notes,
    files: UPDATABLE_FILES
};
fs.writeFileSync(
    path.join(UPDATE_REPO_PATH, 'version.json'),
    JSON.stringify(versionData, null, 2) + '\n'
);
console.log(`  ✅ Updated version.json → v${version}`);

// 4. Commit and push
try {
    execSync(`cd "${UPDATE_REPO_PATH}" && git add . && git commit -m "v${version}: ${notes}" && git push origin main`, { stdio: 'inherit' });
    console.log(`\n✅ Update v${version} pushed to GitHub successfully!\n`);
} catch (e) {
    console.error('\n❌ Git push failed. Make sure you are logged in: gh auth login');
    process.exit(1);
}
