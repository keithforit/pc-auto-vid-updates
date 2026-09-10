import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Freeze,
  OffthreadVideo,
  Sequence,
  staticFile,
  delayRender,
  continueRender,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { BannerCaption, SpeechBubble, ComicBurst, EndCard, C } from "./fx";

const FPS = 24;
const sec = (s: number) => Math.round(s * FPS);

/**
 * Single-clip cut. x-ad.com randomises the voice per generation, so any two
 * segments are two different speakers — measured 7.14 semitones apart, which no
 * amount of EQ or pitch work closes. One clip means one voice, guaranteed.
 *
 * Clip 1 alone still carries the whole message: hook, offer, amount, payoff.
 * The end card supplies the call to action.
 *
 * Cue times are the first four cues of tiktok_lite_20s_final.srt, which apply
 * unchanged because this clip sits at the head of that timeline.
 */
const CLIP_LEN = 8.057;
const TAIL_LEN = 2.5;   // frozen last frame so the end card gets a full beat
const TOTAL = CLIP_LEN + TAIL_LEN;
const ENDCARD_AT = CLIP_LEN;

const BLUR_MAX = 20;
const DIM_MAX = 0.55;

const useAdFonts = () => {
  const [handle] = useState(() => delayRender("adstyle3-fonts"));
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Noto+Sans+JP:wght@900&display=swap";
    document.head.appendChild(link);
    const probe = "1300円相当ポイント獲得TikTok見るだけで新規ユーザー特典今すぐダウンロードゲットみたいです";
    Promise.all([
      (document as any).fonts.load('900 48px "Noto Sans JP"', probe),
      (document as any).fonts.load('400 48px "Dela Gothic One"', probe),
    ])
      .then(() => (document as any).fonts.ready)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
};

const Footage: React.FC = () => {
  const frame = useCurrentFrame();
  const start = sec(ENDCARD_AT);
  const blur = interpolate(frame, [start - 8, start + 6], [0, BLUR_MAX], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dim = interpolate(frame, [start - 8, start + 6], [0, DIM_MAX], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile("adstyle/v3.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover", filter: `blur(${blur}px)` }} />
      <AbsoluteFill style={{ background: `rgba(8,8,12,${dim})` }} />
    </AbsoluteFill>
  );
};

const FrozenTail: React.FC = () => (
  <AbsoluteFill>
    <Freeze frame={sec(CLIP_LEN) - 2}>
      <OffthreadVideo src={staticFile("adstyle/v3.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: `blur(${BLUR_MAX}px)` }} />
    </Freeze>
    <AbsoluteFill style={{ background: `rgba(8,8,12,${DIM_MAX})` }} />
  </AbsoluteFill>
);

const Cue: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => (
  <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{children}</Sequence>
);

export const Ad3: React.FC = () => {
  useAdFonts();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#000", width, height }}>
      <Sequence from={0} durationInFrames={sec(CLIP_LEN)}>
        <Footage />
      </Sequence>
      <Sequence from={sec(CLIP_LEN)} durationInFrames={sec(TAIL_LEN)}>
        <FrozenTail />
      </Sequence>

      <Cue from={0.78} to={2.66}>
        <SpeechBubble kicker="TikTok Lite 新規ユーザー特典" text={"えっ、TikTok\n見るだけで？"} left="30%" top="6%" size={38} />
      </Cue>

      <Cue from={2.66} to={5.32}>
        <BannerCaption text={"これ、TikTok Liteなら\n新規ユーザー特典で"} size={40} />
      </Cue>

      <Cue from={5.32} to={6.96}>
        <ComicBurst line1="1300円相当" line2="ポイント獲得！" left={2} top={60} size={400} />
      </Cue>

      <Cue from={6.96} to={ENDCARD_AT}>
        <BannerCaption text="ゲットできるみたいです" />
      </Cue>

      <Cue from={ENDCARD_AT} to={TOTAL}>
        <EndCard kicker="TikTok Lite 新規ユーザー特典" logo="adstyle/tiktok-lite.png" cta="今すぐダウンロード" />
      </Cue>
    </AbsoluteFill>
  );
};

export const AD3_TOTAL_FRAMES = sec(TOTAL);
export const AD3_FPS = FPS;
export { C };
