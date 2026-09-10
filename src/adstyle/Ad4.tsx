import React, { useEffect, useState } from "react";
import {
  AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile,
  delayRender, continueRender, useVideoConfig, useCurrentFrame, interpolate,
} from "remotion";
import { BannerCaption, SpeechBubble, ComicBurst, EndCard, C } from "./fx";

const FPS = 24;
const sec = (s: number) => Math.round(s * FPS);

/**
 * 20s cut, one voice.
 *
 * x-ad.com picks its voice from the DURATION setting, not from 人物設定 — every
 * 8s generation measured 326.5 Hz, every 12s generation 216-222 Hz. Building
 * both halves from 8s generations puts them 1.09 semitones apart (was 7.14),
 * which is ordinary same-speaker variation.
 *
 *   8.06s + 8.06s footage, 0.20s dissolve = 15.93s, end card fills to 20.00s.
 *
 * First-half cues are the verified tiktok_lite_20s_final.srt values, unchanged.
 * The second half is a new take whose script has not been transcribed yet, so
 * it carries no captions — render AdStyle4Timecode to read its timings off.
 */
const SRC_LEN = 15.928;
const TOTAL = 20.0;
const ENDCARD_AT = SRC_LEN;
const BLUR_MAX = 20;
const DIM_MAX = 0.55;

const useAdFonts = () => {
  const [handle] = useState(() => delayRender("adstyle4-fonts"));
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Noto+Sans+JP:wght@900&display=swap";
    document.head.appendChild(link);
    const probe = "1300円相当ポイント獲得TikTok見るだけで新規ユーザー特典今すぐダウンロードゲットみたいですチェック対象確認";
    Promise.all([
      (document as any).fonts.load('900 48px "Noto Sans JP"', probe),
      (document as any).fonts.load('400 48px "Dela Gothic One"', probe),
    ]).then(() => (document as any).fonts.ready)
      .then(() => continueRender(handle)).catch(() => continueRender(handle));
  }, [handle]);
};

const Footage: React.FC = () => {
  const frame = useCurrentFrame();
  const start = sec(ENDCARD_AT);
  const blur = interpolate(frame, [start - 8, start + 6], [0, BLUR_MAX], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dim = interpolate(frame, [start - 8, start + 6], [0, DIM_MAX], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile("adstyle/v4.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover", filter: `blur(${blur}px)` }} />
      <AbsoluteFill style={{ background: `rgba(8,8,12,${dim})` }} />
    </AbsoluteFill>
  );
};

const FrozenTail: React.FC = () => (
  <AbsoluteFill>
    <Freeze frame={sec(SRC_LEN) - 2}>
      <OffthreadVideo src={staticFile("adstyle/v4.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: `blur(${BLUR_MAX}px)` }} />
    </Freeze>
    <AbsoluteFill style={{ background: `rgba(8,8,12,${DIM_MAX})` }} />
  </AbsoluteFill>
);

const Cue: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => (
  <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{children}</Sequence>
);

export const Ad4: React.FC = () => {
  useAdFonts();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#000", width, height }}>
      <Sequence from={0} durationInFrames={sec(SRC_LEN)}><Footage /></Sequence>
      <Sequence from={sec(SRC_LEN)} durationInFrames={sec(TOTAL - SRC_LEN)}><FrozenTail /></Sequence>

      <Cue from={0.78} to={2.66}>
        <SpeechBubble kicker="TikTok Lite 新規ユーザー特典" text={"えっ、TikTok\n見るだけで？"} left="30%" top="6%" size={38} />
      </Cue>
      <Cue from={2.66} to={5.32}>
        <BannerCaption text={"これ、TikTok Liteなら\n新規ユーザー特典で"} size={40} />
      </Cue>
      <Cue from={5.32} to={6.96}>
        <ComicBurst line1="1300円相当" line2="ポイント獲得！" left={2} top={60} size={400} />
      </Cue>
      <Cue from={6.96} to={8.06}>
        <BannerCaption text="ゲットできるみたいです" />
      </Cue>

      {/* 8.06 - 15.93 awaiting the second half's transcript */}

      <Cue from={ENDCARD_AT} to={TOTAL}>
        <EndCard kicker="TikTok Lite 新規ユーザー特典" logo="adstyle/tiktok-lite.png" cta="今すぐダウンロード" />
      </Cue>
    </AbsoluteFill>
  );
};

/** Diagnostic: same timeline with a running timecode, for reading cue times. */
export const Ad4Timecode: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill>
      <Ad4 />
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.78)", color: "#4ade80",
                      fontFamily: "monospace", fontWeight: 700, fontSize: 34, padding: "8px 14px", borderRadius: 8 }}>
          {`${t.toFixed(2)}s`}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const AD4_TOTAL_FRAMES = sec(TOTAL);
export const AD4_FPS = FPS;
export { C };
