import { Daytona, DaytonaNotFoundError, type Sandbox } from "@daytonaio/sdk";
import { PassThrough, Writable, type Readable } from "node:stream";
import { posix } from "node:path";
import { FileSystemAdapter, type FileInfo } from "./index";
import { resolvePath } from "../path";

export type DaytonaFileSystemCreateOptions = {
  /** Running Daytona sandbox (from `daytona.create()` or `daytona.get()`). */
  sandbox?: Sandbox;
  /** When `sandbox` is omitted, load by ID or name via {@link Daytona.get}. */
  sandboxId?: string;
  /** Daytona client (default: `new Daytona()` using `DAYTONA_API_KEY`). */
  daytona?: Daytona;
  /**
   * Directory inside the sandbox that bounds adapter paths (default `workspace`).
   * Paths are relative to the sandbox working directory (no leading `/`).
   */
  root?: string;
};

/**
 * {@link FileSystemAdapter} for a Daytona sandbox.
 * Reads/writes use the sandbox filesystem API; listing walks {@link Sandbox.fs.listFiles}.
 */
export class DaytonaFileSystem extends FileSystemAdapter {
  readonly root: string;

  private constructor(
    private readonly sandbox: Sandbox,
    root: string,
  ) {
    super();
    this.root = root;
  }

  static async create(
    options: DaytonaFileSystemCreateOptions,
  ): Promise<DaytonaFileSystem> {
    let sandbox = options.sandbox;
    if (!sandbox) {
      if (!options.sandboxId) {
        throw new Error(
          "DaytonaFileSystem.create requires sandbox or sandboxId",
        );
      }
      const daytona = options.daytona ?? new Daytona();
      sandbox = await daytona.get(options.sandboxId);
    }
    const root = normalizeSandboxRoot(options.root ?? "workspace");
    return new DaytonaFileSystem(sandbox, root);
  }

  createReadStream(path: string): Readable {
    const remotePath = toSandboxPath(this.root, path);
    const out = new PassThrough();
    void this.sandbox.fs
      .downloadFileStream(remotePath)
      .then((stream) => {
        stream.on("error", (err) => out.destroy(err));
        stream.pipe(out);
      })
      .catch((err) => {
        out.destroy(mapDaytonaFsError(err, remotePath));
      });
    return out;
  }

  createWriteStream(path: string): Writable {
    const sandbox = this.sandbox;
    const remotePath = toSandboxPath(this.root, path);
    const chunks: Buffer[] = [];

    return new Writable({
      write(chunk, encoding, callback) {
        chunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding),
        );
        callback();
      },
      final: (callback) => {
        void (async () => {
          try {
            await ensureParentDirs(sandbox, remotePath);
            const body = Buffer.concat(chunks);
            await sandbox.fs.uploadFile(body, remotePath);
            callback();
          } catch (err) {
            callback(mapDaytonaFsError(err, remotePath));
          }
        })();
      },
    });
  }

  async readDir(path: string): Promise<FileInfo[]> {
    const { sandboxPath, adapterDir } = toSandboxPathWithAdapterDir(
      this.root,
      path,
    );
    const entries = await this.sandbox.fs.listFiles(sandboxPath);
    const stats: FileInfo[] = entries.map((entry) => ({
      type: entry.isDir ? "dir" : "file",
      path: daytonaAdapterChildPath(adapterDir, entry.name),
    }));
    return stats.sort((a, b) => a.path.localeCompare(b.path));
  }

  override async readDirRecursive(path: string): Promise<FileInfo[]> {
    const { sandboxPath, adapterDir } = toSandboxPathWithAdapterDir(
      this.root,
      path,
    );
    const stats = await listSandboxSubtree(
      this.sandbox,
      sandboxPath,
      adapterDir,
    );
    return stats.sort((a, b) => a.path.localeCompare(b.path));
  }
}

async function listSandboxSubtree(
  sandbox: Sandbox,
  sandboxPath: string,
  adapterDir: string,
): Promise<FileInfo[]> {
  let entries: Awaited<ReturnType<Sandbox["fs"]["listFiles"]>>;
  try {
    entries = await sandbox.fs.listFiles(sandboxPath);
  } catch (err) {
    throw mapDaytonaFsError(err, sandboxPath);
  }

  const stats: FileInfo[] = [];
  for (const entry of entries) {
    const childAdapter = daytonaAdapterChildPath(adapterDir, entry.name);
    const childSandbox = posix.join(sandboxPath, entry.name);
    if (entry.isDir) {
      stats.push({ type: "dir", path: childAdapter });
      stats.push(
        ...(await listSandboxSubtree(sandbox, childSandbox, childAdapter)),
      );
    } else {
      stats.push({ type: "file", path: childAdapter });
    }
  }
  return stats;
}

async function ensureParentDirs(
  sandbox: Sandbox,
  remoteFilePath: string,
): Promise<void> {
  const parent = posix.dirname(remoteFilePath);
  if (parent === "." || parent === "") return;
  const parts = parent.split("/").filter(Boolean);
  let path = "";
  for (const part of parts) {
    path = path ? `${path}/${part}` : part;
    try {
      await sandbox.fs.createFolder(path, "755");
    } catch {
      // Parent may already exist.
    }
  }
}

function normalizeSandboxRoot(root: string): string {
  const trimmed = root.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed || "workspace";
}

function toSandboxPath(root: string, adapterPath: string): string {
  return toSandboxPathWithAdapterDir(root, adapterPath).sandboxPath;
}

function toSandboxPathWithAdapterDir(
  root: string,
  adapterPath: string,
): { sandboxPath: string; adapterDir: string } {
  const normRoot = normalizeSandboxRoot(root);
  const adapterDir = resolvePath(adapterPath);
  const rel = adapterDir === "/" ? "" : adapterDir;
  const sandboxPath = rel ? posix.join(normRoot, rel) : normRoot;
  assertUnderSandboxRoot(normRoot, sandboxPath);
  return { sandboxPath, adapterDir };
}

function assertUnderSandboxRoot(root: string, target: string): void {
  const normTarget = target.replace(/\/+$/, "") || root;
  if (normTarget === root) return;
  if (!normTarget.startsWith(`${root}/`)) {
    throw daytonaPathOutsideRootError(target, root);
  }
}

function daytonaAdapterChildPath(adapterDir: string, name: string): string {
  if (adapterDir === "/") return name;
  return `${adapterDir}/${name}`;
}

function daytonaPathOutsideRootError(
  adapterPath: string,
  root: string,
): Error {
  const err = new Error(
    `Path is outside sandbox root "${root}": "${adapterPath}"`,
  );
  Object.assign(err, { code: "EINVAL" });
  return err;
}

function mapDaytonaFsError(err: unknown, remotePath: string): Error {
  if (err instanceof DaytonaNotFoundError) {
    const enoent = new Error(
      `ENOENT: no such file or directory in sandbox: "${remotePath}"`,
    );
    Object.assign(enoent, { code: "ENOENT" });
    return enoent;
  }
  return err instanceof Error ? err : new Error(String(err));
}
