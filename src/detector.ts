import path from 'node:path';
import type { FileNode, Edge } from './types.js';

export function detectEdges(nodes: FileNode[]): Edge[] {
  const edges: Edge[] = [];

  const byStem = new Map<string, string[]>();
  const byFullName = new Map<string, string[]>();

  for (const n of nodes) {
    const stem = path.basename(n.name, n.ext);
    if (stem.length < 3) continue;

    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem)!.push(n.id);

    if (!byFullName.has(n.name)) byFullName.set(n.name, []);
    byFullName.get(n.name)!.push(n.id);
  }

  const regexCache = new Map<string, RegExp>();

  function makeRegex(token: string): RegExp {
    if (regexCache.has(token)) return regexCache.get(token)!;
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?:^|[^A-Za-z0-9_])' + esc + '(?:[^A-Za-z0-9_]|$)');
    regexCache.set(token, re);
    return re;
  }

  const seenPairs = new Set<string>();

  for (const n of nodes) {
    if (n.binary || !n.content) continue;
    const content = n.content;

    for (const [fullName, ids] of byFullName) {
      for (const targetId of ids) {
        if (targetId === n.id) continue;
        if (!content.includes(fullName)) continue;
        if (!makeRegex(fullName).test(content)) continue;

        const key = `${n.id}=>${targetId}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        edges.push({ from: n.id, to: targetId, via: fullName });
      }
    }

    for (const [stem, ids] of byStem) {
      for (const targetId of ids) {
        if (targetId === n.id) continue;

        const key = `${n.id}=>${targetId}`;
        if (seenPairs.has(key)) continue;
        if (!content.includes(stem)) continue;
        if (!makeRegex(stem).test(content)) continue;

        seenPairs.add(key);
        edges.push({ from: n.id, to: targetId, via: stem });
      }
    }
  }

  return edges;
}
