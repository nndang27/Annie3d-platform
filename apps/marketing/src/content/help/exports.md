---
title: Export formats
description: What each export preset produces in the demonstration, and how it is labelled.
order: 3
---

| Preset | Produced by | What you get |
| --- | --- | --- |
| PNG snapshot | Your browser | A 1080-pixel still of the current scene with the ad layout composited. Real content. |
| WebM preview clip | Your browser | A recording of the animation from the studio canvas (up to 10 s). Real content, preview quality. |
| Scene + ad JSON | Your browser | Editable scene and composition data for re-import or a connected engine. |
| MP4 render | Simulated render queue | A labelled **sample clip**. In the demonstration this is not a render of your scene. |

Every download has the correct file type and a non-empty body. Exports are stored as versioned artifacts with provenance, so you can download them again from the library.

WebM recording needs the tab to stay visible while it records. Browsers without `MediaRecorder` support cannot produce the WebM preset; PNG and JSON still work.
