import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { globSync } from "glob";
import path from "path";

const start = async () => {
    console.log("Locating videos...");
    const videos = globSync("public/*.mp4").map((f) => path.basename(f));

    if (videos.length === 0) {
        throw new Error("No MP4 files found in public directory");
    }

    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    console.log(`Selected random background: ${randomVideo}`);

    const bundleLocation = await bundle({
        entryPoint: path.resolve("./src/index.ts"),
        webpackOverride: (config) => config,
    });

    const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "MyComp",
        inputProps: {
            videoSrc: randomVideo,
        },
    });

    await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: `out-${randomVideo}`,
        inputProps: {
            videoSrc: randomVideo,
        },
    });

    console.log("Render done!");
};

start();
