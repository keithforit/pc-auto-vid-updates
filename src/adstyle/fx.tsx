import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, random } from "remotion";

/**
 * Effect kit modelled on the TikTok Lite spot: a banner caption, a speech
 * bubble, a comic burst and an end card. Colours were sampled off the
 * reference frames rather than guessed.
 */
export const C = {
  burstYellow: "#EFD442",
  ink: "#201814",
  paper: "#FCFBF6",
  accentRed: "#DA3A58",
  coinDark: "#D9B553",
  coinLight: "#FCEC8C",
  cyan: "#25F4EE",
  magenta: "#FE2C55",
};

const JP = '"Noto Sans JP", "Hiragino Sans", sans-serif';
const DISPLAY = '"Dela Gothic One", "Noto Sans JP", sans-serif';

/** Splits a caption so a money figure can be tinted and enlarged like the reference does. */
const highlight = (text: string, size: number) => {
  const parts = text.split(/(\d[\d,]*円相当|\d[\d,]*円|\d[\d,]*ポイント)/g);
  return parts.map((p, i) =>
    /^\d/.test(p) ? (
      <span key={i} style={{ color: C.accentRed, fontSize: size * 1.22 }}>
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
};

/** White pill caption with a black border — the workhorse line. */
export const BannerCaption: React.FC<{ text: string; y?: string; size?: number }> = ({
  text,
  y = "74%",
  size = 46,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // measured: the old { damping: 200, mass: 0.5 } took 0.50s to reach full opacity,
  // which on a 1.4s caption reads as the text still loading in. This settles in 0.21s.
  const s = spring({ frame, fps, config: { damping: 200, mass: 0.12, stiffness: 220 } });
  const pop = interpolate(s, [0, 1], [0.86, 1]);
  const lift = interpolate(s, [0, 1], [16, 0]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start" }}>
      <div
        style={{
          position: "absolute",
          top: y,
          transform: `translateY(${lift}px) scale(${pop})`,
          opacity: s,
          background: "#fff",
          border: `4px solid ${C.ink}`,
          borderRadius: 16,
          padding: "12px 26px",
          maxWidth: "88%",
          boxShadow: "0 7px 0 rgba(32,24,20,0.22)",
          fontFamily: JP,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1.25,
          color: C.ink,
          textAlign: "center",
          whiteSpace: "pre-wrap",
        }}
      >
        {highlight(text, size)}
      </div>
    </AbsoluteFill>
  );
};

const Sparkle: React.FC<{ delay: number; x: number; y: number; size: number }> = ({ delay, x, y, size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 12, mass: 0.4 } });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ position: "absolute", left: x, top: y, transform: `scale(${s}) rotate(${s * 25}deg)`, opacity: s }}
    >
      <path
        d="M50 0 C55 35 65 45 100 50 C65 55 55 65 50 100 C45 65 35 55 0 50 C35 45 45 35 50 0 Z"
        fill={C.burstYellow}
        stroke={C.ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
    </svg>
  );
};

