import { Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EDIT_CLASSES } from "@/lib/zone-memory";

type WalkHudProps = {
  zoneLabel: string;
  learned?: string | null;
  queued?: number;
  immediate?: boolean;
  reclass: string;
  onReclassChange: (id: string) => void;
  onTag: () => void;
  onSplit: () => void;
  onMerge: () => void;
  onReclass: () => void;
  onExit: () => void;
  onHold: (code: string, down: boolean) => void;
  indoors?: boolean;
  interiorNote?: string;
  levels?: string[];
  level?: string;
  onLevel?: (level: string) => void;
  onInside: () => void;
  onStreet: () => void;
  streetNote?: string;
};

const PAD: Array<{ code: string; label: string; className: string }> = [
  { code: "KeyW", label: "W", className: "col-start-2" },
  { code: "KeyA", label: "A", className: "col-start-1" },
  { code: "KeyS", label: "S", className: "col-start-2" },
  { code: "KeyD", label: "D", className: "col-start-3 row-start-2" },
];

export function WalkHud({
  zoneLabel,
  learned,
  queued = 0,
  immediate = false,
  reclass,
  onReclassChange,
  onTag,
  onSplit,
  onMerge,
  onReclass,
  onExit,
  onHold,
  indoors = false,
  interiorNote = "",
  levels = [],
  level = "0",
  onLevel,
  onInside,
  onStreet,
  streetNote = "",
}: WalkHudProps) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-3 top-12 flex justify-center md:top-14">
        <div className="pointer-events-auto flex max-w-full flex-col gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-1.5 shadow-[var(--shadow-panel)]">
          <div className="flex items-center gap-2">
            <Footprints className="size-3.5 shrink-0 text-primary" strokeWidth={1.75} />
            <p className="min-w-0 truncate text-xs font-medium tracking-wide text-fg">
              {indoors ? "Inside" : "Ground walk"}
              <span className="mx-2 text-border-strong">/</span>
              <span className="text-muted">{learned || zoneLabel || "Looking for zone…"}</span>
            </p>
            <Button type="button" size="sm" onClick={onInside}>
              {indoors ? "Out" : "Inside"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onStreet}>
              Facades
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onExit}>
              Stand
            </Button>
          </div>
          {streetNote ? <p className="text-xs leading-snug text-muted">{streetNote}</p> : null}
          {indoors && interiorNote ? (
            <p className="text-xs leading-snug text-muted">{interiorNote}</p>
          ) : null}
          {indoors && levels.length > 1 ? (
            <div className="flex flex-wrap gap-1">
              {levels.map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={item === level ? "default" : "outline"}
                  onClick={() => onLevel?.(item)}
                >
                  Level {item}
                </Button>
              ))}
            </div>
          ) : null}
          {immediate || queued > 0 ? (
            <p className="text-xs leading-snug text-muted">
              {immediate ? "Applied now" : "OSM prior"}
              {queued > 0 ? ` · ${queued} queued next door` : ""}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1">
            <select
              aria-label="Reclass this district"
              value={reclass}
              onChange={(e) => onReclassChange(e.target.value)}
              className="h-8 max-w-[9rem] rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-xs text-fg"
            >
              {EDIT_CLASSES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" onClick={onReclass}>
              Reclass
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onTag}>
              Tag
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onSplit}>
              Split
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onMerge}>
              Merge
            </Button>
          </div>
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
