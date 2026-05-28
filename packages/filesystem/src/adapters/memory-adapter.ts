import type { Readable, Writable } from "node:stream";
import { memfs, type IFs } from "memfs";
import { dirname } from "pathe";
import { FileSystemAdapter, type FileStat } from "../adapter";
import { resolvePath } from "../path";
export type MemoryFileSystemCreateOptions = {
  /** Optional path → UTF-8 contents map (POSIX-style keys, relative to `/`). */
  initialFiles?: Record<string, string>;
};

/**
 * Volatile in-memory {@link FileSystemAdapter} backed by [memfs](https://github.com/streamich/memfs).
 * Adapter paths use {@link resolvePath} (virtual root `/`); memfs uses absolute paths under `/`.
 */
export class MemoryFileSystem extends FileSystemAdapter {
  private constructor(private readonly fs: IFs) {
    super();
  }

  static async create(
    options: MemoryFileSystemCreateOptions = {},
  ): Promise<MemoryFileSystem> {
    const json: Record<string, string> = {};
    for (const [key, contents] of Object.entries(options.initialFiles ?? {})) {
      json[toMemfsPath(resolvePath(key))] = contents;
    }
    const { fs } = memfs(json);
    return new MemoryFileSystem(fs);
  }

  createReadStream(path: string): Readable {
    return this.fs.createReadStream(toMemfsPath(path));
  }

  createWriteStream(path: string): Writable {
    const p = toMemfsPath(path);
    const dir = dirname(p);
    if (dir !== "/") {
      this.fs.mkdirSync(dir, { recursive: true });
    }
    return this.fs.createWriteStream(p);
  }

  async readDir(path: string): Promise<FileStat[]> {
    const base = toMemfsPath(path);
    const adapterDir = resolvePath(path);
    const entries = await this.fs.promises.readdir(base, { withFileTypes: true });
    const dirents: MemfsDirent[] = [];
    for (const entry of entries) {
      if (isMemfsDirent(entry)) dirents.push(entry);
    }
    return dirents
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => ({
        type: d.isDirectory() ? ("dir" as const) : ("file" as const),
        path: memoryAdapterChildPath(adapterDir, d.name),
      }));
  }
}

type MemfsDirent = { name: string; isDirectory(): boolean };

function isMemfsDirent(entry: unknown): entry is MemfsDirent {
  if (typeof entry !== "object" || entry === null) return false;
  const name = Reflect.get(entry, "name");
  const isDirectory = Reflect.get(entry, "isDirectory");
  return typeof name === "string" && typeof isDirectory === "function";
}

function toMemfsPath(path: string): string {
  const resolved = resolvePath(path);
  return resolved === "/" ? "/" : `/${resolved}`;
}

function memoryAdapterChildPath(adapterDir: string, name: string): string {
  if (adapterDir === "/") return name;
  return `${adapterDir}/${name}`;
}
