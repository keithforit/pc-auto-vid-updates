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
 * Shot 1 cues then lead their phrase by 0.20s: landing exactly on the word means
 * the viewer is always reading behind her. The opening bubble is the exception --
 * it is held back 0.50s so it lands on the line rather than on the "eh" before it.
 * Shot 2 is left on the word; it reads correctly as-is.
 */
const LEAD = 0.2;
const SHOT1_LEN = 9.8;
const SHOT2_LEN = 10.0;
const TAIL_LEN = 1.6;    // frozen last frame, so the end card gets a full beat
const ENDCARD_AT = 8.6;  // into shot 2

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

        {/* upper right, clear of her head, tail pointing back at her */}
        <Sequence from={sec(1.57)} durationInFrames={sec(1.05)}>
          <SpeechBubble
            kicker="TikTok Lite 新規ユーザー特典"
            text={"えっ、TikTok\n見るだけで？"}
            left="54%"
            top="9%"
            size={38}
          />
        </Sequence>

        <Sequence from={sec(2.82 - LEAD)} durationInFrames={sec(1.75 + LEAD)}>
          <BannerCaption text="これ、TikTok Liteなら" />
        </Sequence>

        <Sequence from={sec(4.74 - LEAD)} durationInFrames={sec(1.36 + LEAD)}>
          <BannerCaption text="新規ユーザー特典で" />
        </Sequence>

        {/* the money beat — burst only; the coin/shard layer read as clutter */}
        <Sequence from={sec(6.22 - LEAD)} durationInFrames={sec(1.45 + LEAD)}>
          <ComicBurst line1="1300円相当" line2="ポイント獲得！" left={-3} top={50} />
        </Sequence>

        <Sequence from={sec(8.02 - LEAD)} durationInFrames={sec(1.58 + LEAD)}>
          <BannerCaption text="ゲットできるみたいです" />
        </Sequence>
      </Sequence>

      {/* ---------- Shot 2 — CTA ---------- */}
      <Sequence from={sec(SHOT2_START)} durationInFrames={sec(SHOT2_LEN)}>
        <ClosingShot />

        <Sequence from={0} durationInFrames={sec(1.43)}>
          <BannerCaption text="いつもTikTok見てるなら" />
        </Sequence>

        <Sequence from={sec(1.43)} durationInFrames={sec(2.30)}>
          <BannerCaption text={"対象かだけでも\n確認しておいたほうがよさそう"} size={40} />
        </Sequence>

        <Sequence from={sec(4.24)} durationInFrames={sec(1.92)}>
          <BannerCaption text="新規ユーザーの人は" />
        </Sequence>

        <Sequence from={sec(6.26)} durationInFrames={sec(2.34)}>
          <BannerCaption text="一回チェックしに行ってください" size={42} />
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

export const AD_TOTAL_FRAMES = sec(TOTAL);
export const AD_FPS = FPS;
export { C };
