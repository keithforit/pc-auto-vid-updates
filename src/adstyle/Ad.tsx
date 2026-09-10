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
import { BannerCaption, SpeechBubble, ComicBurst, Particles, EndCard, C } from "./fx";

const FPS = 24;
const sec = (s: number) => Math.round(s * FPS);

/** Timeline lives here so the beats stay readable next to the transcript. */
const SHOT1_LEN = 8.0;   // hook.mp4 — the offer explainer
const SHOT2_LEN = 10.0;  // close.mp4 — the CTA
const ENDCARD_AT = 7.7;  // into shot 2, right as the VO finishes

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

/** Shot 2 blurs and darkens under the end card instead of hard-cutting to it. */
const ClosingShot: React.FC = () => {
  const frame = useCurrentFrame();
  const start = sec(ENDCARD_AT);
  const blur = interpolate(frame, [start - 8, start + 6], [0, 20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dim = interpolate(frame, [start - 8, start + 6], [0, 0.55], {
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

        <Sequence from={0} durationInFrames={sec(1.8)}>
          <SpeechBubble kicker="TikTok Lite 新規ユーザー特典" text={"えっ、TikTok\n見るだけで？"} />
        </Sequence>

        <Sequence from={sec(1.8)} durationInFrames={sec(1.6)}>
          <BannerCaption text="これ、TikTok Liteなら" />
        </Sequence>

        <Sequence from={sec(3.4)} durationInFrames={sec(1.3)}>
          <BannerCaption text="新規ユーザー特典で" />
        </Sequence>

        {/* the money beat */}
        <Sequence from={sec(4.7)} durationInFrames={sec(1.7)}>
          <Particles />
          <ComicBurst line1="1300円相当" line2="ポイント獲得！" />
        </Sequence>

        <Sequence from={sec(6.4)} durationInFrames={sec(1.6)}>
          <BannerCaption text="ゲットできるみたいです" />
        </Sequence>
      </Sequence>

      {/* ---------- Shot 2 — CTA ---------- */}
      <Sequence from={sec(SHOT1_LEN)} durationInFrames={sec(SHOT2_LEN)}>
        <ClosingShot />

        <Sequence from={0} durationInFrames={sec(1.5)}>
          <BannerCaption text="いつもTikTok見てるなら" />
        </Sequence>

        <Sequence from={sec(1.5)} durationInFrames={sec(2.4)}>
          <BannerCaption text={"対象かだけでも\n確認しておいたほうがよさそう"} size={40} />
        </Sequence>

        <Sequence from={sec(4.0)} durationInFrames={sec(1.4)}>
          <BannerCaption text="新規ユーザーの人は" />
        </Sequence>

        <Sequence from={sec(5.4)} durationInFrames={sec(2.3)}>
          <BannerCaption text="一回チェックしに行ってください" size={42} />
        </Sequence>

        <Sequence from={sec(ENDCARD_AT)} durationInFrames={sec(SHOT2_LEN - ENDCARD_AT)}>
          <EndCard kicker="TikTok Lite 新規ユーザー特典" logo="adstyle/tiktok-lite.png" cta="今すぐダウンロード" />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export const AD_TOTAL_FRAMES = sec(SHOT1_LEN + SHOT2_LEN);
export const AD_FPS = FPS;
export { C };
