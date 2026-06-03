/**
 * Builds src/Content.json for the JR定期券 Japanese video.
 * Fetches portrait Pexels video URLs for each segment.
 */
import fs from 'fs';
import axios from 'axios';

const PEXELS_API_KEY = 'LWphJge0sxbSJIxWxiLmZLO4i1bzt3YgkbEnwo3jBD1miVpCoGBjTChO';

const segments = [
  {
    text: 'JR定期券\nお得な買い方',
    voiceover_text: 'JR定期券のお得な買い方をお伝えします。',
    background_query: 'Japan train station commuter crowd',
  },
  {
    text: 'この方法が最強',
    voiceover_text: 'モバイルSuicaアプリで6ヶ月定期券をビックカメラSuicaカードで購入する。この買い方が非常におすすめです。年間で数万円分の違いが出ることもあります。',
    background_query: 'smartphone mobile app payment Japan',
  },
  {
    text: '① 6ヶ月定期が最安',
    voiceover_text: '定期券には1ヶ月・3ヶ月・6ヶ月の三種類があります。まとめて購入するほど料金が安いです。',
    background_query: 'calendar monthly planning schedule',
  },
  {
    text: '年間3万円以上の差',
    voiceover_text: '6ヶ月定期を購入するだけで、年間3万円以上の差がでます。価格だけ見ると6ヶ月定期一択です。退職や引っ越しを予定している方は、状況に応じた期間にしておきましょう。',
    background_query: 'Japanese yen money savings cash',
  },
  {
    text: '② ポイントがつくカードを選ぶ',
    voiceover_text: '定期券は数万円規模の購入になるため、ポイントに還元できたほうがよいです。ところが、主要カードで定期券購入はポイント付与の対象外になっていることが多いです。',
    background_query: 'credit card payment cashback reward',
  },
  {
    text: 'ビックカメラSuicaカードで5%還元',
    voiceover_text: 'JR定期券を購入するなら、ビックカメラSuicaカードが一番おすすめです。定期券購入で5%ものポイント還元が付きます。年会費も実質無料にできます。',
    background_query: 'credit card rewards loyalty points bonus',
  },
  {
    text: 'JR東日本の100%子会社が発行',
    voiceover_text: 'ビックカメラSuicaカードの発行元はビューカードというJR東日本の100%子会社です。だから高いポイント還元率が提供されているというワケです。',
    background_query: 'Japan railway corporation business',
  },
  {
    text: '③ モバイルSuicaで購入',
    voiceover_text: '定期券はモバイルSuicaアプリで購入しましょう。券売機の磁気カード型は1.5%の還元率ですが、モバイルSuicaアプリなら5.0%。スマホを改札機にタッチするだけで使えます。',
    background_query: 'smartphone NFC contactless tap payment',
  },
  {
    text: '全部合わせると年間3万円以上',
    voiceover_text: '全部組み合わせると、年間約3万円の違いが出ます。ポイント還元でも数千円分の差が生まれます。一度仕組みを作れば半自動的に特典を貰えます。',
    background_query: 'annual savings budget finance comparison',
  },
  {
    text: 'JREポイント→Suicaにチャージ',
    voiceover_text: 'この方法で貯まるのはJREポイントです。1ポイントイコール1円としてSuicaにチャージできますので、難しい交換手続きは一切不要です。乗車賃としても決済としても使えます。',
    background_query: 'IC transit card Japan subway train',
  },
  {
    text: 'デメリットも把握しよう',
    voiceover_text: 'デメリットもあります。スマホの電池切れが改札に影響する点。機種変更時に引き継ぎ手続きが必要な点。6ヶ月定期の途中解約に手数料がかかる点です。ただ、ほとんどは許容できる範囲です。',
    background_query: 'smartphone battery low dying warning',
  },
  {
    text: 'まとめ：この3ステップで節約',
    voiceover_text: 'まとめです。6ヶ月定期を選ぶ。ビックカメラSuicaカードで支払う。モバイルSuicaアプリから購入する。春の新生活、少しでもお役に立てれば幸いです。',
    background_query: 'checklist success achievement steps done',
  },
];

async function fetchPexelsUrl(query) {
  try {
    const res = await axios.get(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    if (res.data.videos?.length > 0) {
      const idx = res.data.videos.length > 1 ? 1 : 0;
      const files = res.data.videos[idx].video_files.sort((a, b) => b.width - a.width);
      return files[0].link;
    }
  } catch (e) {
    console.log(`Pexels error for "${query}":`, e.message);
  }
  return '';
}

async function main() {
  console.log('🎬 Building Japanese video Content.json...\n');
  const result = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    console.log(`[${i + 1}/${segments.length}] Fetching video for: "${seg.background_query}"`);
    const url = await fetchPexelsUrl(seg.background_query);
    console.log(`  → ${url ? '✅ Got URL' : '❌ No result'}`);

    result.push({
      text: seg.text,
      voiceover_text: seg.voiceover_text,
      background_url: url,
      duration: 5,
    });
  }

  fs.writeFileSync('./src/Content.json', JSON.stringify(result, null, 2));
  console.log('\n✅ src/Content.json written with', result.length, 'segments.');
}

main();
