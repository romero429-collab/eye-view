import { Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WalkHudProps = {
  zoneLabel: string;
  onExit: () => void;
  onHold: (code: string, down: boolean) => void;
};

const PAD: Array<{ code: string; label: string; className: string }> = [
  { code: "KeyW", label: "W", className: "col-start-2" },
  { code: "KeyA", label: "A", className: "col-start-1" },
  { code: "KeyS", label: "S", className: "col-start-2" },
  { code: "KeyD", label: "D", className: "col-start-3 row-start-2" },
];

export function WalkHud({ zoneLabel, onExit, onHold }: WalkHudProps) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-3 top-12 flex justify-center md:top-14">
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-1.5 shadow-[var(--shadow-panel)]">
          <Footprints className="size-3.5 shrink-0 text-primary" strokeWidth={1.75} />
          <p className="min-w-0 truncate text-xs font-medium tracking-wide text-fg">
            Ground walk
            <span className="mx-2 text-border-strong">/</span>
            <span className="text-muted">{zoneLabel || "Looking for zone…"}</span>
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onExit}>
            Stand
          </Button>
        </div>
      </div>
      <p className="pointer-events-none absolute bottom-28 left-1/2 hidden -translate-x-1/2 text-xs text-subtle md:block">
        W forward · S back · A left · D right
      </p>
      <div
        className="pointer-events-auto absolute bottom-24 left-1/2 grid -translate-x-1/2 grid-cols-3 grid-rows-2 gap-1 md:hidden"
        aria-label="Walk pad"
      >
        {PAD.map((key) => (
          <button
            key={key.code}
            type="button"
            className={cn(
              "size-11 rounded-[var(--radius-sm)] border border-border bg-surface text-sm font-medium text-fg shadow-[var(--shadow-panel)]",
              key.className,
            )}
            aria-label={`Hold ${key.label}`}
            onPointerDown={(e) => {
              e.preventDefault();
              onHold(key.code, true);
            }}
            onPointerUp={() => onHold(key.code, false)}
            onPointerCancel={() => onHold(key.code, false)}
            onPointerLeave={() => onHold(key.code, false)}
          >
            {key.label}
          </button>
        ))}
      </div>
    </>
  );
}
