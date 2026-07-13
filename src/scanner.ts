import fs from 'node:fs';
import path from 'node:path';
import { loadGitignoreRules, isIgnored, ALWAYS_IGNORE } from './ignore.js';
import type { FileNode, WalkResult, ScanOptions } from './types.js';

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.mov', '.avi', '.wav', '.flac',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.class', '.jar',
  '.pyc', '.o', '.a', '.lock', '.sqlite', '.db',
]);

function isProbablyBinary(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;

  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buf, 0, 512, 0);
    fs.closeSync(fd);
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) return true;
    }
  } catch {
    return true;
  }

  return false;
}

export function scanDirectory(rootDir: string, maxFiles: number): WalkResult {
  const rules = loadGitignoreRules(rootDir);
  const nodes: FileNode[] = [];
  const dirSet = new Set<string>(['']);
  let fileCount = 0;

  function recurse(absDir: string, relDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (ALWAYS_IGNORE.has(entry.name)) continue;

      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      const absPath = path.join(absDir, entry.name);
      const entryIsDir = entry.isDirectory();

      if (isIgnored(relPath, entryIsDir, rules)) continue;

      if (entryIsDir) {
        dirSet.add(relPath);
        recurse(absPath, relPath);
      } else if (entry.isFile()) {
        if (fileCount >= maxFiles) continue;
        fileCount++;

        dirSet.add(relDir);
        const stat = fs.statSync(absPath);
        const binary = isProbablyBinary(absPath);
        let content = '';
        let truncated = false;

        if (!binary) {
          try {
            content = fs.readFileSync(absPath, 'utf8');
          } catch {
            content = '';
          }
        }

        nodes.push({
          id: relPath,
          name: entry.name,
          dirPath: relDir,
          ext: path.extname(entry.name),
          size: stat.size,
          binary,
          content,
        });
      }
    }
  }

  recurse(rootDir, '');
  return { nodes, dirSet: Array.from(dirSet) };
}

export function truncateContent(nodes: FileNode[], maxBytes: number): number {
  let truncatedCount = 0;
  for (const n of nodes) {
    if (!n.binary && n.content.length > maxBytes) {
      n.content = n.content.slice(0, maxBytes) + '\n\n/* ... truncated ... */';
      n.truncated = true;
      truncatedCount++;
    }
  }
  return truncatedCount;
}
