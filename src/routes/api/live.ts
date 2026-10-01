import { createFileRoute } from "@tanstack/react-router";
import { allowedCctvStill, loadLiveFeed, nmCameraStill, proxyCameraStream, proxyWhep, type LiveKind } from "@/lib/live-server";

const KINDS = new Set<LiveKind>([
  "transit",
  "flights",
  "alerts",
  "events",
  "wildlife",
  "livestock",
  "plants",
  "health",
  "osm",
  "plots",
  "zoning",
  "lookup",
  "geocode",
  "iot",
  "ground",
  "bugs",
  "indoor",
  "street",
  "weather",
  "power",
  "cctv",
]);

export const Route = createFileRoute("/api/live")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const asked = url.searchParams.get("kind");
        if (asked === "cctv-still") {
          const name = url.searchParams.get("name") ?? "";
          const feed = url.searchParams.get("url") ?? "";
          const still = name ? await nmCameraStill(name) : await allowedCctvStill(feed);
          if (!still) return new Response(null, { status: 404 });
          return new Response(still.buffer as ArrayBuffer, {
            headers: {
              "content-type": "image/jpeg",
              "cache-control": "public, max-age=20",
            },
          });
        }
        if (asked === "cctv-hls") {
          const feed = url.searchParams.get("url") ?? "";
          const stream = await proxyCameraStream(feed);
          if (!stream) return new Response(null, { status: 404 });
          return new Response(stream.body.buffer as ArrayBuffer, {
            headers: {
              "content-type": stream.type,
              "cache-control": "no-store",
            },
          });
        }
        const kind = asked as LiveKind | null;
        if (!kind || !KINDS.has(kind)) {
          return Response.json({ error: "Unknown live feed" }, { status: 400 });
        }
        const num = (key: string) => {
          const raw = url.searchParams.get(key);
          if (raw == null || raw === "") return undefined;
          const value = Number(raw);
          return Number.isFinite(value) ? value : undefined;
        };
        const collection = await loadLiveFeed({
          kind,
          west: num("west"),
          south: num("south"),
          east: num("east"),
          north: num("north"),
          zoom: num("zoom"),
          lat: num("lat"),
          lng: num("lng"),
          name: url.searchParams.get("name") ?? undefined,
        });
        return Response.json({
          ...collection,
          updatedAt: Date.now(),
          count: collection.features.length,
        });
      },
      POST: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("kind") !== "cctv-whep") {
          return Response.json({ error: "Unknown live feed" }, { status: 400 });
        }
        const answered = await proxyWhep(url.searchParams.get("url") ?? "", await request.text());
        if (!answered) return new Response(null, { status: 404 });
        return new Response(answered.body, {
          status: answered.status,
          headers: { "content-type": "application/sdp" },
        });
      },
    },
  },
});
