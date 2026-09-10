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
import { Caption } from "../Caption";
import { Particles, EndCard, C } from "./fx";

const FPS = 24;
const sec = (s: number) => Math.round(s * FPS);

/** Timeline lives here so the beats stay readable next to the transcript. */
const SHOT1_LEN = 8.0;   // hook.mp4 — the offer explainer
const SHOT2_LEN = 10.0;  // close.mp4 — the CTA
const ENDCARD_AT = 7.7;  // into shot 2, right as the VO finishes

/**
 * Everything textual here goes through the app's own <Caption>, using only props the
 * editor already exposes — so whatever this renders is reproducible from the UI.
 */
const PILL = {
  textStyle: "block",
  blockColor: "#ffffff",
  textColor: "#201814",
  textStrokeColor: "#201814",
  textStrokeSize: 4,
  blockBorderRadius: 16,
  font: "noto",
  position: "bottom",
  fontSize: 46,
  animation: "pop",
  noWrap: true,
} as const;

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
          <Caption
            text="TikTok Lite 新規ユーザー特典"
            textStyle="shadow"
            textColor="#ffffff"
            font="noto"
            textX={40}
            textY={13}
            fontSize={30}
            animation="pop"
            noWrap
            totalDurationInFrames={sec(1.8)}
          />
          <Caption
            text={"えっ、TikTok\n見るだけで？"}
            textStyle="bubble"
            font="noto"
            textX={40}
            textY={22}
            fontSize={46}
            animation="pop"
            noWrap
            totalDurationInFrames={sec(1.8)}
          />
        </Sequence>

        <Sequence from={sec(1.8)} durationInFrames={sec(1.6)}>
          <Caption {...PILL} text="これ、TikTok Liteなら" totalDurationInFrames={sec(1.6)} />
        </Sequence>

        <Sequence from={sec(3.4)} durationInFrames={sec(1.3)}>
          <Caption {...PILL} text="新規ユーザー特典で" totalDurationInFrames={sec(1.3)} />
        </Sequence>

        {/* the money beat — burst style, with the particle layer behind it */}
        <Sequence from={sec(4.7)} durationInFrames={sec(1.7)}>
          <Particles />
          <Caption
            text={"1300円相当\nポイント獲得！"}
            textStyle="burst"
            font="dela"
            textX={34}
            textY={26}
            rotation={-8}
            fontSize={54}
            animation="pop"
            noWrap
            totalDurationInFrames={sec(1.7)}
          />
        </Sequence>

        <Sequence from={sec(6.4)} durationInFrames={sec(1.6)}>
          <Caption {...PILL} text="ゲットできるみたいです" totalDurationInFrames={sec(1.6)} />
        </Sequence>
      </Sequence>

      {/* ---------- Shot 2 — CTA ---------- */}
      <Sequence from={sec(SHOT1_LEN)} durationInFrames={sec(SHOT2_LEN)}>
        <ClosingShot />

        <Sequence from={0} durationInFrames={sec(1.5)}>
          <Caption {...PILL} text="いつもTikTok見てるなら" totalDurationInFrames={sec(1.5)} />
        </Sequence>

        <Sequence from={sec(1.5)} durationInFrames={sec(2.4)}>
          <Caption
            {...PILL}
            text={"対象かだけでも\n確認しておいたほうがよさそう"}
            fontSize={40}
            totalDurationInFrames={sec(2.4)}
          />
        </Sequence>

        <Sequence from={sec(4.0)} durationInFrames={sec(1.4)}>
          <Caption {...PILL} text="新規ユーザーの人は" totalDurationInFrames={sec(1.4)} />
        </Sequence>

        <Sequence from={sec(5.4)} durationInFrames={sec(2.3)}>
          <Caption {...PILL} text="一回チェックしに行ってください" fontSize={42} totalDurationInFrames={sec(2.3)} />
        </Sequence>

        <Sequence from={sec(ENDCARD_AT)} durationInFrames={sec(SHOT2_LEN - ENDCARD_AT)}>
          <EndCard kicker="TikTok Lite 新規ユーザー特典" wordmark="TikTok Lite" cta="今すぐダウンロード" />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export const AD_TOTAL_FRAMES = sec(SHOT1_LEN + SHOT2_LEN);
export const AD_FPS = FPS;
export { C };
