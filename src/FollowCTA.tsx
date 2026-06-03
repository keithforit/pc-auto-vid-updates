import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  SpringConfig,
  spring
} from "remotion";

export const FollowCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = { fps: 30 }; // Assuming 30fps

  const entrance = spring({
    frame,
    fps,
    config: {
      damping: 12,
    },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        top: "20%", // Positioned lower than your top captions
      }}
    >
      <div
        style={{
          transform: `scale(${entrance})`,
          backgroundColor: "white",
          color: "black",
          padding: "20px 40px",
          borderRadius: "50px",
          fontSize: "60px",
          fontWeight: "bold",
          fontFamily: "sans-serif",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          textTransform: "uppercase",
        }}
      >
        ➕ Follow for more
      </div>
    </AbsoluteFill>
  );
};