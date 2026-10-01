import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyFeed, playNote } from "./streams.ts";

describe("streams", () => {
  it("keeps WHEP, HLS, embeds, stills, and RTSP apart", () => {
    assert.equal(classifyFeed("https://cam.example/live/whep", "webrtc"), "whep");
    assert.equal(classifyFeed("https://videos.example/playlist.m3u8", "m3u8"), "hls");
    assert.equal(classifyFeed("https://www.youtube.com/embed/abc123def45"), "embed");
    assert.equal(classifyFeed("https://dot.example/snap.jpg", "image"), "image");
    assert.equal(classifyFeed("rtsp://10.0.0.8/stream", "rtsp"), "rtsp");
  });

  it("refuses to call RTSP a browser feed", () => {
    const note = playNote("rtsps://camera.example/axis-media/media.amp");
    assert.equal(note.browser, false);
    assert.match(note.note, /MediaMTX/);
  });
});
