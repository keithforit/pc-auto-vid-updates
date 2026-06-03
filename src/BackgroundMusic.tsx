import React from "react";
import {
    Audio,
    staticFile,
    useCurrentFrame,
    useVideoConfig,
    interpolate
} from "remotion";

export const BackgroundMusic: React.FC<{ src: string }> = ({ src }) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    // 🛠️ FADE LOGIC:
    // Start fading 30 frames (1 second) before the end
    const volume = interpolate(
        frame,
        [durationInFrames - 30, durationInFrames - 5],
        [0.15, 0], // From 15% volume to 0%
        {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
        }
    );

    if (!src) return null;

    return (
        <Audio
            src={staticFile(src)}
            volume={volume}
            loop
        />
    );
};