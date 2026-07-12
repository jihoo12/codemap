#!/usr/bin/env node
/**
 * codemap.js
 *
 * Scans a directory (respecting .gitignore), builds a graph where
 * subdirectories are groups and files are nodes, detects cross-file
 * references (one file mentioning another file's name), and generates
 * a single self-contained HTML file with an interactive diagram.
 *
 * Usage:
 *   node codemap.js [directory] [-o output.html]
 *
 * No external dependencies - only Node.js builtins.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { dir: '.', out: 'codemap.html', maxFileBytes: 300 * 1024, maxFiles: 4000 };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '-o' || a === '--out') {
      args.out = rest[++i];
    } else if (a === '--max-bytes') {
      args.maxFileBytes = parseInt(rest[++i], 10);
    } else if (a === '-h' || a === '--help') {
      args.help = true;
    } else {
      args.dir = a;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// .gitignore handling (minimal, dependency-free glob -> regex)
// ---------------------------------------------------------------------------

// Always-ignored directories, regardless of .gitignore contents.
const ALWAYS_IGNORE = new Set(['.git', 'node_modules']);

function loadGitignoreRules(rootDir) {
  const rules = [];
  const gitignorePath = path.join(rootDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const lines = fs.readFileSync(gitignorePath, 'utf8').split(/\r?\n/);
    for (let raw of lines) {
      let line = raw;
      if (!line.trim()) continue;
      if (line.trim().startsWith('#')) continue;
      let negate = false;
      if (line.startsWith('!')) {
        negate = true;
        line = line.slice(1);
      }
      // Trim trailing unescaped whitespace
      line = line.replace(/\s+$/, '');
      let anchored = false;
      if (line.startsWith('/')) {
        anchored = true;
        line = line.slice(1);
      }
      let dirOnly = false;
      if (line.endsWith('/')) {
        dirOnly = true;
        line = line.slice(0, -1);
      }
      if (!line) continue;
      rules.push({ pattern: line, negate, anchored, dirOnly, regex: globToRegex(line, anchored) });
    }
  }
  return rules;
}

function globToRegex(pattern, anchored) {
  // Convert a gitignore-style glob into a RegExp that matches a
  // relative, forward-slash path.
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        // "**" matches across path segments
        i++;
        if (pattern[i + 1] === '/') {
          re += '(?:.*/)?';
          i++;
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  const prefix = anchored ? '^' : '^(?:.*/)?';
  return new RegExp(prefix + re + '(?:/.*)?$');
}

function isIgnored(relPath, isDir, rules) {
  // relPath uses forward slashes, no leading slash
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) {
      // A dir-only rule can still match a file's ancestor directory;
      // that's handled because we check ignore status top-down during walk.
      continue;
    }
    if (rule.regex.test(relPath)) {
      ignored = !rule.negate;
    }
  }
  return ignored;
}

// ---------------------------------------------------------------------------
// File classification
// ---------------------------------------------------------------------------

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.mov', '.avi', '.wav', '.flac',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.class', '.jar',
  '.pyc', '.o', '.a', '.lock',
]);

function isProbablyBinary(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buf, 0, 512, 0);
    fs.closeSync(fd);
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) return true; // NUL byte -> binary
    }
  } catch (e) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Directory walk
// ---------------------------------------------------------------------------

