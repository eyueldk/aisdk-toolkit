import {
  createReadStream as fsCreateReadStream,
  createWriteStream as fsCreateWriteStream,
  existsSync,
  mkdirSync,
  realpathSync,
  promises as fs,
} from "node:fs";
import type { Readable, Writable } from "node:stream";
import { basename, dirname, relative, resolve, sep } from "pathe";
import { FileSystemAdapter, type FileStat } from "../adapter";
import { resolvePath } from "../path";
export type LocalFileSystemCreateOptions = {
  /** Host directory (absolute or relative). Resolved and created if missing. Adapter paths cannot escape it. */
  root: string;
};

/**
 * Disk-backed {@link FileSystemAdapter} confined to a single {@link LocalFileSystem.root} directory.
 */
export class LocalFileSystem extends FileSystemAdapter {
  readonly root: string;

  private constructor(rootAbs: string) {
    super();
    this.root = rootAbs;
  }

  static async create(
    options: LocalFileSystemCreateOptions,
  ): Promise<LocalFileSystem> {
    const rootAbs = resolve(options.root);
    await fs.mkdir(rootAbs, { recursive: true });
    return new LocalFileSystem(rootAbs);
  }

  createReadStream(path: string): Readable {
    return fsCreateReadStream(toDiskPath(this.root, path));
  }

  createWriteStream(path: string): Writable {
    const disk = toDiskPath(this.root, path);
    const dir = dirname(disk);
    mkdirSync(dir, { recursive: true });
    return fsCreateWriteStream(disk);
  }

  async readDir(path: string): Promise<FileStat[]> {
    const { disk, adapterDir } = toDiskPathWithAdapterDir(this.root, path);
    const entries = await fs.readdir(disk, { withFileTypes: true });
    return entries
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => ({
        type: d.isDirectory() ? ("dir" as const) : ("file" as const),
        path: localAdapterChildPath(adapterDir, d.name),
      }));
  }
}

function toDiskPath(rootAbs: string, adapterPath: string): string {
  return toDiskPathWithAdapterDir(rootAbs, adapterPath).disk;
}

function toDiskPathWithAdapterDir(
  rootAbs: string,
  adapterPath: string,
): { disk: string; adapterDir: string } {
  const adapterDir = resolvePath(adapterPath);
  const rel = adapterDir === "/" ? "." : adapterDir;
  const disk = resolveDiskPathUnderRoot(rootAbs, rel);
  return { disk, adapterDir };
}

/** Resolve symlinks and ensure the result stays under the real root (blocks symlink escapes). */
function resolveDiskPathUnderRoot(rootAbs: string, rel: string): string {
  const rootReal = realpathSync(rootAbs);
  const tentative = resolve(rootReal, rel);

  if (existsSync(tentative)) {
    const real = realpathSync(tentative);
    assertUnderRoot(rootReal, real, rootAbs);
    return real;
  }

  assertRelativeInsideRoot(rootReal, tentative, rootAbs);

  let parent = dirname(tentative);
  const base = basename(tentative);
  while (!existsSync(parent)) {
    const up = dirname(parent);
    if (up === parent) break;
    parent = up;
  }

  if (existsSync(parent)) {
    const parentReal = realpathSync(parent);
    const resolved = resolve(parentReal, base);
    assertUnderRoot(rootReal, resolved, rootAbs);
    return resolved;
  }

  return tentative;
}

function assertRelativeInsideRoot(
  rootReal: string,
  target: string,
  rootLabel: string,
): void {
  const rel = relative(rootReal, target);
  if (rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith("../")) {
    throw localPathOutsideRootError(target, rootLabel);
  }
}

function assertUnderRoot(
  rootReal: string,
  diskPath: string,
  rootLabel: string,
): void {
  const rel = relative(rootReal, diskPath);
  if (rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith("../")) {
    throw localPathOutsideRootError(diskPath, rootLabel);
  }
}

function localAdapterChildPath(adapterDir: string, name: string): string {
  if (adapterDir === "/") return name;
  return `${adapterDir}/${name}`;
}

function localPathOutsideRootError(adapterPath: string, root: string): Error {
  const err = new Error(`Path is outside root "${root}": "${adapterPath}"`);
  Object.assign(err, { code: "EINVAL" });
  return err;
}
