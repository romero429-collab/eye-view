/** Packed R-tree. A query opens only the boxes that touch the view. */

type Box = { minX: number; minY: number; maxX: number; maxY: number };

type LeafPoint<T> = { x: number; y: number; value: T };

type RNode<T> = Box & {
  leaf: boolean;
  kids: Array<RNode<T>>;
  points?: LeafPoint<T>[];
};

const MAX = 9;

function bounds(items: Box[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    if (item.minX < minX) minX = item.minX;
    if (item.minY < minY) minY = item.minY;
    if (item.maxX > maxX) maxX = item.maxX;
    if (item.maxY > maxY) maxY = item.maxY;
  }
  return { minX, minY, maxX, maxY };
}

function overlaps(a: Box, minX: number, minY: number, maxX: number, maxY: number): boolean {
  return a.maxX >= minX && a.minX <= maxX && a.maxY >= minY && a.minY <= maxY;
}

function pack<T>(nodes: RNode<T>[]): RNode<T> {
  if (nodes.length === 1) return nodes[0]!;
  if (nodes.length <= MAX) {
    return { ...bounds(nodes), leaf: false, kids: nodes };
  }
  const slices = Math.ceil(Math.sqrt(nodes.length / MAX));
  const sliceSize = Math.ceil(nodes.length / slices);
  const byX = [...nodes].sort((a, b) => a.minX - b.minX);
  const parents: RNode<T>[] = [];
  for (let i = 0; i < byX.length; i += sliceSize) {
    const slice = byX.slice(i, i + sliceSize).sort((a, b) => a.minY - b.minY);
    for (let j = 0; j < slice.length; j += MAX) {
      const group = slice.slice(j, j + MAX);
      parents.push({ ...bounds(group), leaf: false, kids: group });
    }
  }
  return pack(parents);
}

export type RTree<T> = {
  search(minX: number, minY: number, maxX: number, maxY: number): T[];
};

export function bulkRTree<T>(points: Array<{ x: number; y: number; value: T }>): RTree<T> {
  const leaves: RNode<T>[] = [];
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  for (let i = 0; i < sorted.length; i += MAX) {
    const group = sorted.slice(i, i + MAX);
    leaves.push({
      ...bounds(group.map((point) => ({ minX: point.x, minY: point.y, maxX: point.x, maxY: point.y }))),
      leaf: true,
      kids: [],
      points: group.map((point) => ({ x: point.x, y: point.y, value: point.value })),
    });
  }
  const root = leaves.length ? pack(leaves) : null;
  return {
    search(minX, minY, maxX, maxY) {
      const found: T[] = [];
      const walk = (node: RNode<T>) => {
        if (!overlaps(node, minX, minY, maxX, maxY)) return;
        if (node.leaf) {
          for (const point of node.points ?? []) {
            if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) found.push(point.value);
          }
          return;
        }
        for (const kid of node.kids) walk(kid);
      };
      if (root) walk(root);
      return found;
    },
  };
}
