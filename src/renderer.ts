import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHighlighter, bundledLanguages } from 'shiki';
import type { CodeMapData, FileNode } from './types.js';

const EXT_TO_LANG: Record<string, string> = {
  '.js': 'javascript', '.jsx': 'javascriptreact', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescriptreact', '.mts': 'typescript', '.cts': 'typescript',
  '.py': 'python', '.pyw': 'python',
  '.json': 'json', '.jsonc': 'json', '.json5': 'json',
  '.md': 'markdown', '.mdx': 'markdown',
  '.html': 'html', '.htm': 'html', '.vue': 'html', '.svelte': 'html',
  '.css': 'css', '.scss': 'scss', '.less': 'css',
  '.java': 'java', '.kt': 'kotlin', '.kts': 'kotlin',
  '.go': 'go',
  '.rb': 'ruby', '.erb': 'erb',
  '.php': 'php',
  '.c': 'c', '.h': 'c',
  '.cpp': 'cpp', '.cxx': 'cpp', '.cc': 'cpp', '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rs': 'rust',
  '.swift': 'swift',
  '.scala': 'scala',
  '.r': 'r',
  '.lua': 'lua',
  '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash', '.fish': 'bash',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml', '.svg': 'xml',
  '.sql': 'sql',
  '.graphql': 'graphql', '.gql': 'graphql',
  '.dart': 'dart',
  '.zig': 'zig',
  '.hs': 'haskell',
};

const BUNDLED_SET = new Set(Object.keys(bundledLanguages));

function guessLanguage(ext: string, filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile') return 'makefile';

  const candidate = EXT_TO_LANG[ext];
  if (candidate && BUNDLED_SET.has(candidate)) return candidate;
  return null;
}

export async function highlightNodes(nodes: FileNode[]): Promise<Map<string, string>> {
  const highlighted = new Map<string, string>();

  const langSet = new Set<string>();
  for (const n of nodes) {
    if (n.binary || !n.content) continue;
    const lang = guessLanguage(n.ext, n.name);
    if (lang) langSet.add(lang);
  }

  if (langSet.size === 0) return highlighted;

  const highlighter = await createHighlighter({
    themes: ['github-dark-default'],
    langs: Array.from(langSet),
  });

  for (const n of nodes) {
    if (n.binary || !n.content) continue;
    const lang = guessLanguage(n.ext, n.name);
    try {
      const html = lang
        ? highlighter.codeToHtml(n.content, { lang, theme: 'github-dark-default' })
        : '';
      highlighted.set(n.id, html);
    } catch {
      highlighted.set(n.id, '');
    }
  }

  await highlighter.dispose();
  return highlighted;
}

function getDirname(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

export async function renderHtml(data: CodeMapData, highlighted: Map<string, string>): Promise<string> {
  const dir = getDirname();
  const templatePath = path.join(dir, '..', 'template', 'template.html');
  const template = fs.readFileSync(templatePath, 'utf8');

  for (const node of data.nodes) {
    if (highlighted.has(node.id)) {
      node.highlighted = highlighted.get(node.id);
    }
  }

  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');

  return template.replace('/*__CODEMAP_DATA__*/', () => json);
}
