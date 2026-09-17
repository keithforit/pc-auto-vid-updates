import React from 'react';
import { AbsoluteFill, Sequence, Audio, staticFile, useVideoConfig, useCurrentFrame, interpolate, Easing } from 'remotion';
import segments from './Content.json';
import videoSettings from './VideoSettings.json';
import { Caption } from './Caption';
import { Background } from './Background';
import { OverlayImage } from './OverlayImage';
import { OverlayShape } from './OverlayShape';
import { OverlayVideo } from './OverlayVideo';

const bgProps = (s: any) => ({
    src: s.background_url ?? '',
    videoDurationInSeconds: s.video_duration,
    backgroundType: s.background_type,
    backgroundColor: s.background_color,
    gradientStart: s.gradient_start,
    gradientEnd: s.gradient_end,
    gradientDirection: s.gradient_direction,
    backgroundScale: s.backgroundScale,
    backgroundX: s.backgroundX,
    backgroundY: s.backgroundY,
    kenBurns: s.kenBurns !== false,
    videoSpeed: s.videoSpeed,
    overlayType: s.overlayType,
    overlayOpacity: s.overlayOpacity,
    spotlightRadius: s.spotlightRadius,
    spotlightSoftness: s.spotlightSoftness,
    backgroundBlur: s.backgroundBlur,
    backgroundBrightness: s.backgroundBrightness,
    backgroundContrast: s.backgroundContrast,
    videoAudioVolume: s.videoAudioVolume,
    videoFit: s.videoFit,
    clipStart: s.clipStart,
    clipEnd: s.clipEnd,
});

const SceneAnimationLayer: React.FC<{
    animation?: string;
    fadeInDurationSec?: number;
    fadeOutDurationSec?: number;
    totalDurationInFrames: number;
    children: React.ReactNode;
}> = ({ animation = 'static', fadeInDurationSec = 1.5, fadeOutDurationSec = 1.5, totalDurationInFrames, children }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const mode = animation === 'fade' ? 'fade-in' : animation;
    const fadeInFrames = Math.max(1, Math.min(totalDurationInFrames, Math.round(fadeInDurationSec * fps)));
    const fadeOutFrames = Math.max(1, Math.min(totalDurationInFrames, Math.round(fadeOutDurationSec * fps)));
    const fadeIn = interpolate(frame, [0, fadeInFrames], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    });
    const fadeOutStart = Math.max(0, totalDurationInFrames - fadeOutFrames);
    const fadeOut = interpolate(frame, [fadeOutStart, totalDurationInFrames], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.in(Easing.cubic),
    });

    let opacity = 1;

    switch (mode) {
        case 'fade-in':
            opacity = fadeIn;
            break;
        case 'fade-out':
            opacity = fadeOut;
            break;
        case 'fade-both':
            opacity = fadeIn * fadeOut;
            break;
        default:
            opacity = 1;
    }

    return (
        <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>
            {children}
        </AbsoluteFill>
    );
};

