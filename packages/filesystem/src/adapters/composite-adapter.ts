import type { Readable, Writable } from "node:stream";
import { FileSystemAdapter, type FileInfo, type FileInfoType } from "./index";
import { resolvePath } from "../path";

export type CompositeFileSystemCreateOptions = {
  /** Virtual mount point → adapter. Keys are POSIX paths (e.g. `/sandbox`, `host`). Mounts must not nest. */
  mounts: Record<string, FileSystemAdapter>;
};

type MountEntry = {
  mountKey: string;
  adapter: FileSystemAdapter;
};

type Route = MountEntry & {
  relativePath: string;
};

/**
 * Unifies multiple {@link FileSystemAdapter} instances under virtual mount points.
 * Use {@link resolvePath}-style paths in the composite tree; longest mount prefix wins for reads and writes.
 */
export class CompositeFileSystem extends FileSystemAdapter {
  private readonly mounts: MountEntry[];
  private readonly rootAdapter: FileSystemAdapter | undefined;

  private constructor(mounts: MountEntry[]) {
    super();
    this.mounts = mounts;
    this.rootAdapter =
      mounts.length === 1 && mounts[0]?.mountKey === "/"
        ? mounts[0].adapter
        : undefined;
  }

  static create(options: CompositeFileSystemCreateOptions): CompositeFileSystem {
    const entries = normalizeMounts(options.mounts);
    assertNonOverlappingMounts(entries);
    return new CompositeFileSystem(entries);
  }

  createReadStream(path: string): Readable {
    const route = this.resolveRoute(path);
    if (!route) {
      throw new Error(`No mount for path: ${resolvePath(path)}`);
    }
    return route.adapter.createReadStream(route.relativePath);
  }

  createWriteStream(path: string): Writable {
    const route = this.resolveRoute(path);
    if (!route) {
      throw new Error(`No mount for path: ${resolvePath(path)}`);
    }
    return route.adapter.createWriteStream(route.relativePath);
  }

  async readDir(path: string): Promise<FileInfo[]> {
    const norm = resolvePath(path);
    const route = this.resolveRoute(norm);
    if (route) {
      const entries = await route.adapter.readDir(route.relativePath);
      return entries.map((entry) => ({
        type: entry.type,
        path: toCompositePath(route.mountKey, entry.path),
      }));
    }
    return listVirtualChildren(norm, this.mounts);
  }

  async remove(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    const route = this.resolveRoute(path);
    if (!route) {
      throw new Error(`No mount for path: ${resolvePath(path)}`);
    }
    await route.adapter.remove(route.relativePath, options);
  }

  async mkdir(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    const route = this.resolveRoute(path);
    if (!route) {
      throw new Error(`No mount for path: ${resolvePath(path)}`);
    }
    await route.adapter.mkdir(route.relativePath, options);
  }

  async move(from: string, to: string): Promise<void> {
    const source = this.resolveRoute(from);
    const destination = this.resolveRoute(to);
    if (!source || !destination) {
      throw new Error(`No mount for move: ${resolvePath(from)} -> ${resolvePath(to)}`);
    }
    if (source.mountKey !== destination.mountKey) {
      throw new Error(
        `Cross-mount move is not supported: ${resolvePath(from)} -> ${resolvePath(to)}`,
      );
    }
    await source.adapter.move(source.relativePath, destination.relativePath);
  }

  private resolveRoute(path: string): Route | null {
    const norm = resolvePath(path);

    if (this.rootAdapter) {
      return {
        mountKey: "/",
        adapter: this.rootAdapter,
        relativePath: norm === "/" ? "." : norm,
      };
    }

    let best: MountEntry | undefined;
    for (const mount of this.mounts) {
      if (mount.mountKey === norm || norm.startsWith(`${mount.mountKey}/`)) {
        if (!best || mount.mountKey.length > best.mountKey.length) {
          best = mount;
        }
      }
    }
    if (!best) {
      return null;
    }
    const relativePath =
      norm === best.mountKey ? "." : norm.slice(best.mountKey.length + 1);
    return { ...best, relativePath };
  }
}

function normalizeMounts(
  mounts: Record<string, FileSystemAdapter>,
): MountEntry[] {
  const entries = Object.entries(mounts).map(([key, adapter]) => ({
    mountKey: normalizeMountKey(key),
    adapter,
  }));
  if (entries.length === 0) {
    throw new Error("CompositeFileSystem requires at least one mount");
  }
  return entries.sort((a, b) => a.mountKey.localeCompare(b.mountKey));
}

function normalizeMountKey(key: string): string {
  return resolvePath(key);
}

function assertNonOverlappingMounts(mounts: MountEntry[]): void {
  for (let i = 0; i < mounts.length; i++) {
    for (let j = i + 1; j < mounts.length; j++) {
      const a = mounts[i]?.mountKey;
      const b = mounts[j]?.mountKey;
      if (!a || !b || a === "/" || b === "/") {
        continue;
      }
      if (a.startsWith(`${b}/`) || b.startsWith(`${a}/`)) {
        throw new Error(`Overlapping composite mounts: "${a}" and "${b}"`);
      }
    }
  }
}

function listVirtualChildren(prefix: string, mounts: MountEntry[]): FileInfo[] {
  const children = new Map<string, FileInfoType>();
  const prefixNorm = prefix === "/" ? "" : prefix;

  for (const { mountKey } of mounts) {
    if (mountKey === "/") {
      continue;
    }
    if (prefixNorm === "") {
      const segment = mountKey.split("/")[0];
      if (segment) {
        children.set(segment, "dir");
      }
      continue;
    }
    if (mountKey === prefixNorm || mountKey.startsWith(`${prefixNorm}/`)) {
      const rest =
        mountKey === prefixNorm ? "" : mountKey.slice(prefixNorm.length + 1);
      const segment = rest.split("/")[0];
      if (segment) {
        children.set(segment, "dir");
      }
    }
  }

  return [...children.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, type]) => ({
      type,
      path: prefixNorm === "" ? name : `${prefixNorm}/${name}`,
    }));
}

function toCompositePath(mountKey: string, adapterPath: string): string {
  if (mountKey === "/") {
    return adapterPath;
  }
  if (adapterPath === "." || adapterPath === "") {
    return mountKey;
  }
  return `${mountKey}/${adapterPath}`;
}
