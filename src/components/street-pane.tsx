import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cropWindow, type StreetShot } from "@/lib/street";

type StreetPaneProps = {
  shot: StreetShot;
  onStep: (dir: "next" | "prev") => void;
  onClose: () => void;
};

export function StreetPane({ shot, onStep, onClose }: StreetPaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const view = useRef({ yaw: shot.azimuth, pitch: 0 });
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const [miss, setMiss] = useState(false);

  useEffect(() => {
    view.current = { yaw: shot.azimuth, pitch: 0 };
    setMiss(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      paint();
    };
    img.onerror = () => setMiss(true);
    img.src = shot.image;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [shot.id, shot.image, shot.azimuth]);

  function paint() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img?.naturalWidth) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(180, Math.floor(rect.height));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const wide = img.naturalWidth / img.naturalHeight > 1.7;
    if (!wide) {
      ctx.drawImage(img, 0, 0, width, height);
      return;
    }
    const crop = cropWindow(view.current.yaw, view.current.pitch, 80, img.naturalWidth, img.naturalHeight);
    const dest = (sx: number, sw: number, dx: number) => {
      ctx.drawImage(img, sx, crop.y, sw, crop.h, dx, 0, (sw / crop.w) * width, height);
    };
    if (crop.x < 0) {
      const left = crop.w + crop.x;
      dest(img.naturalWidth + crop.x, -crop.x, 0);
      dest(0, left, ((-crop.x) / crop.w) * width);
    } else if (crop.x + crop.w > img.naturalWidth) {
      const first = img.naturalWidth - crop.x;
      dest(crop.x, first, 0);
      dest(0, crop.w - first, (first / crop.w) * width);
    } else {
      dest(crop.x, crop.w, 0);
    }
  }

  return (
    <div className="pointer-events-auto absolute inset-x-3 top-36 bottom-36 z-20 flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-border bg-bg shadow-[var(--shadow-panel)]">
      <canvas
        ref={canvasRef}
        className="min-h-0 w-full flex-1 cursor-grab bg-bg-warm"
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, yaw: view.current.yaw, pitch: view.current.pitch };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          view.current.yaw = start.yaw + (event.clientX - start.x) * 0.18;
          view.current.pitch = Math.max(-30, Math.min(30, start.pitch + (start.y - event.clientY) * 0.12));
          paint();
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-xs text-muted">
          {miss
            ? "Photo did not load."
            : `Drag to look at the facade. ${shot.producer}${shot.when ? ` · ${shot.when}` : ""}`}
        </p>
        <Button type="button" size="sm" variant="outline" disabled={!shot.prevId} onClick={() => onStep("prev")}>
          Back
        </Button>
        <Button type="button" size="sm" disabled={!shot.nextId} onClick={() => onStep("next")}>
          Ahead
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Map
        </Button>
      </div>
    </div>
  );
}
