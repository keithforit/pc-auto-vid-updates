import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

// Largest font size (<= maxPx) at which the longest line of `text` fits within `availPx`.
// Uses canvas measureText so it's deterministic and works in both the browser preview and
// the Remotion render. Returns maxPx when it already fits (or measurement is unavailable).
let _fitCanvas: HTMLCanvasElement | null = null;
function fitFontSize(text: string, fontFamily: string, fontWeight: string | number, maxPx: number, availPx: number): number {
    if (!text || availPx <= 0 || typeof document === 'undefined') return maxPx;
    _fitCanvas = _fitCanvas || document.createElement('canvas');
    const ctx = _fitCanvas.getContext('2d');
    if (!ctx) return maxPx;
    ctx.font = `${fontWeight} ${maxPx}px ${fontFamily}`;
    let widest = 0;
    for (const line of String(text).split(/\r?\n/)) widest = Math.max(widest, ctx.measureText(line).width);
    if (widest <= availPx || widest === 0) return maxPx;
    return Math.max(12, Math.floor(maxPx * (availPx / widest)));
}

// Parse [word|#hex] or [word] inline color spans within a single line of text.
// [word] without a color uses highlightColor (if provided), otherwise renders plainly.
function renderLine(line: string, highlightColor?: string, revealProgress?: number): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const pattern = /\[([^\]|]+)(?:\|([^\]]+))?\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    // 'reveal' animation: each [bracketed] span wipes in left-to-right via clip-path while
    // keeping its full width reserved (inline-block), so surrounding static text never shifts.
    const revealStyle = (): React.CSSProperties => revealProgress != null
        ? { display: 'inline-block', clipPath: `inset(0 ${((1 - revealProgress) * 100).toFixed(2)}% 0 0)` }
        : {};
    while ((match = pattern.exec(line)) !== null) {
        if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
        const spanText = match[1];
        const spanColor = match[2] || highlightColor;
        if (spanColor || revealProgress != null) {
            parts.push(<span key={match.index} style={{ ...(spanColor ? { color: spanColor } : {}), ...revealStyle() }}>{spanText}</span>);
        } else {
            parts.push(spanText);
        }
        lastIndex = pattern.lastIndex;
    }
    if (lastIndex < line.length) parts.push(line.slice(lastIndex));
    return parts.length > 0 ? parts : [line];
}

interface CaptionProps {
    text: string;
    textStyle?: string;
    animation?: string;       // 'pop' | 'static' | 'fade' | 'fade-in' | 'fade-out' | 'fade-both' | 'wipe' | 'reveal' | 'block'
    glowColor?: string;
    glowSize?: number;
    font?: string;
    position?: string;
    textHPosition?: string;  // horizontal screen position: 'left' | 'center' | 'right'
    textAlign?: string;      // text formatting: 'left' | 'center' | 'right'
    blockColor?: string;
    textColor?: string;
    textStrokeColor?: string;
    textStrokeSize?: number;
    boxBorderRadius?: number;
    blockBorderRadius?: number;
    totalDurationInFrames?: number;
    textX?: number;
    textY?: number;
    rotation?: number;
    fontSize?: number;
    glowTextColor?: string;
    startAtFrame?: number;
    hideAtFrame?: number;
    fadeInDurationSec?: number;
    fadeOutDurationSec?: number;
    noWrap?: boolean;
    autoFit?: boolean;     // shrink font so no-wrap text fits the frame width (default on)
    textBoxWidth?: number; // percentage of video width, e.g. 85 = 85%
    textPadding?: number;  // padding in px for block/box styles (applied as px top/bottom and 2x px left/right)
    highlightColor?: string; // default color for [word] spans without explicit color
    shadowOffset?: number;  // Y-offset in px (X = offset * 0.67), default 3
    shadowBlur?: number;    // blur radius in px, default 6
    shadowOpacity?: number; // 0-100 percentage, default 85
}

