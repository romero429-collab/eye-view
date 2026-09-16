import { Footprints, Globe, Map, Minus, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "@/lib/map-types";
import { cn } from "@/lib/utils";

type ZoomControlsProps = {
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  canReset: boolean;
  hudOpen: boolean;
  onHudOpen: (open: boolean) => void;
};

export function ZoomControls({
  viewMode,
  onViewMode,
  onZoomIn,
  onZoomOut,
  onReset,
  canReset,
  hudOpen,
  onHudOpen,
}: ZoomControlsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-panel)]">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-10 rounded-none"
          onClick={() => onHudOpen(!hudOpen)}
          aria-pressed={hudOpen}
          aria-label={hudOpen ? "Hide menus" : "Show menus"}
          title={hudOpen ? "Hide menus" : "Show menus"}
        >
          {hudOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
        </Button>
      </div>
      <div className="flex overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-panel)]">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            "size-10 rounded-none",
            viewMode === "atlas" && "bg-bg-warm text-fg",
          )}
          onClick={() => onViewMode("atlas")}
          aria-pressed={viewMode === "atlas"}
          aria-label="Atlas view"
          title="Atlas"
        >
          <Map />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            "size-10 rounded-none border-l border-border",
            viewMode === "godsEye" && "bg-bg-warm text-fg",
          )}
          onClick={() => onViewMode("godsEye")}
          aria-pressed={viewMode === "godsEye"}
          aria-label="Kiyoshi's Eye View"
          title="Kiyoshi's Eye View"
        >
          <Globe />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            "size-10 rounded-none border-l border-border",
            viewMode === "walk" && "bg-bg-warm text-fg",
          )}
          onClick={() => onViewMode("walk")}
          aria-pressed={viewMode === "walk"}
          aria-label="Ground walk — drop to street level"
          title="Walk the street"
        >
          <Footprints />
        </Button>
      </div>
      <div className="flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-panel)]">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-10 rounded-none"
          onClick={onZoomIn}
          aria-label="Zoom in"
        >
          <Plus />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-10 rounded-none border-t border-border"
          onClick={onZoomOut}
          aria-label="Zoom out"
        >
          <Minus />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-10 rounded-none border-t border-border"
          onClick={onReset}
          disabled={!canReset}
          aria-label="Reset view"
        >
          <RotateCcw />
        </Button>
      </div>
    </div>
  );
}
