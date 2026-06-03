import { createClient } from 'pexels';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.PEXELS_API_KEY || process.env.PEXELS_API_KEY === 'your_key_here') {
    console.error('❌ Error: Please add your real API key to the .env file.');
    process.exit(1);
}

const client = createClient(process.env.PEXELS_API_KEY);
const content = JSON.parse(fs.readFileSync('./content.json', 'utf-8'));
const DOWNLOAD_DIR = './public/backgrounds';

async function downloadVideo(url, filePath) {
    const writer = fs.createWriteStream(filePath);
    const response = await axios({ url, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function main() {
    console.log('🚀 Starting background video download factory...');
    for (let i = 0; i < content.length; i++) {
        const fileName = `bg-${i}.mp4`;
        const filePath = path.join(DOWNLOAD_DIR, fileName);

        if (fs.existsSync(filePath)) {
            console.log(`⏩ Skipping ${fileName} (already exists)`);
            continue;
        }

        console.log(`🔍 Searching Pexels for: "${content[i].background_query}"...`);
        const result = await client.videos.search({
            query: content[i].background_query,
            orientation: 'portrait',
            per_page: 1
        });

        if (result.videos.length > 0) {
            const file = result.videos[0].video_files.find(f => f.width === 1080 || f.quality === 'hd');
            await downloadVideo(file.link, filePath);
            console.log(`✅ Saved ${fileName}`);
        }
    }
    console.log('🏁 All downloads finished!');
}
main();