export const Caption: React.FC<CaptionProps> = ({
    text,
    textStyle = 'box',
    animation = 'pop',
    glowColor = '#00ffff',
    glowSize = 1,
    font = 'noto',
    position = 'bottom',
    textHPosition = 'center',
    textAlign = 'center',
    blockColor = '#ffdd00',
    textColor = '#000000',
    textStrokeColor = '#000000',
    textStrokeSize = 0,
    boxBorderRadius = 20,
    blockBorderRadius = 10,
    totalDurationInFrames,
    textX,
    textY,
    rotation = 0,
    fontSize = 70,
    glowTextColor = 'white',
    startAtFrame,
    hideAtFrame,
    fadeInDurationSec = 1.5,
    fadeOutDurationSec = 1.5,
    noWrap = false,
    autoFit = true,
    textBoxWidth,
    textPadding,
    highlightColor,
    shadowOffset = 3,
    shadowBlur = 6,
    shadowOpacity = 85,
}) => {
    const { width: videoWidth } = useVideoConfig();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const isFreePos = textX !== undefined && textY !== undefined;
    const hasStarted = startAtFrame == null || frame >= startAtFrame;
    const localFrame = startAtFrame != null ? Math.max(0, frame - startAtFrame) : frame;

    const fadeInFrames = Math.max(8, Math.round((fadeInDurationSec || 1.5) * fps));
    const fadeOutFrames = Math.max(8, Math.round((fadeOutDurationSec || 1.5) * fps));
    const exitStart = totalDurationInFrames ? Math.max(0, totalDurationInFrames - fadeOutFrames) : Infinity;
    const hideFrames = Math.max(8, Math.round((fadeOutDurationSec || 1.5) * fps));

    const hideOp = (hideAtFrame != null && frame >= hideAtFrame - hideFrames)
        ? Math.max(0, interpolate(frame, [hideAtFrame - hideFrames, hideAtFrame], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.inOut(Easing.ease),
        }))
        : 1;

    const exitFade = totalDurationInFrames && frame >= exitStart
        ? interpolate(frame, [exitStart, totalDurationInFrames], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.inOut(Easing.ease),
        })
        : 1;

    let scale = 1;
    let opacity = hideOp;
    let textRevealOpacity = 1;
    let revealProgress = 1; // 'reveal': 0→1 left-to-right wipe of [bracketed] spans (1 = fully shown)
    let clipPath: string | undefined;
    // wipe: block sweeps left-to-right revealing text underneath
    let wipeSweepX = -105; // translateX % of the block cover
    let showWipeCover = false;

    if (!hasStarted) {
        scale = 1;
        opacity = 0;
        textRevealOpacity = 0;
        revealProgress = 0;
    } else {
        switch (animation) {
            case 'static': {
                opacity = hideOp;
                break;
            }
            case 'fade':
            case 'fade-both': {
                const fadeIn = interpolate(localFrame, [0, fadeInFrames], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.out(Easing.cubic),
                });
                opacity = fadeIn * exitFade * hideOp;
                break;
            }
            case 'fade-in': {
                // Fades in at start, stays fully visible — no exit fade
                const fadeIn = interpolate(localFrame, [0, fadeInFrames], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.out(Easing.cubic),
                });
                opacity = fadeIn * hideOp;
                break;
            }
            case 'fade-out': {
                // Appears immediately, fades out at end
                opacity = exitFade * hideOp;
                break;
            }
            case 'wipe': {
                // Phase 1: coloured block sweeps left→right over the text (covers it)
                // Phase 2: block continues sweeping right, revealing text behind it
                const sweepMid = Math.max(8, Math.round(fadeInFrames * 0.45));
                wipeSweepX = interpolate(localFrame, [0, sweepMid, fadeInFrames], [-105, 0, 105], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.inOut(Easing.ease),
                });
                showWipeCover = localFrame < fadeInFrames;
                // Text fades in from behind the block as it sweeps away
                textRevealOpacity = interpolate(localFrame, [sweepMid, fadeInFrames], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.out(Easing.cubic),
                });
                opacity = exitFade * hideOp;
                break;
            }
            case 'reveal': {
                // Everything appears immediately; only the [bracketed] highlight spans wipe in
                // left-to-right (applied per-span in renderLine via revealProgress).
                revealProgress = interpolate(localFrame, [0, fadeInFrames], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.out(Easing.cubic),
                });
                opacity = exitFade * hideOp;
                break;
            }
            default: {
                // Pop: scale in place using transform-origin center
                const popFrames = Math.max(14, Math.min(24, fadeInFrames));
                scale = interpolate(localFrame, [0, Math.round(popFrames * 0.35), Math.round(popFrames * 0.7), popFrames], [0.7, 1.12, 0.98, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.inOut(Easing.ease),
                });
                opacity = exitFade * hideOp;
            }
        }
    }

    const fontMap: Record<string, string> = {
        noto:         '"Noto Sans JP", sans-serif',
        dela:         '"Dela Gothic One", sans-serif',
        notoserifJP:  '"Noto Serif JP", serif',
        bebas:        '"Bebas Neue", sans-serif',
        oswald:       '"Oswald", sans-serif',
        bangers:      '"Bangers", sans-serif',
        mplus:        '"M PLUS Rounded 1c", sans-serif',
        // Japanese
        lineseedjp:   '"LINE Seed JP", sans-serif',
        mplus1:       '"M PLUS 1", sans-serif',
        bizudp:       '"BIZ UDPGothic", sans-serif',
        ibmplexjp:    '"IBM Plex Sans JP", sans-serif',
        yugothic:     '"Yu Gothic", "YuGothic", "Hiragino Kaku Gothic ProN", sans-serif',
        zenmaru:      '"Zen Maru Gothic", sans-serif',
        // English / Latin
        geist:        '"Geist", sans-serif',
        satoshi:      '"Satoshi", sans-serif',
        calsans:      '"Cal Sans", sans-serif',
        manrope:      '"Manrope", sans-serif',
        spacegrotesk: '"Space Grotesk", sans-serif',
        helvetica:    '"Helvetica Neue", Helvetica, Arial, sans-serif',
        hanken:       '"Hanken Grotesk", sans-serif',
    };
    const fontFamily = fontMap[font] ?? '"Noto Sans JP", sans-serif';
    // Auto-fit: when on (default) and not wrapping, shrink the font so the longest line
    // fits within ~88% of the frame width — so no-wrap text never runs off the edge.
    const fontWeightForFit = textStyle === 'box' ? 600 : 900;
    const _visibleText = String(text || '').replace(/\[([^\]|]+)(?:\|[^\]]+)?\]/g, '$1');
    const renderFontSize = (autoFit && noWrap)
        ? fitFontSize(_visibleText, fontFamily, fontWeightForFit, fontSize, videoWidth * 0.88)
        : fontSize;

    const positionStyle = (() => {
        const vertical = (() => {
            switch (position) {
                case 'top':    return { justifyContent: 'flex-start' as const, paddingTop: 150 };
                case 'center': return { justifyContent: 'center' as const };
                default:       return { justifyContent: 'flex-end' as const, paddingBottom: 200 };
            }
        })();
        const horizontal = (() => {
            switch (textHPosition) {
                case 'left':   return { alignItems: 'flex-start' as const, paddingLeft: 60 };
                case 'right':  return { alignItems: 'flex-end' as const, paddingRight: 60 };
                default:       return { alignItems: 'center' as const };
            }
        })();
        return { ...vertical, ...horizontal };
    })();

    const shellTransform: React.CSSProperties = isFreePos
        ? { position: 'absolute' as const, left: `${textX}%`, top: `${textY}%`, transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`, transformOrigin: 'center center' }
        : { transform: `rotate(${rotation}deg) scale(${scale})`, transformOrigin: 'center center' };

    const strokeWidth = Math.max(0, Number(textStrokeSize) || 0);
    const blockBorderStyle = strokeWidth > 0
        ? { border: `${strokeWidth}px solid ${textStrokeColor}`, boxSizing: 'border-box' as const }
        : {};
    const glowAmount = Math.max(0, Number(glowSize) || 0);
    const glowShadow = glowAmount > 0
        ? [
            `0 0 ${Math.max(1, Math.round(glowAmount * 0.5))}px ${glowColor}`,
            `0 0 ${Math.max(2, Math.round(glowAmount))}px ${glowColor}`,
            `0 0 ${Math.max(3, Math.round(glowAmount * 2))}px ${glowColor}`,
            `0 0 ${Math.max(4, Math.round(glowAmount * 4))}px ${glowColor}`,
            `0 2px 8px rgba(0,0,0,0.9)`
        ].join(', ')
        : '0 2px 8px rgba(0,0,0,0.9)';

    // Width: compute in pixels to avoid CSS circular dependency (% on inline-block has no definite containing block)
    const resolvedMaxWidthPx = textBoxWidth != null
        ? Math.round(videoWidth * textBoxWidth / 100)
        : Math.round(videoWidth * 0.85);
    // noWrap: override width to be unconstrained so text never wraps
    const widthStyle: React.CSSProperties = noWrap
        ? { whiteSpace: 'pre' as const, width: 'max-content', maxWidth: 'none', overflow: 'visible' }
        : {};

    let textContentStyle: React.CSSProperties;
    const blockPad = textPadding != null ? `${textPadding}px ${textPadding * 2}px` : '18px 40px';
    const boxPad   = textPadding != null ? `${textPadding}px ${textPadding * 2}px` : '25px 45px';
    if (textStyle === 'block') {
        textContentStyle = { textAlign: textAlign as any, padding: blockPad, borderRadius: `${blockBorderRadius}px`, backgroundColor: blockColor, color: textColor, fontSize: renderFontSize, fontWeight: '900', fontFamily, lineHeight: 1.3, ...blockBorderStyle, ...widthStyle };
    } else if (textStyle === 'glow') {
        textContentStyle = { textAlign: textAlign as any, padding: '0 30px', color: glowTextColor, fontSize: renderFontSize, fontWeight: '900', fontFamily, lineHeight: 1.3, WebkitTextStroke: `${Math.max(1, Math.round(glowAmount * 0.2))}px ${glowColor}`, textShadow: glowShadow, ...widthStyle };
    } else if (textStyle === 'shadow') {
        const sOff = Math.max(0, Number(shadowOffset) || 3);
        const sBlur = Math.max(0, Number(shadowBlur) || 6);
        const sAlpha = Math.min(1, Math.max(0, (Number(shadowOpacity) || 85) / 100));
        const sAlpha2 = Math.round(sAlpha * 70) / 100;
        const shadowCss = `${Math.round(sOff * 0.67)}px ${sOff}px ${sBlur}px rgba(0,0,0,${sAlpha.toFixed(2)}), 0 1px ${Math.max(1, Math.round(sBlur / 3))}px rgba(0,0,0,${sAlpha2.toFixed(2)})`;
        textContentStyle = { textAlign: textAlign as any, padding: '0 30px', color: textColor, fontSize: renderFontSize, fontWeight: '900', fontFamily, lineHeight: 1.3, textShadow: shadowCss, ...widthStyle };
    } else if (textStyle === 'plain') {
        textContentStyle = { textAlign: textAlign as any, padding: '0 30px', color: textColor || 'white', fontSize: renderFontSize, fontWeight: '900', fontFamily, lineHeight: 1.3, ...widthStyle };
    } else {
        textContentStyle = { backgroundColor: 'rgba(0,0,0,0.7)', padding: boxPad, borderRadius: `${boxBorderRadius}px`, textAlign: textAlign as any, color: textColor || 'white', fontSize: renderFontSize, fontWeight: '600', fontFamily, ...widthStyle };
    }

    const shellBorderRadius = textStyle === 'block'
        ? `${blockBorderRadius}px`
        : textStyle === 'box'
            ? `${boxBorderRadius}px`
            : '10px';
    const stripColor = textStyle === 'glow' ? glowColor : blockColor;

    return (
        <AbsoluteFill style={isFreePos ? {} : positionStyle}>
            <div style={{ ...shellTransform, opacity, clipPath, display: 'inline-block', position: isFreePos ? 'absolute' : 'relative', overflow: noWrap ? 'visible' : undefined, width: noWrap ? undefined : `${resolvedMaxWidthPx}px`, textAlign: textAlign as any }}>
                <div style={{ position: 'relative', display: 'inline-block', overflow: (animation === 'wipe' && !noWrap) ? 'hidden' : 'visible', borderRadius: shellBorderRadius }}>
                    {showWipeCover && (
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundColor: stripColor,
                                transform: `translateX(${wipeSweepX}%)`,
                                borderRadius: shellBorderRadius,
                                pointerEvents: 'none',
                                zIndex: 2,
                            }}
                        />
                    )}
                    <div style={{ ...textContentStyle, position: 'relative', zIndex: 1, opacity: animation === 'wipe' ? textRevealOpacity : 1 }}>
                        {String(text ?? '').split('\n').map((line, idx, arr) => (
                            <React.Fragment key={idx}>
                                {renderLine(line, highlightColor, animation === 'reveal' ? revealProgress : undefined)}
                                {idx < arr.length - 1 && <br />}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};