function walk(rootDir, rules, maxFiles) {
  const nodes = []; // { id, name, relPath, dirPath, ext, size, binary, content, truncated }
  const dirSet = new Set(['']); // relative dir paths, '' = root
  let fileCount = 0;
  let skippedBig = 0;

  function recurse(absDir, relDir) {
    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (e) {
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
          } catch (e) {
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
  return { nodes, dirSet: Array.from(dirSet), skippedBig };
}

// ---------------------------------------------------------------------------
// Reference detection: does file A's content mention file B's name?
// ---------------------------------------------------------------------------

function detectEdges(nodes) {
  const edges = [];
  // Build lookup: basename without ext -> [nodeIds], and full basename -> [nodeIds]
  const byStem = new Map();
  const byFullName = new Map();
  for (const n of nodes) {
    const stem = path.basename(n.name, n.ext);
    if (stem.length < 3) continue; // skip too-short/common stems (e.g. "i", "a")
    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem).push(n.id);
    if (!byFullName.has(n.name)) byFullName.set(n.name, []);
    byFullName.get(n.name).push(n.id);
  }

  // Precompile a word-boundary-ish regex per stem/name (cache).
  function makeRegex(token) {
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(?:^|[^A-Za-z0-9_])' + esc + '(?:[^A-Za-z0-9_]|$)');
  }

  const seenPairs = new Set();

  for (const n of nodes) {
    if (n.binary || !n.content) continue;
    const content = n.content;
    // Search for full filenames first (more specific / fewer false positives)
    for (const [fullName, ids] of byFullName) {
      for (const targetId of ids) {
        if (targetId === n.id) continue;
        if (!content.includes(fullName)) continue;
        if (!makeRegex(fullName).test(content)) continue;
        const key = n.id + '=>' + targetId;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        edges.push({ from: n.id, to: targetId, via: fullName });
      }
    }
    // Then search for stems (e.g. `require('./utils')` mentions "utils")
    for (const [stem, ids] of byStem) {
      for (const targetId of ids) {
        if (targetId === n.id) continue;
        const key = n.id + '=>' + targetId;
        if (seenPairs.has(key)) continue; // already linked via full name
        if (!content.includes(stem)) continue;
        if (!makeRegex(stem).test(content)) continue;
        seenPairs.add(key);
        edges.push({ from: n.id, to: targetId, via: stem });
      }
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node codemap.js [directory] [-o output.html]

Scans a directory (respecting .gitignore) and generates an interactive
HTML diagram: subdirectories are groups, files are nodes, and arrows
show which files reference which other files.

Options:
  -o, --out <file>     Output HTML file (default: codemap.html)
  --max-bytes <n>       Max bytes of file content to embed per file (default 300000)
`);
    return;
  }

  const rootDir = path.resolve(args.dir);
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    console.error(`Error: "${args.dir}" is not a valid directory.`);
    process.exit(1);
  }

  console.log(`Scanning ${rootDir} ...`);
  const rules = loadGitignoreRules(rootDir);
  const { nodes, dirSet } = walk(rootDir, rules, args.maxFiles);

  console.log(`Found ${nodes.length} files in ${dirSet.length} directories (incl. root).`);

  // Truncate large file contents before embedding
  let truncatedCount = 0;
  for (const n of nodes) {
    if (!n.binary && n.content.length > args.maxFileBytes) {
      n.content = n.content.slice(0, args.maxFileBytes) + '\n\n/* ... truncated ... */';
      n.truncated = true;
      truncatedCount++;
    }
  }
  if (truncatedCount) console.log(`Truncated ${truncatedCount} large file(s) for embedding.`);

  console.log('Detecting cross-file references...');
  const edges = detectEdges(nodes);
  console.log(`Found ${edges.length} reference edge(s).`);

  const projectName = path.basename(rootDir);
  const data = {
    projectName,
    generatedAt: new Date().toISOString(),
    dirs: dirSet,
    nodes: nodes.map((n) => ({
      id: n.id,
      name: n.name,
      dir: n.dirPath,
      ext: n.ext,
      size: n.size,
      binary: n.binary,
      truncated: !!n.truncated,
      content: n.binary ? null : n.content,
    })),
    edges,
  };

  const html = renderHtml(data);
  const outPath = path.resolve(args.out);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`\nWrote diagram to ${outPath}`);
}

function renderHtml(data) {
  const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e'); // avoid closing </script> early
  // IMPORTANT: use a replacer function, not a replacer string. String.replace()
  // treats "$" sequences in a *string* replacement specially (e.g. "$`", "$'",
  // "$&"), and real-world file content (prices, shell scripts, regexes) often
  // contains "$" - a plain string replacement would silently corrupt the output.
  return template.replace('/*__CODEMAP_DATA__*/', () => json);
}

main();
