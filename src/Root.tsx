import { Composition } from 'remotion';
import { Main } from "./Main";
import segments from "./Content.json";
import videoSettings from "./VideoSettings.json";

export const RemotionRoot: React.FC = () => {
  const fps = 30;
  const totalDuration = Math.max(
    1,
    Math.ceil(segments.reduce((acc, s) => acc + (s.duration || 0), 0) * fps)
  );
  const settings: any = videoSettings || {};
  const width = Number(settings.outputWidth) || (settings.videoSizePreset === '16:9' ? 1920 : 1080);
  const height = Number(settings.outputHeight) || (settings.videoSizePreset === '1:1' ? 1080 : settings.videoSizePreset === '16:9' ? 1080 : 1920);

  return (
    <Composition
      id="1" 
      component={Main}
      durationInFrames={totalDuration}
      fps={fps}
      width={width}
      height={height}
    />
  );
};
