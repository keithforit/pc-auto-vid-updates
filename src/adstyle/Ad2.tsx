import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
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
 * Second spot. The source is a single pre-built file: the two x-ad.com clips
 * joined with a 0.20s cross-dissolve (the hard cut between a close-up and a
 * wide of the same person in the same room read as a jump cut), with clip 2
 * brightened and both normalised to -14 LUFS.
 *
 * Cue times come from tiktok_lite_20s_final.srt, which was checked against the
 * audio: every cue start sits on a clean silence-to-speech jump. Cues after the
 * dissolve are shifted -0.20s because the overlap shortens the timeline.
 *
 * Each caption holds until the next cue starts, so no blank frames appear.
 */
const TOTAL = 19.917;
const ENDCARD_AT = 18.0;
const SHIFT = 0.2; // dissolve overlap, applied to every cue after the cut

const BLUR_MAX = 20;
const DIM_MAX = 0.55;

const useAdFonts = () => {
  const [handle] = useState(() => delayRender("adstyle2-fonts"));
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Noto+Sans+JP:wght@900&display=swap";
    document.head.appendChild(link);
    const probe = "1300円相当ポイント獲得TikTok見るだけで新規ユーザー特典対象確認今すぐダウンロードいつも回人ゲットみたチェックしてね";
    Promise.all([
      (document as any).fonts.load('900 48px "Noto Sans JP"', probe),
      (document as any).fonts.load('400 48px "Dela Gothic One"', probe),
    ])
      .then(() => (document as any).fonts.ready)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
};

/** Blurs and dims into the end card rather than hard-cutting to it. */
const Footage: React.FC = () => {
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
        src={staticFile("adstyle/v2.mp4")}
        style={{ width: "100%", height: "100%", objectFit: "cover", filter: `blur(${blur}px)` }}
      />
      <AbsoluteFill style={{ background: `rgba(8,8,12,${dim})` }} />
    </AbsoluteFill>
  );
};

/** from/to in seconds on the final timeline. */
const Cue: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => (
  <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>
    {children}
  </Sequence>
);

export const Ad2: React.FC = () => {
  useAdFonts();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#000", width, height }}>
      <Footage />

      {/* 1 — hook */}
      <Cue from={0.78} to={2.66}>
        <SpeechBubble
          kicker="TikTok Lite 新規ユーザー特典"
          text={"えっ、TikTok\n見るだけで？"}
          left="30%"
          top="6%"
          size={38}
        />
      </Cue>

      {/* 2 — the offer, spoken as one continuous run so it stays one caption */}
      <Cue from={2.66} to={5.32}>
        <BannerCaption text={"これ、TikTok Liteなら\n新規ユーザー特典で"} size={40} />
      </Cue>

      {/* 3 — money beat. Lower-left and smaller: this shot is a tight close-up,
             her face fills the upper half and her hand the lower right. */}
      <Cue from={5.32} to={6.96}>
        <ComicBurst line1="1300円相当" line2="ポイント獲得！" left={2} top={60} size={400} />
      </Cue>

      {/* 4 — holds across the dissolve, which helps mask the shot change */}
      <Cue from={6.96} to={8.54 - SHIFT}>
        <BannerCaption text="ゲットできるみたいです" />
      </Cue>

      {/* ---- after the dissolve, everything shifts by -SHIFT ---- */}
      <Cue from={8.54 - SHIFT} to={10.58 - SHIFT}>
        <BannerCaption text="いつもTikTok見てるなら" />
      </Cue>

      <Cue from={10.58 - SHIFT} to={14.3 - SHIFT}>
        <BannerCaption text={"対象かだけでも\n確認しておいたほうがよさそう"} size={40} />
      </Cue>

      <Cue from={14.3 - SHIFT} to={15.84 - SHIFT}>
        <BannerCaption text="新規ユーザーの人は" />
      </Cue>

      <Cue from={15.84 - SHIFT} to={18.2 - SHIFT}>
        <BannerCaption text={"一回チェックしに\n行ってください"} size={42} />
      </Cue>

      <Cue from={ENDCARD_AT} to={TOTAL}>
        <BannerCaption text="チェックしてね" />
      </Cue>

      <Cue from={ENDCARD_AT} to={TOTAL}>
        <EndCard kicker="TikTok Lite 新規ユーザー特典" logo="adstyle/tiktok-lite.png" cta="今すぐダウンロード" />
      </Cue>
    </AbsoluteFill>
  );
};

export const AD2_TOTAL_FRAMES = sec(TOTAL);
export const AD2_FPS = FPS;
export { C };
