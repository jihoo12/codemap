export interface FileNode {
  id: string;
  name: string;
  dirPath: string;
  ext: string;
  size: number;
  binary: boolean;
  content: string;
  truncated?: boolean;
}

export interface Edge {
  from: string;
  to: string;
  via: string;
}

export interface IgnoreRule {
  pattern: string;
  negate: boolean;
  anchored: boolean;
  dirOnly: boolean;
  regex: RegExp;
}

export interface WalkResult {
  nodes: FileNode[];
  dirSet: string[];
}

export interface ScanOptions {
  dir: string;
  out: string;
  maxFileBytes: number;
  maxFiles: number;
  highlight: boolean;
}

export interface CodeMapData {
  projectName: string;
  generatedAt: string;
  dirs: string[];
  nodes: Array<{
    id: string;
    name: string;
    dir: string;
    ext: string;
    size: number;
    binary: boolean;
    truncated: boolean;
    content: string | null;
    highlighted?: string | null;
  }>;
  edges: Edge[];
}
