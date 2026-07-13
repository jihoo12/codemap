#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { parseArgs } from './cli.js';
import { scanDirectory, truncateContent } from './scanner.js';
import { detectEdges } from './detector.js';
import { highlightNodes, renderHtml } from './renderer.js';
import type { CodeMapData } from './types.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  const rootDir = path.resolve(args.dir);
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    console.error(chalk.red(`Error: "${args.dir}" is not a valid directory.`));
    process.exit(1);
  }

  console.log(chalk.cyan(`Scanning ${rootDir} ...`));

  const { nodes, dirSet } = scanDirectory(rootDir, args.maxFiles);
  console.log(chalk.green(`Found ${nodes.length} files in ${dirSet.length} directories.`));

  const truncatedCount = truncateContent(nodes, args.maxFileBytes);
  if (truncatedCount) {
    console.log(chalk.yellow(`Truncated ${truncatedCount} large file(s) for embedding.`));
  }

  console.log(chalk.cyan('Detecting cross-file references...'));
  const edges = detectEdges(nodes);
  console.log(chalk.green(`Found ${edges.length} reference edge(s).`));

  let highlighted: Map<string, string> = new Map();
  if (args.highlight) {
    console.log(chalk.cyan('Syntax highlighting...'));
    highlighted = await highlightNodes(nodes);
    console.log(chalk.green(`Highlighted ${highlighted.size} files.`));
  }

  const projectName = path.basename(rootDir);
  const data: CodeMapData = {
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

  const html = await renderHtml(data, highlighted);
  const outPath = path.resolve(args.out);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(chalk.green(`\nWrote diagram to ${outPath}`));
}

main().catch((err) => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});
