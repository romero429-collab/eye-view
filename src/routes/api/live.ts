import { createFileRoute } from "@tanstack/react-router";
import { loadLiveFeed, type LiveKind } from "@/lib/live-server";

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
]);

export const Route = createFileRoute("/api/live")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const kind = url.searchParams.get("kind") as LiveKind | null;
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
    },
  },
});
