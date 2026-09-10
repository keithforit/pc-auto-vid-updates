import React from "react";
import { Composition } from "remotion";
import { Ad, AdTimecode, AD_TOTAL_FRAMES, AD_FPS } from "./Ad";

export const AdStyleRoot: React.FC = () => (
  <>
    <Composition
      id="AdStyle"
      component={Ad}
      durationInFrames={AD_TOTAL_FRAMES}
      fps={AD_FPS}
      width={720}
      height={1280}
    />
    {/* diagnostic only — burns a running timecode over the same timeline */}
    <Composition
      id="AdStyleTimecode"
      component={AdTimecode}
      durationInFrames={AD_TOTAL_FRAMES}
      fps={AD_FPS}
      width={720}
      height={1280}
    />
  </>
);
