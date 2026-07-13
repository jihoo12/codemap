import { Command } from 'commander';
import type { ScanOptions } from './types.js';

export function parseArgs(argv: string[]): ScanOptions {
  const program = new Command();

  program
    .name('codemap')
    .description('Generate an interactive visual map of your codebase as a single HTML file')
    .version('1.0.0')
    .argument('[directory]', 'Directory to scan', '.')
    .option('-o, --out <file>', 'Output HTML file', 'codemap.html')
    .option('--max-bytes <n>', 'Max bytes of file content to embed per file', '300000')
    .option('--max-files <n>', 'Max number of files to scan', '4000')
    .option('--no-highlight', 'Disable syntax highlighting in output')
    .parse(argv);

  const opts = program.opts();
  const dir = program.args[0] || '.';

  return {
    dir,
    out: opts.out,
    maxFileBytes: parseInt(opts.maxBytes, 10),
    maxFiles: parseInt(opts.maxFiles, 10),
    highlight: opts.highlight,
  };
}
