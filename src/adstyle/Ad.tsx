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
 * Cue times come from the pauses actually present in the audio (silencedetect at
 * -26/-22dB), NOT from the .srt files and NOT from stretching them — speech does
 * not scale linearly, so a uniform stretch drifted further out with every line.
 *
 *   hook.mp4   speech 1.07s -> 9.60s, five clean phrase gaps
 *   close.mp4  speech 0.00s -> 9.61s, anchored on the 0.52s and 0.58s pauses
 *
 * Boundaries marked (obs) were read off the timecoded build by ear and override
 * anything inferred from pause detection — matching srt lines to gaps assumes the
 * spoken words match the transcript, and here they did not. The rest are still
 * pause-derived. Render AdStyleTimecode to check any of them.
 */
// Captions are chunked to sub-phrases and each runs to the next one's start, so
// there are no blank holes; splits are snapped to real pauses where one exists.
const SHOT1_LEN = 9.8;
const SHOT2_LEN = 10.0;
const TAIL_LEN = 1.6;    // frozen last frame, so the end card gets a full beat
const ENDCARD_AT = 7.85; // into shot 2 = 17.65s on the timeline

const SHOT2_START = SHOT1_LEN;
const TAIL_START = SHOT1_LEN + SHOT2_LEN;
const TOTAL = SHOT1_LEN + SHOT2_LEN + TAIL_LEN;

/** Pulls in the two display faces before the first frame is captured. */
const useAdFonts = () => {
  const [handle] = useState(() => delayRender("adstyle-fonts"));
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Noto+Sans+JP:wght@900&display=swap";
    document.head.appendChild(link);
    const probe = "1300円相当ポイント獲得TikTok見るだけで新規ユーザー特典対象確認今すぐダウンロードいつも回人";
    Promise.all([
      (document as any).fonts.load('900 48px "Noto Sans JP"', probe),
      (document as any).fonts.load('400 48px "Dela Gothic One"', probe),
    ])
      .then(() => (document as any).fonts.ready)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
};

const BLUR_MAX = 20;
const DIM_MAX = 0.55;

