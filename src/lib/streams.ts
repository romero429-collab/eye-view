/** How a published camera can be played in a browser. RTSP never can. */

export type FeedKind = "image" | "hls" | "embed" | "whep";

export function isWhep(feed: string, feedType = ""): boolean {
  const type = feedType.toLowerCase();
  if (type === "webrtc" || type === "whep") return true;
  return /\/whep\b/i.test(feed);
}

export function classifyFeed(feed: string, feedType = ""): FeedKind {
  if (isWhep(feed, feedType)) return "whep";
  if (/youtube\.com|youtu\.be/i.test(feed) || feedType === "iframe") return "embed";
  if (feedType === "m3u8" || feed.includes(".m3u8")) return "hls";
  return "image";
}

/** WHEP: the browser sends an SDP offer, the camera answers, media arrives as WebRTC. */
export async function playWhep(
  video: HTMLVideoElement,
  endpoint: string,
  signal?: AbortSignal,
): Promise<() => void> {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });
  const media = new MediaStream();
  pc.ontrack = (event) => {
    media.addTrack(event.track);
    video.srcObject = media;
    void video.play().catch(() => {
      /* autoplay can wait for a tap */
    });
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, 1500);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  const res = await fetch(`/api/live?kind=cctv-whep&url=${encodeURIComponent(endpoint)}`, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: pc.localDescription?.sdp ?? "",
    signal,
  });
  if (!res.ok) {
    pc.close();
    throw new Error("whep");
  }
  await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
  return () => pc.close();
}
