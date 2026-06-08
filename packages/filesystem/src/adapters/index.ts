import type { Readable, Writable } from "node:stream";
import { buffer } from "node:stream/consumers";
import { minimatch } from "minimatch";
import { normalizeGlobPattern, resolvePath } from "../path";

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

export type FileInfoType = "file" | "dir";

export interface FileInfo {
  type: FileInfoType;
  path: string;
}

export type LsOptions = {
  /** When true, return a flat list of all entries under `path`. Default false: immediate children only. */
  recursive?: boolean;
  /** When true, yield entries via async iteration instead of buffering a full array. */
  stream?: false;
};

export type LsStreamOptions = {
  recursive?: boolean;
  stream: true;
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
  abstract readDir(path: string): Promise<FileInfo[]>;

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
  async readDirRecursive(path: string): Promise<FileInfo[]> {
    const out: FileInfo[] = [];
    for await (const entry of this.readDirRecursiveStream(path)) {
      out.push(entry);
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Yields immediate children of `path`. */
  async *readDirStream(path: string): AsyncIterable<FileInfo> {
    for (const entry of await this.readDir(path)) {
      yield entry;
    }
  }

  /** Yields a flat subtree under `path` (depth-first). Override for native streaming listings. */
  async *readDirRecursiveStream(path: string): AsyncIterable<FileInfo> {
    const visit = async function* (
      adapter: FileSystemAdapter,
      dir: string,
    ): AsyncIterable<FileInfo> {
      for (const entry of await adapter.readDir(dir)) {
        yield entry;
        if (entry.type === "dir") {
          yield* visit(adapter, entry.path);
        }
      }
    };
    yield* visit(this, path);
  }

  /** Wrapper over {@link readDir} / {@link readDirRecursive} or their streaming variants. */
  ls(path: string, options?: LsOptions): Promise<FileInfo[]>;
  ls(path: string, options: LsStreamOptions): AsyncIterable<FileInfo>;
  ls(
    path: string,
    options: LsOptions | LsStreamOptions = {},
  ): Promise<FileInfo[]> | AsyncIterable<FileInfo> {
    if (options.stream) {
      return options.recursive
        ? this.readDirRecursiveStream(path)
        : this.readDirStream(path);
    }
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
    const files: string[] = [];
    const listing = this.ls(".", { recursive: true, stream: true });
    for await (const entry of listing) {
      if (entry.type === "file") {
        files.push(entry.path);
      }
    }
    return files.sort();
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
