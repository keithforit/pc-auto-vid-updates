import React from 'react';
import { AbsoluteFill, Img, interpolate, Easing, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

interface OverlayImageProps {
    src: string;
    vPos?: string;
    hPos?: string;
    x?: number;
    y?: number;
    size?: number;
    zOrder?: number;
    cropEnabled?: boolean;
    cropScale?: number;
    cropX?: number;
    cropY?: number;
    aspectRatio?: number;
    rotation?: number;
    borderRadius?: number;
    animation?: 'static' | 'fade-in' | 'fade-out' | 'fade-both' | 'fade' | 'fader';
    totalDurationInFrames?: number;
    fadeInDurationSec?: number;
    fadeOutDurationSec?: number;
    faderDurationSec?: number;
}

export const OverlayImage: React.FC<OverlayImageProps> = ({
    src,
    vPos = 'top',
    hPos = 'center',
    x,
    y,
    size = 35,
    zOrder = 15,
    cropEnabled = false,
    cropScale = 1,
    cropX = 50,
    cropY = 50,
    aspectRatio = 1,
    rotation = 0,
    borderRadius = 0,
    animation = 'fade-both',
    totalDurationInFrames,
    fadeInDurationSec = 1.5,
    fadeOutDurationSec = 1.5,
    faderDurationSec = 1,
}) => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();

    const resolvedSrc = src.startsWith('http')
        ? src
        : staticFile(src.includes('/') ? src : `overlays/${src}`);

    const resolvedX = Number.isFinite(Number(x))
        ? Number(x)
        : ({ left: 18, center: 50, right: 82 } as Record<string, number>)[hPos] ?? 50;
    const resolvedY = Number.isFinite(Number(y))
        ? Number(y)
        : ({ top: 18, center: 50, bottom: 82 } as Record<string, number>)[vPos] ?? 18;

    const safeSize = Math.max(10, Math.min(120, Number(size) || 35));
    const safeAspect = Math.max(0.25, Math.min(4, Number(aspectRatio) || 1));
    const safeCropScale = Math.max(1, Math.min(3, Number(cropScale) || 1));
    const safeCropX = Math.max(0, Math.min(100, Number(cropX) || 50));
    const safeCropY = Math.max(0, Math.min(100, Number(cropY) || 50));
    const safeRotation = Math.max(-180, Math.min(180, Number(rotation) || 0));

    const frameWidth = (safeSize / 100) * width;
    const frameHeight = frameWidth / safeAspect;

    const normalizedAnimation = animation === 'fade' ? 'fade-both' : (animation || 'fade-both');
    const fadeInFrames = Math.max(8, Math.round((fadeInDurationSec || 1.5) * fps));
    const fadeOutFrames = Math.max(8, Math.round((fadeOutDurationSec || 1.5) * fps));
    const exitStart = totalDurationInFrames ? Math.max(0, totalDurationInFrames - fadeOutFrames) : Infinity;

    let opacity = 1;

    if (normalizedAnimation === 'fader') {
        // Repeating pulse: fades from 0→1→0 over one cycle, looping continuously.
        // faderDurationSec is the full cycle length (fade-in + fade-out).
        const cycleLengthFrames = Math.max(4, Math.round((faderDurationSec || 1) * fps));
        const halfCycle = cycleLengthFrames / 2;
        const posInCycle = frame % cycleLengthFrames;
        opacity = posInCycle < halfCycle
            ? interpolate(posInCycle, [0, halfCycle], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.inOut(Easing.ease),
            })
            : interpolate(posInCycle, [halfCycle, cycleLengthFrames], [1, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.inOut(Easing.ease),
            });
    } else {
        const fadeIn = ['fade-in', 'fade-both'].includes(normalizedAnimation)
            ? interpolate(frame, [0, fadeInFrames], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.out(Easing.cubic),
            })
            : 1;

        const fadeOut = ['fade-out', 'fade-both'].includes(normalizedAnimation) && totalDurationInFrames && frame >= exitStart
            ? interpolate(frame, [exitStart, totalDurationInFrames], [1, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.in(Easing.cubic),
            })
            : 1;

        opacity = fadeIn * fadeOut;
    }

    return (
        <AbsoluteFill style={{ zIndex: zOrder, overflow: 'hidden', pointerEvents: 'none' }}>
            <div
                style={{
                    position: 'absolute',
                    left: `${resolvedX}%`,
                    top: `${resolvedY}%`,
                    width: frameWidth,
                    height: frameHeight,
                    transform: `translate(-50%, -50%) rotate(${safeRotation}deg)`,
                    overflow: 'hidden',
                    borderRadius: Math.max(0, Number(borderRadius) || 0),
                    opacity,
                }}
            >
                <Img
                    src={resolvedSrc}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: cropEnabled ? 'cover' : 'contain',
                        objectPosition: `${safeCropX}% ${safeCropY}%`,
                        transform: cropEnabled ? `scale(${safeCropScale})` : 'scale(1)',
                        transformOrigin: `${safeCropX}% ${safeCropY}%`,
                        display: 'block',
                    }}
                />
            </div>
        </AbsoluteFill>
    );
};
