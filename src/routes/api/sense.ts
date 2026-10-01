import { createFileRoute } from "@tanstack/react-router";
import { senseLook } from "@/lib/live-server";

/** Machine door. Kiyoshi reads this. She does not scrape the page. */
export const Route = createFileRoute("/api/sense")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const num = (key: string) => {
          const raw = url.searchParams.get(key);
          if (raw == null || raw === "") return undefined;
          const value = Number(raw);
          return Number.isFinite(value) ? value : undefined;
        };
        const body = await senseLook(num("lat"), num("lng"), url.searchParams.get("name") ?? undefined);
        return Response.json(body);
      },
    },
  },
});