/** Shot 2 blurs and darkens under the end card instead of hard-cutting to it. */
const ClosingShot: React.FC = () => {
  const frame = useCurrentFrame();
  const start = sec(ENDCARD_AT);
  const blur = interpolate(frame, [start - 8, start + 6], [0, BLUR_MAX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dim = interpolate(frame, [start - 8, start + 6], [0, DIM_MAX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile("adstyle/close.mp4")}
        style={{ width: "100%", height: "100%", objectFit: "cover", filter: `blur(${blur}px)` }}
      />
      <AbsoluteFill style={{ background: `rgba(8,8,12,${dim})` }} />
    </AbsoluteFill>
  );
};

/** Holds the last frame of shot 2, already blurred, so the CTA can breathe. */
const FrozenTail: React.FC = () => (
  <AbsoluteFill>
    <Freeze frame={sec(SHOT2_LEN) - 2}>
      <OffthreadVideo
        src={staticFile("adstyle/close.mp4")}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", filter: `blur(${BLUR_MAX}px)` }}
      />
    </Freeze>
    <AbsoluteFill style={{ background: `rgba(8,8,12,${DIM_MAX})` }} />
  </AbsoluteFill>
);

export const Ad: React.FC = () => {
  useAdFonts();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#000", width, height }}>
      {/* ---------- Shot 1 — hook + offer ---------- */}
      <Sequence from={0} durationInFrames={sec(SHOT1_LEN)}>
        <OffthreadVideo
          src={staticFile("adstyle/hook.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />

        {/* Upper right, clear of her head, tail pointing back at her.
            Measured at 0.025s: 「えっ」 is 1.050-1.175, silence to 1.275, and the
            clause the bubble actually shows starts at 1.300 — so it lands there.
            1.07 fired on the grunt; 1.57 fired mid-word. */}
        <Sequence from={sec(1.30)} durationInFrames={sec(1.32)}>
          <SpeechBubble
            kicker="TikTok Lite 新規ユーザー特典"
            text={"えっ、TikTok\n見るだけで？"}
            left="54%"
            top="9%"
            size={38}
          />
        </Sequence>

        <Sequence from={sec(2.62)} durationInFrames={sec(0.51)}>
          <BannerCaption text="これ、" />
        </Sequence>

        <Sequence from={sec(3.13)} durationInFrames={sec(1.06)}>
          <BannerCaption text="TikTok Liteなら" />
        </Sequence>

        <Sequence from={sec(4.19)} durationInFrames={sec(0.85)}>
          <BannerCaption text="新規ユーザー特典で" />
        </Sequence>

        {/* the money beat — burst only; the coin/shard layer read as clutter */}
        <Sequence from={sec(5.04)} durationInFrames={sec(2.87)}>
          <ComicBurst line1="1300円相当" line2="ポイント獲得！" left={-3} top={50} />
        </Sequence>

        {/* (obs) — these run under the burst, which holds to 7.91 */}
        <Sequence from={sec(6.08)} durationInFrames={sec(0.86)}>
          <BannerCaption text="ゲットできる" />
        </Sequence>

        <Sequence from={sec(7.12)} durationInFrames={sec(2.55)}>
          <BannerCaption text="みたいです" />
        </Sequence>
      </Sequence>

      {/* ---------- Shot 2 — CTA ---------- */}
      <Sequence from={sec(SHOT2_START)} durationInFrames={sec(SHOT2_LEN)}>
        <ClosingShot />

        <Sequence from={0} durationInFrames={sec(0.74)}>
          <BannerCaption text="いつもTikTok" />
        </Sequence>

        <Sequence from={sec(0.74)} durationInFrames={sec(0.69)}>
          <BannerCaption text="見てるなら" />
        </Sequence>

        <Sequence from={sec(1.43)} durationInFrames={sec(0.97)}>
          <BannerCaption text="対象かだけでも" />
        </Sequence>

        <Sequence from={sec(2.40)} durationInFrames={sec(0.56)}>
          <BannerCaption text="確認しておいた" />
        </Sequence>

        <Sequence from={sec(2.96)} durationInFrames={sec(1.28)}>
          <BannerCaption text="ほうがよさそう" />
        </Sequence>

        <Sequence from={sec(4.24)} durationInFrames={sec(1.58)}>
          <BannerCaption text="新規ユーザーの人は" />
        </Sequence>

        {/* split on her own 0.58s pause before 行ってください */}
        <Sequence from={sec(5.82)} durationInFrames={sec(0.82)}>
          <BannerCaption text="一回チェックしに" />
        </Sequence>

        <Sequence from={sec(6.64)} durationInFrames={sec(0.64)}>
          <BannerCaption text="行ってください" />
        </Sequence>
      </Sequence>

      {/* ---------- Frozen tail, so the end card isn't cut short ---------- */}
      <Sequence from={sec(TAIL_START)} durationInFrames={sec(TAIL_LEN)}>
        <FrozenTail />
      </Sequence>

      {/* End card spans the tail of shot 2 and the frozen hold as one beat */}
      <Sequence
        from={sec(SHOT2_START + ENDCARD_AT)}
        durationInFrames={sec(TOTAL - (SHOT2_START + ENDCARD_AT))}
      >
        <EndCard kicker="TikTok Lite 新規ユーザー特典" logo="adstyle/tiktok-lite.png" cta="今すぐダウンロード" />
      </Sequence>
    </AbsoluteFill>
  );
};

/**
 * Diagnostic build: same timeline with a running timecode and the current cue
 * boundary burned in, so caption timings can be checked against what is actually
 * spoken. Not part of the deliverable.
 */
export const AdTimecode: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const shot = t < SHOT1_LEN ? `shot1 ${t.toFixed(2)}` : `shot2 ${(t - SHOT2_START).toFixed(2)}`;
  return (
    <AbsoluteFill>
      <Ad />
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: "rgba(0,0,0,0.78)",
            color: "#4ade80",
            fontFamily: "monospace",
            fontWeight: 700,
            fontSize: 34,
            lineHeight: 1.25,
            padding: "8px 14px",
            borderRadius: 8,
            whiteSpace: "pre",
          }}
        >
          {`${t.toFixed(2)}s\n${shot}`}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const AD_TOTAL_FRAMES = sec(TOTAL);
export const AD_FPS = FPS;
export { C };
