import { GitBranch } from "lucide-react";
import type { RuleHit } from "@/lib/zoning-rules";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const EFFECT_LABEL: Record<RuleHit["effect"], string> = {
  container: "Container",
  avoid: "Avoid",
  snap: "Snap",
  dim: "Dim",
  prefer: "Prefer",
};

type HierarchyPanelProps = {
  hits: RuleHit[];
  zoneLabel?: string;
  onDropIn?: () => void;
  onWalk?: () => void;
  onConfirm?: (patchId: string) => void;
  onDismiss?: (patchId: string) => void;
};

export function HierarchyPanel({
  hits,
  zoneLabel,
  onDropIn,
  onWalk,
  onConfirm,
  onDismiss,
}: HierarchyPanelProps) {
  if (hits.length === 0) return null;
  const needScale = hits.some((hit) => hit.id === "need-scale");
  const shownLabel = needScale ? undefined : zoneLabel;
  return (
    <div className="max-w-[min(100%,18rem)] rounded-[var(--radius-md)] border border-border bg-surface p-2 shadow-[var(--shadow-panel)] md:max-w-56">
      <p className="flex items-center gap-1.5 px-1.5 pt-0.5 pb-1 text-xs font-medium uppercase tracking-label text-subtle">
        <GitBranch className="size-3" strokeWidth={1.75} />
        Zoning coordinates
      </p>
      {shownLabel ? (
        <p className="px-1.5 pb-1.5 font-mono text-xs text-muted">{shownLabel}</p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {hits.map((hit) => (
          <li
            key={hit.id}
            className={cn(
              "rounded-[var(--radius-xs)] px-2 py-1.5",
              hit.effect === "avoid" ? "bg-bg-warm" : "",
            )}
          >
            <p className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium leading-snug text-fg">{hit.title}</span>
              <span className="shrink-0 text-[0.65rem] font-medium uppercase tracking-label text-subtle">
                {EFFECT_LABEL[hit.effect]}
              </span>
            </p>
            <p className="mt-0.5 text-xs leading-snug text-muted">{hit.detail}</p>
            {hit.id.startsWith("learn-") && hit.patchId && (onConfirm || onDismiss) ? (
              <div className="mt-1.5 flex gap-1">
                {onConfirm ? (
                  <Button type="button" size="sm" onClick={() => onConfirm(hit.patchId!)}>
                    Confirm
                  </Button>
                ) : null}
                {onDismiss ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => onDismiss(hit.patchId!)}>
                    Dismiss
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {needScale && (onDropIn || onWalk) ? (
        <div className="flex flex-col gap-1 px-1.5 pt-2 pb-0.5">
          {onDropIn ? (
            <Button type="button" size="sm" className="w-full" onClick={onDropIn}>
              Drop into Albuquerque
            </Button>
          ) : null}
          {onWalk ? (
            <Button type="button" size="sm" variant="outline" className="w-full" onClick={onWalk}>
              Walk the street
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
