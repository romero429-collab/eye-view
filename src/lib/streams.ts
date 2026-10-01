/** How a published camera can be played. RTSP never plays in the browser. */

export type FeedKind = "image" | "hls" | "embed" | "whep" | "rtsp";

export type PlayNote = {
  kind: FeedKind;
  browser: boolean;
  note: string;
};

export function isWhep(feed: string, feedType = ""): boolean {
  const type = feedType.toLowerCase();
  if (type === "webrtc" || type === "whep") return true;
  return /\/whep\b/i.test(feed);
}

export function classifyFeed(feed: string, feedType = ""): FeedKind {
  const type = feedType.toLowerCase();
  if (isWhep(feed, type)) return "whep";
  if (type === "rtsp" || feed.startsWith("rtsp://") || feed.startsWith("rtsps://")) return "rtsp";
  if (/youtube\.com|youtu\.be/i.test(feed) || type === "iframe") return "embed";
  if (type === "m3u8" || feed.includes(".m3u8")) return "hls";
  return "image";
}

export function playNote(feed: string, feedType = ""): PlayNote {
  const kind = classifyFeed(feed, feedType);
  if (kind === "whep") {
    return {
      kind,
      browser: true,
      note: "WHEP. POST an SDP offer (application/sdp, recvonly). A 201 answer starts WebRTC. DELETE the session URL to stop.",
    };
  }
  if (kind === "rtsp") {
    return {
      kind,
      browser: false,
      note: "A browser cannot open RTSP. Pull it only if that URL was given to you. MediaMTX can take it as a source and publish WHEP, which Eye View already plays.",
    };
  }
  if (kind === "hls") {
    return {
      kind,
      browser: true,
      note: "HLS playlist. Eye View proxies it when the operator blocks a direct request.",
    };
  }
  if (kind === "embed") {
    return { kind, browser: true, note: "Published page embed, usually YouTube." };
  }
  return { kind: "image", browser: true, note: "Still picture." };
}

/** WHEP draft: the player offers, the server answers with 201 and a Location session. */
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
  if (res.status !== 200 && res.status !== 201) {
    pc.close();
    throw new Error(res.status === 406 ? "whep-counter-offer" : "whep");
  }
  const location = res.headers.get("Location");
  await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
  return () => {
    pc.close();
    if (location) {
      void fetch(`/api/live?kind=cctv-whep&url=${encodeURIComponent(location)}`, { method: "DELETE" });
    }
  };
}
