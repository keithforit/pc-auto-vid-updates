import { AbsoluteFill, staticFile, useVideoConfig, Series } from "remotion";
import { Caption } from "./Caption";
import { Background } from "./Background";
import { BackgroundMusic } from "./BackgroundMusic";
import { FollowCTA } from "./FollowCTA";
import { ProgressBar } from "./ProgressBar"; // 🛠️ Added this
import { Audio } from "@remotion/media";
import segments from "./Content.json";

export const MyComposition: React.FC<{
  bgMusic: string;
}> = ({ bgMusic }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <BackgroundMusic src={bgMusic} />
      <ProgressBar />

      <Series>
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;

          return (
            <Series.Sequence
              key={i}
              durationInFrames={Math.ceil(seg.duration * fps)}
            >
              <Background key={seg.background_query} query={seg.background_query} />
              <Audio src={staticFile(`voiceovers/segment_${i}.mp3`)} />
              <Caption text={seg.text} />
              {isLast && <FollowCTA />}
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};