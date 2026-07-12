# Codemap

A zero-dependency Node.js CLI that scans a project directory and generates
a single interactive HTML file visualizing it as a diagram:

- **Subdirectories are groups** — drawn as translucent colored "blobs" that
  cluster their files together, labeled with the directory path.
- **Files are nodes** — colored by file type, sized roughly by content length.
- **Arrows show references** — if one file's content mentions another file's
  name (e.g. an `import`, `require`, `#include`, a link, a config path, etc.),
  an arrow is drawn from the mentioning file to the mentioned file.
- **Click a node** to open a side panel with that file's full content, plus
  lists of what it references and what references it.
- Respects your project's `.gitignore` (plus always skips `.git` and
  `node_modules`).
- Everything is embedded in **one self-contained HTML file** — no server,
  no build step. Just open it in a browser (it loads D3.js from a CDN for
  the graph rendering, so you'll need internet access when you *view* it).

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

- **Drag** a node to reposition it (the layout re-settles around it).
- **Scroll / pinch** to zoom, **drag background** to pan, "Reset view" button to recenter.
- **Click a node** to see its content, outgoing references, and incoming references.
- **Click a reference** in the side panel to jump straight to that file's node.
- **Type in the filter box** to dim everything except matching files.

## How reference detection works

This is a lightweight heuristic, not a real parser for every language: for
each file, the tool checks whether its content contains the *filename* or
*filename-without-extension* of any other file in the project, as a whole
word. This naturally picks up most `import`/`require`/`include`/`from`
statements, relative path references, config file mentions, links between
docs, etc. It can occasionally produce a false positive (e.g. a common word
that happens to match another file's name) or miss references that use
unusual syntax — treat the arrows as a helpful map, not ground truth.

## Files

- `codemap.js` — the CLI: directory walk, `.gitignore` parsing, binary
  detection, reference detection, and HTML generation.
- `template.html` — the HTML/CSS/D3 template the data gets embedded into.

Both files need to stay in the same folder (the script reads
`template.html` next to itself).

## LICENSE
[LICENSE](LICENSE)
