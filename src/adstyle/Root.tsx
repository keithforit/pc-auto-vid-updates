import React from "react";
import { Composition } from "remotion";
import { Ad, AdTimecode, AD_TOTAL_FRAMES, AD_FPS } from "./Ad";
import { Ad2, AD2_TOTAL_FRAMES, AD2_FPS } from "./Ad2";
import { Ad3, AD3_TOTAL_FRAMES, AD3_FPS } from "./Ad3";

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
    <Composition
      id="AdStyle2"
      component={Ad2}
      durationInFrames={AD2_TOTAL_FRAMES}
      fps={AD2_FPS}
      width={720}
      height={1280}
    />
    <Composition
      id="AdStyle3"
      component={Ad3}
      durationInFrames={AD3_TOTAL_FRAMES}
      fps={AD3_FPS}
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
