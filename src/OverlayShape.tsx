import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface OverlayShapeProps {
    type?: 'rectangle' | 'square' | 'circle' | 'ribbon';
    animation?: string;
    color?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    opacity?: number;
    zOrder?: number;
    totalDurationInFrames?: number;
    fadeInDurationSec?: number;
    fadeOutDurationSec?: number;
    borderRadius?: number;  // 0–50 (%), corner rounding; ignored for circle (always 50%)
}

export const OverlayShape: React.FC<OverlayShapeProps> = ({
    type = 'rectangle',
    animation = 'fade',
    color = '#ffffff',
    x = 50,
    y = 50,
    width = 30,
    height = 15,
    rotation = 0,
    opacity = 1,
    zOrder = 5,
    totalDurationInFrames,
    fadeInDurationSec = 1.5,
    fadeOutDurationSec = 1.5,
    borderRadius = 0,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const fadeInFrames = Math.max(8, Math.round((fadeInDurationSec || 1.5) * fps));
    const fadeOutFrames = Math.max(8, Math.round((fadeOutDurationSec || 1.5) * fps));
    const exitStart = totalDurationInFrames ? Math.max(0, totalDurationInFrames - fadeOutFrames) : Infinity;

    const exitFade = totalDurationInFrames && frame >= exitStart
        ? interpolate(frame, [exitStart, totalDurationInFrames], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.inOut(Easing.ease),
        })
        : 1;

    let shapeOpacity = opacity;
    let animClipPath: string | undefined;

    switch (animation) {
        case 'static': {
            shapeOpacity = opacity;
            break;
        }
        case 'wipe': {
            const wipeIn = interpolate(frame, [0, fadeInFrames], [100, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.out(Easing.cubic),
            });
            const wipeOut = totalDurationInFrames && frame >= exitStart
                ? interpolate(frame, [exitStart, totalDurationInFrames], [0, 100], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.in(Easing.cubic),
                })
                : 0;
            animClipPath = `inset(0 ${(frame >= exitStart ? wipeOut : wipeIn).toFixed(1)}% 0 0)`;
            shapeOpacity = opacity;
            break;
        }
        default: {
            const fadeIn = interpolate(frame, [0, fadeInFrames], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.out(Easing.cubic),
            });
            shapeOpacity = opacity * fadeIn * exitFade;
        }
    }

    const isSquare = type === 'square';
    const widthPx  = (width / 100) * 1080;
    const heightPx = isSquare ? widthPx : (height / 100) * 1080;
    const cornerRadius = type === 'circle'
        ? '50%'
        : `${Math.max(0, Math.min(50, Number(borderRadius) || 0))}%`;

    // Ribbon: V-notches cut into both left and right edges
    const shapeClipPath = type === 'ribbon'
        ? 'polygon(0% 0%, 100% 0%, 90% 50%, 100% 100%, 0% 100%, 10% 50%)'
        : undefined;

    return (
        <AbsoluteFill style={{ zIndex: zOrder, overflow: 'hidden' }}>
            {/* Outer div: position + shape clip-path (ribbon). Inner div: animation + color. */}
            <div
                style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    width: widthPx,
                    height: heightPx,
                    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                    clipPath: shapeClipPath,
                }}
            >
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: color,
                        borderRadius: cornerRadius,
                        opacity: shapeOpacity,
                        clipPath: animClipPath,
                    }}
                />
            </div>
        </AbsoluteFill>
    );
};