/** Kicker line + white bubble with a tail, used for the opening hook. */
export const SpeechBubble: React.FC<{
  kicker: string;
  text: string;
  left?: string;
  top?: string;
  size?: number;
}> = ({ kicker, text, left = "11%", top = "16%", size = 46 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 0.25s settle with a ~4% overshoot, so it still pops without dawdling
  const s = spring({ frame, fps, config: { damping: 12, mass: 0.28, stiffness: 260 } });

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left, top, transformOrigin: "left bottom", transform: `scale(${s})`, opacity: s }}>
        {/* sparkles hang off the bubble's top-left corner and scale with it */}
        <div style={{ position: "absolute", left: -54, top: 2, width: 0, height: 0 }}>
          <Sparkle delay={2} x={-6} y={0} size={62} />
          <Sparkle delay={6} x={16} y={72} size={40} />
        </div>
        <div style={{ position: "relative" }}>
          {/* pinned to the bubble's right edge and never wrapped, so it cannot run
              off frame when the bubble is placed to the right of the subject */}
          <div
            style={{
              position: "absolute",
              right: 0,
              bottom: "100%",
              marginBottom: 10,
              whiteSpace: "nowrap",
              fontFamily: JP,
              fontWeight: 900,
              fontSize: 28,
              color: C.ink,
              WebkitTextStroke: `6px ${C.paper}`,
              paintOrder: "stroke fill",
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              background: "#fff",
              border: `5px solid ${C.ink}`,
              borderRadius: 26,
              padding: "18px 30px",
              fontFamily: JP,
              fontWeight: 900,
              fontSize: size,
              lineHeight: 1.3,
              color: C.ink,
              boxShadow: "0 8px 0 rgba(32,24,20,0.18)",
              display: "inline-block",
              whiteSpace: "pre-wrap",
            }}
          >
            {highlight(text, size)}
          </div>
          {/* tail */}
          <svg width="70" height="58" viewBox="0 0 70 58" style={{ position: "absolute", left: 58, bottom: -49 }}>
            <path d="M6 0 L64 2 L20 56 Z" fill="#fff" stroke={C.ink} strokeWidth={5} strokeLinejoin="round" />
            <rect x="8" y="-8" width="54" height="14" fill="#fff" />
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Builds the jagged starburst outline procedurally. */
const burstPath = (points: number, outer: number, inner: number, seed: string) => {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const isOuter = i % 2 === 0;
    const jitter = 1 + (random(`${seed}-${i}`) - 0.5) * (isOuter ? 0.16 : 0.1);
    const r = (isOuter ? outer : inner) * jitter;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(2)},${(50 + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(" ");
};

const SpeedLines: React.FC<{ progress: number }> = ({ progress }) => (
  <>
    {new Array(9).fill(0).map((_, i) => {
      const a = (i / 9) * Math.PI * 2 + 0.35;
      const dist = interpolate(progress, [0, 1], [200, 330]);
      const op = interpolate(progress, [0, 0.35, 1], [0, 1, 0]);
      const len = 34 + random(`sl${i}`) * 38;
      return (
        <svg
          key={i}
          width={len}
          height={26}
          viewBox="0 0 100 40"
          style={{
            position: "absolute",
            left: Math.cos(a) * dist,
            top: Math.sin(a) * dist,
            transform: `translate(-50%,-50%) rotate(${(a * 180) / Math.PI}deg)`,
            opacity: op,
          }}
        >
          <path d="M0 20 L100 2 L100 38 Z" fill={C.paper} stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
        </svg>
      );
    })}
  </>
);

/** The loud one: outlined text on a yellow starburst, with speed lines. */
export const ComicBurst: React.FC<{ line1: string; line2: string }> = ({ line1, line2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 9, mass: 0.55, stiffness: 140 } });
  const wobble = Math.sin(frame / 7) * 1.2;
  const progress = Math.min(1, frame / (fps * 0.9));

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {/* anchored on the burst's centre so the lines actually radiate from it */}
      <div style={{ position: "absolute", left: "31%", top: "28%", width: 0, height: 0 }}>
        <SpeedLines progress={progress} />
      </div>

      {/* Sits in the upper-left like the reference, so the face stays readable. */}
      <div
        style={{
          position: "absolute",
          top: "9%",
          left: "-3%",
          width: 490,
          height: 490,
          transform: `scale(${s}) rotate(${-8 + wobble}deg)`,
          opacity: Math.min(1, s * 2),
        }}
      >
        <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: "visible" }}>
          <defs>
            <pattern id="halftone" width="2.6" height="2.6" patternUnits="userSpaceOnUse">
              <circle cx="1.3" cy="1.3" r="0.62" fill={C.ink} opacity="0.22" />
            </pattern>
          </defs>
          <polygon points={burstPath(16, 47, 33, "b")} fill={C.burstYellow} stroke={C.ink} strokeWidth={2.4} strokeLinejoin="round" />
          <polygon points={burstPath(16, 47, 33, "b")} fill="url(#halftone)" opacity={0.55} />
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: DISPLAY,
            color: C.paper,
            WebkitTextStroke: `10px ${C.ink}`,
            paintOrder: "stroke fill",
            textShadow: `0 6px 0 ${C.ink}`,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontSize: 54 }}>{line1}</div>
          <div style={{ fontSize: 48 }}>{line2}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Zigzag shards + tumbling coins that sit over the whole burst beat. */
