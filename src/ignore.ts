import fs from 'node:fs';
import path from 'node:path';
import type { IgnoreRule } from './types.js';

const ALWAYS_IGNORE = new Set(['.git', 'node_modules', '.DS_Store', '__pycache__', '.venv', 'venv']);

function globToRegex(pattern: string): RegExp {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
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
  return new RegExp(re);
}

export function loadGitignoreRules(rootDir: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  const gitignorePath = path.join(rootDir, '.gitignore');

  if (!fs.existsSync(gitignorePath)) return rules;

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

    const prefix = anchored ? '^' : '^(?:.*/)?';
    const regex = new RegExp(prefix + globToRegex(line).source + '(?:/.*)?$');

    rules.push({ pattern: line, negate, anchored, dirOnly, regex });
  }

  return rules;
}

export function isIgnored(relPath: string, isDir: boolean, rules: IgnoreRule[]): boolean {
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    if (rule.regex.test(relPath)) {
      ignored = !rule.negate;
    }
  }
  return ignored;
}

export { ALWAYS_IGNORE };