// Flash-montage of previous scene backgrounds
const Montage: React.FC<{ previousSegments: any[]; totalDurationInFrames: number }> = ({
    previousSegments,
    totalDurationInFrames,
}) => {
    const { fps } = useVideoConfig();
    const clipDuration = Math.floor(0.5 * fps);

    return (
        <AbsoluteFill>
            {previousSegments.map((s, i) => {
                const start = i * clipDuration;
                const isLastClip = i === previousSegments.length - 1;
                const duration = isLastClip
                    ? Math.max(clipDuration, totalDurationInFrames - start)
                    : clipDuration;

                return (
                    <Sequence key={`montage-${i}`} from={start} durationInFrames={duration}>
                        <Background {...bgProps(s)} sequenceDurationInFrames={duration} />
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};

export const Main: React.FC = () => {
    let currentFrame = 0;
    const { fps } = useVideoConfig();
    const settings: any = videoSettings || {};
    // Built-in pool for "random" background music (files live in public/music/). Replaces the old
    // src/MusicList.json import — edit this array to change which tracks random mode can pick.
    const defaultMusicList = [
        'adventures-by-a-himitsu.mp3',
        'bgmusic.mp3',
        'i-like-you-by-sakura-girl.mp3',
        'island-by-mbb.mp3',
        'last-summer-by-ikson.mp3',
        'life-of-riley-by-kevin-macleod.mp3',
        'velvet-sky-by-declan-dp.mp3',
    ];
    const selectedMusicFile = settings.backgroundMusicUseCustom && settings.backgroundMusicCustomFile
        ? settings.backgroundMusicCustomFile
        : settings.backgroundMusicRandom === false
            ? settings.backgroundMusicFile
            : (defaultMusicList.length > 0 ? defaultMusicList[Math.floor(Math.random() * defaultMusicList.length)] : null);
    const bgMusic = selectedMusicFile ? staticFile(`music/${selectedMusicFile}`) : null;
    const bgMusicBaseVolume = 0.12;
    let runningBgmFrame = 0;
    const bgMusicRanges = segments.map((segment) => {
        const durationFrames = Math.round(segment.duration * fps);
        const startFrame = runningBgmFrame;
        runningBgmFrame += durationFrames;
        const sceneBgmEnabled = (segment as any).backgroundMusicEnabled !== false;
        const sceneBgmVolume = Math.max(0, Math.min(100, Number((segment as any).backgroundMusicVolume ?? 100))) / 100;
        return {
            startFrame,
            endFrame: runningBgmFrame,
            volume: sceneBgmEnabled ? sceneBgmVolume : 0,
        };
    });
    const totalDurationFrames = Math.max(1, runningBgmFrame);

    // ── Music ducking: music keeps its level under the voice and lifts where nobody is speaking.
    // Speech spans come from the server's voice analysis (voiceActivity); a scene that hasn't been
    // analysed counts as speaking for its whole voice, which is exactly the old constant level.
    const duckingOn = settings.musicDucking !== false;
    const MUSIC_LIFT = Math.pow(10, 8 / 20);   // +8 dB between phrases
    const LIFT_MIN_GAP = 1.2;                   // shorter pauses stay ducked, so the music doesn't pump
    const DUCK_ATTACK = 0.3;                    // seconds to settle back under the next phrase
    const DUCK_RELEASE = 0.6;                   // seconds to rise after speech stops
    const speechSpans: [number, number][] = (() => {
        const spans: [number, number][] = [];
        let offset = 0;
        for (const seg of segments as any[]) {
            const dur = Number(seg.duration) || 0;
            if (seg.audioFile && seg.audioFile !== 'null') {
                const own: [number, number][] = Array.isArray(seg.voiceActivity)
                    ? seg.voiceActivity
                    : [[0, Number(seg.audioDuration) || dur]];
                for (const [s, e] of own) {
                    const start = offset + Math.max(0, s);
                    const end = offset + Math.min(dur, e);
                    if (end > start) spans.push([start, end]);
                }
            } else if ((seg.background_type === 'video' && Number(seg.videoAudioVolume ?? 0) > 0)
                || (seg.overlayVideos ?? []).some((v: any) => Number(v?.volume ?? 0) > 0)) {
                // A clip playing its own sound (e.g. a cut-up recording) is treated as speech
                // throughout, so the music never rises over it.
                spans.push([offset, offset + dur]);
            }
            offset += Math.round(dur * fps) / fps;
        }
        spans.sort((a, b) => a[0] - b[0]);
        const merged: [number, number][] = [];
        for (const sp of spans) {
            const last = merged[merged.length - 1];
            if (last && sp[0] - last[1] < LIFT_MIN_GAP) last[1] = Math.max(last[1], sp[1]);
            else merged.push([sp[0], sp[1]]);
        }
        return merged;
    })();
    const musicLiftAt = (t: number) => {
        let near = 0; // 1 = under speech, 0 = well clear of it
        for (const [s, e] of speechSpans) {
            if (t >= s && t <= e) { near = 1; break; }
            if (t < s) { near = Math.max(near, 1 - (s - t) / DUCK_ATTACK); break; }
            near = Math.max(near, 1 - (t - e) / DUCK_RELEASE);
        }
        near = Math.max(0, Math.min(1, near));
        const eased = near * near * (3 - 2 * near);
        return MUSIC_LIFT + (1 - MUSIC_LIFT) * eased;
    };

    // ── Voice levels: bring every scene's voice to one shared loudness, never past -1 dBTP.
    // Gain alone can't lift a peaky scene as far as a smooth one, so the shared target is the
    // loudest level every scene can reach — otherwise evening out would leave scenes further apart.
    // It never drops below VOICE_FLOOR_LUFS; a scene that can't reach even that just stays at its max.
    const VOICE_TARGET_LUFS = -16;
    const VOICE_FLOOR_LUFS = -20;
    const VOICE_CEILING_DBTP = -1;
    const hasLoudness = (seg: any) => seg.audioFile && seg.audioFile !== 'null'
        && seg.voiceLoudness && Number.isFinite(seg.voiceLoudness.i) && Number.isFinite(seg.voiceLoudness.tp);
    const sharedVoiceTarget = (segments as any[]).filter(hasLoudness).reduce(
        (t, seg) => Math.min(t, seg.voiceLoudness.i + (VOICE_CEILING_DBTP - seg.voiceLoudness.tp)),
        VOICE_TARGET_LUFS,
    );
    const voiceTarget = Math.max(VOICE_FLOOR_LUFS, sharedVoiceTarget);
    const voiceGainFor = (seg: any) => {
        if (settings.voiceNormalize === false || !hasLoudness(seg)) return 1;
        const l = seg.voiceLoudness;
        const db = Math.max(-12, Math.min(12, voiceTarget - l.i, VOICE_CEILING_DBTP - l.tp));
        return Math.pow(10, db / 20);
    };

    const getBackgroundMusicVolumeForFrame = (frame: number) => {
        const sceneRange = bgMusicRanges.find((range) => frame >= range.startFrame && frame < range.endFrame);
        const sceneVolume = sceneRange ? sceneRange.volume : 1;
        const fadeOutStart = Math.max(0, totalDurationFrames - 30);
        const fadeOutEnd = Math.max(fadeOutStart + 1, totalDurationFrames - 5);
        const fadeOutMultiplier = interpolate(frame, [fadeOutStart, fadeOutEnd], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
        const lift = duckingOn ? musicLiftAt(frame / fps) : 1;
        return bgMusicBaseVolume * sceneVolume * fadeOutMultiplier * lift;
    };

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {bgMusic && <Audio src={bgMusic} volume={(frame) => getBackgroundMusicVolumeForFrame(frame)} loop />}

            {segments.map((segment, i) => {
                const durationFrames = Math.round(segment.duration * fps);
                const startFrame = currentFrame;
                currentFrame += durationFrames;

                const isLast = i === segments.length - 1;

                return (
                    <Sequence key={`seq-${i}`} name={`Scene ${i + 1}`} from={startFrame} durationInFrames={durationFrames}>
                        {/* Scene-level fade animation wraps only background, audio, and captions */}
                        {/* ── Determine effective background, honouring "use overlay video as blurred BG" ── */}
                        {(() => {
                            const overlayVids: any[] = (segment as any).overlayVideos ?? [];
                            const blurBgVid = overlayVids.find((v: any) => v?.useAsBlurredBg && v?.src);
                            const effectiveBgProps = blurBgVid
                                ? {
                                    ...bgProps(segment),
                                    src: blurBgVid.src,
                                    backgroundType: 'video',
                                    videoDurationInSeconds: blurBgVid.videoDurationInSeconds ?? null,
                                    backgroundBlur: 80,
                                    videoAudioVolume: 0,
                                    videoFit: 'cover',
                                }
                                : bgProps(segment);

                            return (
                                <SceneAnimationLayer
                                    animation={(segment as any).sceneAnimation || 'static'}
                                    fadeInDurationSec={(segment as any).sceneFadeInDuration ?? 1}
                                    fadeOutDurationSec={(segment as any).sceneFadeOutDuration ?? 1}
                                    totalDurationInFrames={durationFrames}
                                >
                                    {isLast && segments.slice(1, -1).length > 0 && !blurBgVid && !(segment as any).background_url && (segment as any).background_type !== 'color' && (segment as any).background_type !== 'gradient' ? (
                                        <Montage
                                            previousSegments={segments.slice(1, -1)}
                                            totalDurationInFrames={durationFrames}
                                        />
                                    ) : (
                                        <Background
                                            {...effectiveBgProps}
                                            sequenceDurationInFrames={durationFrames}
                                        />
                                    )}

                            {(segment as any).audioFile && (segment as any).audioFile !== 'null' && (
                                <Audio src={staticFile(`voiceovers/${(segment as any).audioFile}`)} volume={voiceGainFor(segment)} />
                            )}
                            {(() => {
                                const sfx = (segment as any).soundEffect;
                                if (!sfx?.file) return null;
                                const sfxStartFrames = Math.max(0, Math.round((sfx.startAt || 0) * fps));
                                const sfxEndFrames = sfx.endAt != null ? Math.min(durationFrames, Math.round(sfx.endAt * fps)) : durationFrames;
                                const sfxDuration = Math.max(1, sfxEndFrames - sfxStartFrames);
                                const sfxVolume = Math.max(0, Math.min(1, Number(sfx.volume ?? 1)));
                                return (
                                    <Sequence from={sfxStartFrames} durationInFrames={sfxDuration}>
                                        <Audio src={staticFile(`sfx/${sfx.file}`)} volume={sfxVolume} />
                                    </Sequence>
                                );
                            })()}
                            {(() => {
                                const extras: any[] = (segment as any).extraTexts ?? [];
                                const mainText = String(segment.text ?? '');
                                const hasMainText = mainText.trim().length > 0;
                                const firstStartSec = extras
                                    .map((et: any) => et.startAt)
                                    .filter((s: any) => s != null && s > 0)
                                    .sort((a: number, b: number) => a - b)[0];
                                const explicitMainStartSec = (segment as any).mainTextStartAt;
                                const explicitMainEndSec = (segment as any).mainTextEndAt;
                                const mainStartAt = explicitMainStartSec != null
                                    ? Math.max(0, Math.round(Number(explicitMainStartSec) * fps))
                                    : undefined;
                                const mainHideAt = explicitMainEndSec != null
                                    ? Math.max(0, Math.round(Number(explicitMainEndSec) * fps))
                                    : (firstStartSec != null
                                        ? Math.round(firstStartSec * fps)
                                        : undefined);
                                return (<>
                                    {hasMainText && (
                                        <Caption
                                            text={mainText}
                                            textStyle={(segment as any).mainTextStyleOverride || (segment as any).textStyle}
                                            animation={(segment as any).textAnimation || 'pop'}
                                            glowColor={(segment as any).glowColorOverride ?? (segment as any).glowColor}
                                            glowSize={(segment as any).glowSizeOverride ?? (segment as any).glowSize}
                                            font={(segment as any).font}
                                            position={(segment as any).textPosition}
                                            textHPosition={(segment as any).textHPosition || 'center'}
                                            textAlign={(segment as any).textAlign || 'center'}
                                            blockColor={(segment as any).blockColorOverride ?? (segment as any).blockColor}
                                            textColor={(segment as any).textColorOverride ?? (segment as any).textColor}
                                            textStrokeColor={(segment as any).textStrokeColorOverride ?? (segment as any).textStrokeColor ?? settings.textStrokeColor ?? '#000000'}
                                            textStrokeSize={(segment as any).textStrokeSizeOverride || (segment as any).textStrokeSize || settings.textStrokeSize || 0}
                                            boxBorderRadius={(segment as any).boxBorderRadius ?? settings.boxBorderRadius ?? 20}
                                            blockBorderRadius={(segment as any).blockBorderRadius ?? settings.blockBorderRadius ?? 10}
                                            totalDurationInFrames={durationFrames}
                                            textX={(segment as any).textX}
                                            textY={(segment as any).textY}
                                            rotation={(segment as any).rotation}
                                            fontSize={(segment as any).fontSize}
                                            glowTextColor={(segment as any).glowTextColorOverride}
                                            startAtFrame={mainStartAt}
                                            hideAtFrame={mainHideAt}
                                            fadeInDurationSec={(segment as any).textFadeInDuration ?? 1.5}
                                            fadeOutDurationSec={(segment as any).textFadeOutDuration ?? 1.5}
                                            noWrap={(segment as any).textNoWrap !== false}
                                            autoFit={(segment as any).autoFit !== false}
                                            textBoxWidth={(segment as any).textBoxWidth ?? undefined}
                                            textPadding={(segment as any).textPadding ?? undefined}
                                            highlightColor={(segment as any).highlightColorOverride ?? (segment as any).highlightColor}
                                            shadowOffset={(segment as any).shadowOffsetOverride ?? (segment as any).shadowOffset}
                                            shadowBlur={(segment as any).shadowBlurOverride ?? (segment as any).shadowBlur}
                                            shadowOpacity={(segment as any).shadowOpacityOverride ?? (segment as any).shadowOpacity}
                                        />
                                    )}
                                    {extras.map((et: any, j: number) => {
                                        const etStartFrame = et.startAt != null ? Math.max(0, Math.round(et.startAt * fps)) : 0;
                                        const etEndFrame = et.endAt != null ? Math.min(durationFrames, Math.round(et.endAt * fps)) : durationFrames;
                                        const etDuration = Math.max(1, etEndFrame - etStartFrame);
                                        return (
                                            <Sequence key={`et-seq-${i}-${j}`} from={etStartFrame} durationInFrames={etDuration}>
                                                <Caption
                                                    key={`et-${i}-${j}`}
                                                    text={et.text}
                                                    textStyle={et.textStyle || (segment as any).textStyle}
                                                    animation={et.animation || 'pop'}
                                                    font={et.font ?? (segment as any).font}
                                                    position={et.position}
                                                    textHPosition={(et as any).textHPosition || 'center'}
                                                    textAlign={et.textAlign || 'center'}
                                                    totalDurationInFrames={etDuration}
                                                    textX={et.textX}
                                                    textY={et.textY}
                                                    rotation={et.rotation}
                                                    fontSize={et.fontSize}
                                                    fadeInDurationSec={et.fadeInDuration ?? (segment as any).textFadeInDuration ?? 1.5}
                                                    fadeOutDurationSec={et.fadeOutDuration ?? (segment as any).textFadeOutDuration ?? 1.5}
                                                    noWrap={et.noWrap !== false}
                                                    autoFit={(et.autoFit ?? (segment as any).autoFit) !== false}
                                                    textBoxWidth={et.textBoxWidth ?? (segment as any).textBoxWidth ?? undefined}
                                                    textPadding={et.textPadding ?? (segment as any).textPadding ?? undefined}
                                                    blockColor={et.blockColorOverride ?? (segment as any).blockColorOverride ?? (segment as any).blockColor ?? '#ffdd00'}
                                                    textColor={et.textColorOverride ?? (segment as any).textColorOverride ?? (segment as any).textColor ?? '#000000'}
                                                    glowColor={et.glowColorOverride ?? (segment as any).glowColorOverride ?? (segment as any).glowColor ?? '#00ffff'}
                                                    glowTextColor={et.glowTextColorOverride ?? (segment as any).glowTextColorOverride ?? (segment as any).glowTextColor ?? '#ffffff'}
                                                    textStrokeColor={et.textStrokeColorOverride ?? (segment as any).textStrokeColorOverride ?? (segment as any).textStrokeColor ?? '#000000'}
                                                    textStrokeSize={et.textStrokeSizeOverride ?? (segment as any).textStrokeSizeOverride ?? (segment as any).textStrokeSize ?? 0}
                                                    glowSize={et.glowSizeOverride ?? (segment as any).glowSizeOverride ?? (segment as any).glowSize ?? 14}
                                                    boxBorderRadius={et.boxBorderRadius ?? (segment as any).boxBorderRadius ?? 20}
                                                    blockBorderRadius={et.blockBorderRadius ?? (segment as any).blockBorderRadius ?? 10}
                                                    highlightColor={et.highlightColor ?? (segment as any).highlightColorOverride ?? (segment as any).highlightColor}
                                                    shadowOffset={et.shadowOffsetOverride ?? et.shadowOffset ?? (segment as any).shadowOffsetOverride ?? (segment as any).shadowOffset}
                                                    shadowBlur={et.shadowBlurOverride ?? et.shadowBlur ?? (segment as any).shadowBlurOverride ?? (segment as any).shadowBlur}
                                                    shadowOpacity={et.shadowOpacityOverride ?? et.shadowOpacity ?? (segment as any).shadowOpacityOverride ?? (segment as any).shadowOpacity}
                                                />
                                            </Sequence>
                                        );
                                    })}
                                </>);
                            })()}
                                </SceneAnimationLayer>
                            );
                        })()}

                        {/* Overlay videos rendered outside SceneAnimationLayer (same reason as overlay images) */}
                        {((segment as any).overlayVideos ?? [])
                            .filter((ov: any) => ov?.src)
                            .map((ov: any, j: number) => (
                                <OverlayVideo
                                    key={`ovvid-${i}-${j}`}
                                    src={ov.src}
                                    x={ov.x ?? 50}
                                    y={ov.y ?? 50}
                                    size={ov.size ?? 80}
                                    aspectRatio={ov.aspectRatio}
                                    rotation={ov.rotation ?? 0}
                                    borderRadius={ov.borderRadius ?? 0}
                                    zOrder={ov.zOrder ?? 20}
                                    volume={ov.volume ?? 0}
                                    playbackRate={ov.playbackRate ?? 1}
                                    videoDurationInSeconds={ov.videoDurationInSeconds ?? null}
                                    sequenceDurationInFrames={durationFrames}
                                />
                            ))}

                        {/* Overlays rendered OUTSIDE SceneAnimationLayer so their own opacity
                            animations are not affected by the scene-level stacking context.
                            This fixes the bug where fade/animation only showed in preview
                            but not in the exported video. */}
                        {(((segment as any).overlayImages?.length ? (segment as any).overlayImages : ((segment as any).overlayImage?.src ? [(segment as any).overlayImage] : [])) as any[])
                            .filter((overlay: any) => overlay?.src)
                            .map((overlay: any, j: number) => {
                                const overlayStartFrames = Math.max(0, Math.round((overlay.startAt || 0) * fps));
                                const overlayEndFrames = overlay.endAt != null ? Math.min(durationFrames, Math.round(overlay.endAt * fps)) : durationFrames;
                                const overlayDuration = Math.max(1, overlayEndFrames - overlayStartFrames);
                                return (
                                    <Sequence key={`overlay-seq-${i}-${j}`} from={overlayStartFrames} durationInFrames={overlayDuration}>
                                        <OverlayImage
                                            key={`overlay-${i}-${j}`}
                                            src={overlay.src}
                                            vPos={overlay.vPos}
                                            hPos={overlay.hPos}
                                            x={overlay.x}
                                            y={overlay.y}
                                            size={overlay.size}
                                            zOrder={overlay.zOrder ?? 15}
                                            cropEnabled={!!overlay.cropEnabled}
                                            cropScale={overlay.cropScale ?? 1}
                                            cropX={overlay.cropX ?? 50}
                                            cropY={overlay.cropY ?? 50}
                                            aspectRatio={overlay.aspectRatio ?? 1}
                                            rotation={overlay.rotation ?? 0}
                                            borderRadius={overlay.borderRadius ?? 0}
                                            animation={overlay.animation ?? 'fade-both'}
                                            totalDurationInFrames={overlayDuration}
                                            fadeInDurationSec={overlay.fadeInDuration ?? 1.5}
                                            fadeOutDurationSec={overlay.fadeOutDuration ?? 1.5}
                                            faderDurationSec={overlay.faderDuration ?? 1}
                                        />
                                    </Sequence>
                                );
                            })}
                        {((segment as any).overlayShapes ?? []).map((shape: any, k: number) => {
                            const shapeStartFrames = Math.max(0, Math.round((shape.startAt || 0) * fps));
                            const shapeEndFrames = shape.endAt != null ? Math.min(durationFrames, Math.round(shape.endAt * fps)) : durationFrames;
                            const shapeDuration = Math.max(1, shapeEndFrames - shapeStartFrames);
                            return (
                            <Sequence key={`shape-seq-${i}-${k}`} from={shapeStartFrames} durationInFrames={shapeDuration}>
                                <OverlayShape
                                    key={`shape-${i}-${k}`}
                                    type={shape.type}
                                    animation={shape.animation || 'pop'}
                                    color={shape.color}
                                    x={shape.x}
                                    y={shape.y}
                                    width={shape.width}
                                    height={shape.height}
                                    rotation={shape.rotation}
                                    opacity={shape.opacity}
                                    zOrder={shape.zOrder}
                                    totalDurationInFrames={shapeDuration}
                                    fadeInDurationSec={shape.fadeInDuration ?? 1.5}
                                    fadeOutDurationSec={shape.fadeOutDuration ?? 1.5}
                                    borderRadius={shape.borderRadius ?? 0}
                                />
                            </Sequence>
                        );})}

                        {/* Voice captions: the narration in short phrases, each timed to the voice
                            (cues are built server-side before render). Each holds until the next. */}
                        {(() => {
                            const seg = segment as any;
                            const captionsOn = seg.voiceCaptions === true || (seg.voiceCaptions !== false && settings.voiceCaptions === true);
                            const cues: any[] = Array.isArray(seg.captionCues) ? seg.captionCues : [];
                            const hasVoice = seg.audioFile && seg.audioFile !== 'null';
                            if (!captionsOn || !cues.length || !(hasVoice || seg.captionCuesSource === 'subtitles')) return null;
                            const style = settings.voiceCaptionStyle || 'outline';
                            return (
                                <AbsoluteFill style={{ zIndex: 50 }}>
                                    {cues.map((cue: any, k: number) => {
                                        const from = Math.max(0, Math.round(Number(cue.start) * fps));
                                        // holds to the next cue, or to its own end when it has one (subtitle gaps stay empty)
                                        const next = cues[k + 1];
                                        let to = next ? Math.min(durationFrames, Math.round(Number(next.start) * fps)) : durationFrames;
                                        if (cue.end != null && Number.isFinite(Number(cue.end))) to = Math.min(to, Math.round(Number(cue.end) * fps));
                                        if (to <= from) return null;
                                        return (
                                            <Sequence key={`cap-${i}-${k}`} from={from} durationInFrames={to - from}>
                                                <Caption
                                                    text={cue.text}
                                                    textStyle={style}
                                                    animation="static"
                                                    font={seg.font}
                                                    textX={50}
                                                    textY={settings.voiceCaptionY ?? 80}
                                                    fontSize={settings.voiceCaptionSize ?? 64}
                                                    textColor={style === 'block' ? '#000000' : '#ffffff'}
                                                    blockColor="#ffdd00"
                                                    textStrokeColor="#000000"
                                                    noWrap
                                                    autoFit
                                                    totalDurationInFrames={to - from}
                                                />
                                            </Sequence>
                                        );
                                    })}
                                </AbsoluteFill>
                            );
                        })()}
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};