export const Particles: React.FC<{ count?: number }> = ({ count = 9 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const shardColors = [C.cyan, C.magenta, C.burstYellow];

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {new Array(count).fill(0).map((_, i) => {
        // hug the outer margins — shards over the face read as clutter, not energy
        const x =
          i % 2 === 0
            ? random(`px${i}`) * width * 0.24
            : width * 0.74 + random(`px${i}`) * width * 0.24;
        const y0 = random(`py${i}`) * height;
        const drift = Math.sin(frame / 18 + i) * 14;
        const rot = frame * (0.8 + random(`pr${i}`) * 1.6) * (i % 2 ? 1 : -1);
        const scale = 0.85 + random(`ps${i}`) * 0.85;
        const op = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
        const color = shardColors[i % 3];
        return (
          <svg
            key={i}
            width={115}
            height={115}
            viewBox="0 0 100 100"
            style={{
              position: "absolute",
              left: x,
              top: y0 + drift,
              transform: `rotate(${rot}deg) scale(${scale})`,
              opacity: op * 0.95,
            }}
          >
            <path d="M20 4 L54 30 L36 40 L74 96 L40 66 L58 56 Z" fill={color} />
          </svg>
        );
      })}
      {new Array(5).fill(0).map((_, i) => {
        const x = random(`cx${i}`) * width;
        // start scattered down the frame, otherwise none of them arrive inside a 1.7s beat
        const y0 = random(`cy${i}`) * height;
        const fall = ((y0 + frame * (2.4 + random(`cv${i}`) * 2.4)) % (height + 260)) - 130;
        const spin = frame * 4 * (i % 2 ? 1 : -1);
        const squash = Math.abs(Math.cos((spin * Math.PI) / 180));
        return (
          <div
            key={`c${i}`}
            style={{
              position: "absolute",
              left: x,
              top: fall,
              width: 78,
              height: 78,
              transform: `scaleX(${0.25 + squash * 0.75})`,
            }}
          >
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <circle cx="50" cy="50" r="46" fill={C.coinDark} />
              <circle cx="50" cy="50" r="38" fill={C.coinLight} />
              <text x="50" y="66" textAnchor="middle" fontSize="46" fontWeight="900" fill={C.coinDark} fontFamily={DISPLAY}>
                T
              </text>
            </svg>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Closing card: blurred hold, the TikTok Lite lockup, glowing CTA pill. */
export const EndCard: React.FC<{ kicker: string; logo: string; cta: string }> = ({ kicker, logo, cta }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
  const ctaS = spring({ frame: frame - 8, fps, config: { damping: 13, mass: 0.5 } });
  const sweep = interpolate(frame, [10, 34], [-140, 240], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: s }}>
      <div style={{ fontFamily: JP, fontWeight: 900, fontSize: 38, color: "#fff", opacity: 0.92, marginBottom: 40, letterSpacing: 1 }}>
        {kicker}
      </div>

      {/* supplied lockup — already carries the chromatic split, so nothing is drawn over it */}
      <Img
        src={staticFile(logo)}
        style={{
          width: Math.round(width * 0.72),
          height: "auto",
          marginBottom: 48,
          transform: `scale(${interpolate(s, [0, 1], [0.88, 1])})`,
          filter: "drop-shadow(0 6px 26px rgba(0,0,0,0.45))",
        }}
      />

      <div
        style={{
          position: "relative",
          overflow: "hidden",
          background: "#0b0b0f",
          borderRadius: 999,
          padding: "20px 54px",
          fontFamily: JP,
          fontWeight: 900,
          fontSize: 40,
          color: "#fff",
          transform: `scale(${ctaS})`,
          boxShadow: `0 0 0 3px rgba(255,255,255,0.06), -6px 0 22px ${C.cyan}88, 6px 0 22px ${C.magenta}88`,
        }}
      >
        {cta}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${sweep}%`,
            width: "34%",
            background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.42), transparent)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
