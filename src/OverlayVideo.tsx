import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';

interface OverlayVideoProps {
    src: string;
    x?: number;                          // centre X as % of frame width  (default 50)
    y?: number;                          // centre Y as % of frame height (default 50)
    size?: number;                       // element width as % of frame width (default 80)
    aspectRatio?: number;                // width/height ratio (default 16/9)
    rotation?: number;                   // degrees (default 0)
    borderRadius?: number;               // px (default 0)
    zOrder?: number;
    volume?: number;                     // 0–1, default 0 (muted)
    playbackRate?: number;
    videoDurationInSeconds?: number | null;
    sequenceDurationInFrames?: number;
}

export const OverlayVideo: React.FC<OverlayVideoProps> = ({
    src,
    x = 50,
    y = 50,
    size = 80,
    aspectRatio,
    rotation = 0,
    borderRadius = 0,
    zOrder = 20,
    volume = 0,
    playbackRate = 1,
    videoDurationInSeconds,
    sequenceDurationInFrames,
}) => {
    const { fps, width } = useVideoConfig();

    const resolvedSrc = src.startsWith('http')
        ? src
        : staticFile(src.includes('/') ? src : `overlay-videos/${src}`);

    const safeSize      = Math.max(10, Math.min(200, Number(size) || 80));
    const safeAspect    = Math.max(0.2, Math.min(5, Number(aspectRatio) || (16 / 9)));
    const safeRotation  = Math.max(-360, Math.min(360, Number(rotation) || 0));
    const safeVolume    = Math.max(0, Math.min(1, Number(volume) || 0));
    const safeSpeed     = Math.max(0.1, Number(playbackRate) || 1);

    const frameWidth  = (safeSize / 100) * width;
    const frameHeight = frameWidth / safeAspect;

    const containerStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: frameWidth,
        height: frameHeight,
        transform: `translate(-50%, -50%) rotate(${safeRotation}deg)`,
        overflow: 'hidden',
        borderRadius: Math.max(0, Number(borderRadius) || 0),
    };

    const videoStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
        display: 'block',
    };

    const audioProps = safeVolume > 0 ? { volume: safeVolume } : { muted: true as const };

    // Manual looping via stacked Sequences (needed for Pexels-style videos with known duration)
    if (videoDurationInSeconds && videoDurationInSeconds > 0 && sequenceDurationInFrames) {
        const videoFrames = Math.round(videoDurationInSeconds * fps);
        const loopFrames  = Math.max(1, Math.round(videoFrames / safeSpeed));
        const numLoops    = Math.ceil(sequenceDurationInFrames / loopFrames) + 1;

        return (
            <AbsoluteFill style={{ zIndex: zOrder, pointerEvents: 'none' as const }}>
                <div style={containerStyle}>
                    {Array.from({ length: numLoops }).map((_, idx) => (
                        <Sequence key={idx} from={idx * loopFrames} durationInFrames={loopFrames} layout="none">
                            <OffthreadVideo
                                src={resolvedSrc}
                                style={videoStyle}
                                {...audioProps}
                                playbackRate={safeSpeed}
                            />
                        </Sequence>
                    ))}
                </div>
            </AbsoluteFill>
        );
    }

    // Fallback: native loop
    return (
        <AbsoluteFill style={{ zIndex: zOrder, pointerEvents: 'none' as const }}>
            <div style={containerStyle}>
                <OffthreadVideo
                    src={resolvedSrc}
                    style={videoStyle}
                    {...audioProps}
                    loop
                    playbackRate={safeSpeed}
                />
            </div>
        </AbsoluteFill>
    );
};
