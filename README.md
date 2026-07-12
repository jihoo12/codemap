# Codemap

A zero-dependency Node.js CLI that scans a project directory and generates
a single interactive HTML file visualizing it as a box-in-box diagram:

- **Subdirectories are group boxes** — drawn as translucent colored
  rectangles with a header bar showing the directory name and file count.
- **Files are small boxes inside their parent group** — colored by file
  type, arranged in a grid with consistent spacing.
- **References are tracked in a side panel** — when you click a file,
  you see what it references and what references it (no arrows on the
  graph, to keep the layout clean).
- **Click a file box** to open a side panel with that file's full content,
  plus lists of outgoing and incoming references.
- Respects your project's `.gitignore` (plus always skips `.git` and
  `node_modules`).
- Everything is embedded in **one self-contained HTML file** — no server,
  no build step, no CDN, no internet required. Just open it in a browser.

## Usage

```bash
node codemap.js [directory] [-o output.html]
```

Examples:

```bash
# Scan the current directory, write codemap.html
node codemap.js .

# Scan a specific project, choose an output filename
node codemap.js ~/projects/my-app -o my-app-map.html
```

Then open the generated HTML file in any browser.

### Options

| Flag | Description |
|---|---|
| `-o, --out <file>` | Output HTML file (default `codemap.html`) |
| `--max-bytes <n>` | Max bytes of a file's content to embed before truncating (default `300000`) |

## Controls in the diagram

- **Drag** the background to pan around the diagram.
- **Scroll / pinch** to zoom in and out.
- The view **auto-fits** to show all content when first opened or after
  expanding/collapsing a group.
- **Click a group header** to expand or collapse it (groups with many
  files start collapsed).
- **Click a file box** to see its content, outgoing references, and
  incoming references in the side panel.
- **Click a reference** in the side panel to jump straight to that file.
- **Type in the filter box** (or press `/`) to dim everything except
  matching files. Press **Enter** to jump to the first match.
- Press **Escape** to close the side panel.

## How reference detection works

This is a lightweight heuristic, not a real parser for every language: for
each file, the tool checks whether its content contains the *filename* or
*filename-without-extension* of any other file in the project, as a whole
word. This naturally picks up most `import`/`require`/`include`/`from`
statements, relative path references, config file mentions, links between
docs, etc. It can occasionally produce a false positive (e.g. a common word
that happens to match another file's name) or miss references that use
unusual syntax — treat the references as a helpful map, not ground truth.

## Files

- `codemap.js` — the CLI: directory walk, `.gitignore` parsing, binary
  detection, reference detection, and HTML generation.
- `template.html` — the HTML/CSS/JS template the data gets embedded into.
  Pure client-side rendering with no external dependencies.

Both files need to stay in the same folder (the script reads
`template.html` next to itself).
