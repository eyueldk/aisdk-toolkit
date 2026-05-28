import type { Readable, Writable } from "node:stream";
import { buffer } from "node:stream/consumers";
import { minimatch } from "minimatch";
import { normalizeGlobPattern, resolvePath } from "./path";

export interface GrepOptions {
  pattern: RegExp;
  /** If set, only search files whose path matches this glob (POSIX). */
  pathGlob?: string;
}

export interface GrepMatch {
  path: string;
  line: number;
  text: string;
}

export type FileStatType = "file" | "dir";

export interface FileStat {
  type: FileStatType;
  path: string;
}

export type LsOptions = {
  /** When true, return a flat list of all entries under `path`. Default false: immediate children only. */
  recursive?: boolean;
};

export type FileEncodingOptions = {
  encoding?: "utf8";
};

/**
 * Pluggable filesystem backend for {@link createFileSystemToolkit} and {@link createFileSystemTools}.
 * Implement streams and {@link readDir}; {@link readFile} / {@link writeFile} use those on the base class.
 */
export abstract class FileSystemAdapter {
  abstract createReadStream(path: string): Readable;
  abstract createWriteStream(path: string): Writable;
  /** Lists immediate children of `path` (not recursive). */
  abstract readDir(path: string): Promise<FileStat[]>;

  readFile(path: string): Promise<Buffer>;
  readFile(path: string, options: { encoding: "utf8" }): Promise<string>;
  readFile(
    path: string,
    options?: FileEncodingOptions,
  ): Promise<Buffer | string> {
    return buffer(this.createReadStream(path)).then((data) =>
      options?.encoding === "utf8" ? data.toString("utf8") : data,
    );
  }

  writeFile(path: string, contents: Buffer): Promise<void>;
  writeFile(
    path: string,
    contents: string,
    options?: FileEncodingOptions,
  ): Promise<void>;
  writeFile(
    path: string,
    contents: Buffer | string,
    options?: FileEncodingOptions,
  ): Promise<void> {
    const payload =
      typeof contents === "string"
        ? Buffer.from(contents, options?.encoding ?? "utf8")
        : contents;
    const stream = this.createWriteStream(path);
    return new Promise((resolve, reject) => {
      stream.once("error", reject);
      stream.once("finish", resolve);
      const ok = stream.write(payload, (err) => {
        if (err) reject(err);
      });
      if (ok) {
        stream.end();
      } else {
        stream.once("drain", () => stream.end());
      }
    });
  }

  /**
   * Flat listing of all files and directories under `path`. Default: depth-first walk via {@link readDir};
   * override in a subclass for a native recursive listing.
   */
  async readDirRecursive(path: string): Promise<FileStat[]> {
    const out: FileStat[] = [];
    const visit = async (dir: string): Promise<void> => {
      const entries = await this.readDir(dir);
      for (const entry of entries) {
        out.push(entry);
        if (entry.type === "dir") await visit(entry.path);
      }
    };
    await visit(path);
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Wrapper over {@link readDir} and {@link readDirRecursive}. */
  ls(path: string, options: LsOptions = {}): Promise<FileStat[]> {
    return options.recursive ? this.readDirRecursive(path) : this.readDir(path);
  }

  /** Default: walk with {@link ls} (`recursive: true`), match paths with `minimatch` (`dot: true`). Override in a subclass to customize. */
  async glob(pattern: string): Promise<string[]> {
    const normPattern = normalizeGlobPattern(pattern);
    const files = await this.#collectAllFilePaths();
    return files.filter((p) =>
      minimatch(resolvePath(p), normPattern, { dot: true }),
    );
  }

  /** Default: walk the tree with {@link ls} (`recursive: true`), read files via {@link createReadStream}, optional `pathGlob`, line scan with `pattern`. Override in a subclass to customize. */
  async grep(options: GrepOptions): Promise<GrepMatch[]> {
    const files = await this.#collectAllFilePaths();
    const pathGlob = options.pathGlob
      ? normalizeGlobPattern(options.pathGlob)
      : undefined;
    const filtered = pathGlob
      ? files.filter((f) =>
          minimatch(resolvePath(f), pathGlob, { dot: true }),
        )
      : files;

    const matches: GrepMatch[] = [];
    const re = options.pattern;

    for (const path of filtered) {
      matches.push(
        ...matchGrepLines(
          path,
          await this.readFile(path, { encoding: "utf8" }),
          re,
        ),
      );
    }

    return matches;
  }

  async #collectAllFilePaths(): Promise<string[]> {
    const entries = await this.ls(".", { recursive: true });
    return entries
      .filter((e) => e.type === "file")
      .map((e) => e.path)
      .sort();
  }
}

/** Line scan shared by {@link FileSystemAdapter.grep} and the grep tool. */
export function matchGrepLines(
  path: string,
  utf8: string,
  pattern: RegExp,
): GrepMatch[] {
  const matches: GrepMatch[] = [];
  for (const [i, line] of utf8.split(/\r?\n/).entries()) {
    pattern.lastIndex = 0;
    if (pattern.test(line)) {
      matches.push({ path, line: i + 1, text: line });
    }
  }
  return matches;
}
