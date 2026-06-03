import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Calculate width based on progress
  const progress = frame / durationInFrames;

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end' }}>
      <div style={{
        height: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        width: '100%',
      }}>
        <div style={{
          height: '100%',
          backgroundColor: 'white',
          width: `${progress * 100}%`,
          boxShadow: "0 0 10px rgba(255,255,255,0.5)"
        }} />
      </div>
    </AbsoluteFill>
  );
};