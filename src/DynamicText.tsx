import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface DynamicTextProps {
    title: string;
}

export const DynamicText: React.FC<DynamicTextProps> = ({ title }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Use relative timing based on the 150 frame phrase intervals
    const relativeFrame = frame % 150;
    const scale = spring({
        fps,
        frame: relativeFrame,
        config: {
            stiffness: 100,
            damping: 10,
        },
    });

    return (
        <AbsoluteFill
            style={{
                justifyContent: "flex-start",
                alignItems: "center",
                paddingTop: "150px",
            }}
        >
            <div
                style={{
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    padding: "20px 40px",
                    borderRadius: "20px",
                    transform: `scale(${scale})`,
                }}
            >
                <div
                    style={{
                        fontFamily: "sans-serif",
                        fontWeight: "bold",
                        fontSize: "100px",
                        color: "white",
                        textShadow: "6px 6px 0px black, -6px -6px 0px black, 6px -6px 0px black, -6px 6px 0px black",
                        textAlign: "center",
                    }}
                >
                    {title}
                </div>
            </div>
        </AbsoluteFill>
    );
};
