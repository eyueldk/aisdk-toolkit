import type { ISandbox } from "@cloudflare/sandbox";
import { PassThrough, type Readable, Writable } from "node:stream";
import { posix } from "node:path";
import { FileSystemAdapter, type FileInfo } from "./index";
import { resolvePath } from "../path";

export type CloudflareSandboxFileSystemCreateOptions = {
  /** Cloudflare Sandbox instance (from `getSandbox(env.Sandbox, id)`). */
  sandbox: ISandbox;
  /**
   * Directory inside the sandbox that bounds adapter paths (default `/workspace`).
   * Sandbox file APIs use absolute paths under this root.
   */
  root?: string;
};

/**
 * {@link FileSystemAdapter} for a [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/).
 */
export class CloudflareSandboxFileSystem extends FileSystemAdapter {
  readonly root: string;

  private constructor(
    private readonly sandbox: ISandbox,
    root: string,
  ) {
    super();
    this.root = root;
  }

  static async create(
    options: CloudflareSandboxFileSystemCreateOptions,
  ): Promise<CloudflareSandboxFileSystem> {
    const root = normalizeSandboxRoot(options.root ?? "/workspace");
    return new CloudflareSandboxFileSystem(options.sandbox, root);
  }

  createReadStream(path: string): Readable {
    const remotePath = toSandboxPath(this.root, path);
    const out = new PassThrough();
    void readSandboxFile(this.sandbox, remotePath)
      .then((data) => {
        out.end(data);
      })
      .catch((err) => {
        out.destroy(err instanceof Error ? err : new Error(String(err)));
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
            await sandbox.writeFile(remotePath, body.toString("base64"), {
              encoding: "base64",
            });
            callback();
          } catch (err) {
            callback(err instanceof Error ? err : new Error(String(err)));
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
    const listing = await this.sandbox.listFiles(sandboxPath);
    const stats: FileInfo[] = [];
    for (const entry of listing.files) {
      if (!isImmediateChild(entry.relativePath)) {
        continue;
      }
      const type = entry.type === "directory" ? "dir" : "file";
      if (entry.type === "other") {
        continue;
      }
      stats.push({
        type,
        path: sandboxAdapterChildPath(adapterDir, entry.name),
      });
    }
    return stats.sort((a, b) => a.path.localeCompare(b.path));
  }

  override async readDirRecursive(path: string): Promise<FileInfo[]> {
    const { sandboxPath, adapterDir } = toSandboxPathWithAdapterDir(
      this.root,
      path,
    );
    const listing = await this.sandbox.listFiles(sandboxPath, {
      recursive: true,
    });
    const stats: FileInfo[] = [];
    for (const entry of listing.files) {
      if (entry.type === "other") {
        continue;
      }
      const type = entry.type === "directory" ? "dir" : "file";
      const rel = entry.relativePath.replace(/^\.\//, "");
      stats.push({
        type,
        path: sandboxAdapterChildPath(adapterDir, rel),
      });
    }
    return stats.sort((a, b) => a.path.localeCompare(b.path));
  }
}

async function readSandboxFile(
  sandbox: ISandbox,
  remotePath: string,
): Promise<Buffer> {
  try {
    const file = await sandbox.readFile(remotePath, { encoding: "none" });
    const chunks: Uint8Array[] = [];
    const reader = file.content.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks);
  } catch {
    const file = await sandbox.readFile(remotePath, { encoding: "utf-8" });
    return Buffer.from(file.content, "utf8");
  }
}

async function ensureParentDirs(
  sandbox: ISandbox,
  remoteFilePath: string,
): Promise<void> {
  const parent = posix.dirname(remoteFilePath);
  if (parent === "/" || parent === ".") {
    return;
  }
  const exists = await sandbox.exists(parent);
  if (!exists.exists) {
    await sandbox.mkdir(parent, { recursive: true });
  }
}

function normalizeSandboxRoot(root: string): string {
  const trimmed = root.trim() || "/workspace";
  if (!trimmed.startsWith("/")) {
    return posix.join("/workspace", trimmed.replace(/^\/+/, ""));
  }
  const normalized = posix.normalize(trimmed);
  return normalized.replace(/\/+$/, "") || "/";
}

function toSandboxPath(root: string, adapterPath: string): string {
  return toSandboxPathWithAdapterDir(root, adapterPath).sandboxPath;
}

function toSandboxPathWithAdapterDir(
  root: string,
  adapterPath: string,
): { sandboxPath: string; adapterDir: string } {
  const adapterDir = resolvePath(adapterPath);
  const rel = adapterDir === "/" ? "" : adapterDir;
  const sandboxPath = rel ? posix.join(root, rel) : root;
  assertUnderSandboxRoot(root, sandboxPath);
  return { sandboxPath, adapterDir };
}

function assertUnderSandboxRoot(root: string, target: string): void {
  const normTarget = target.replace(/\/+$/, "") || root;
  if (normTarget === root) {
    return;
  }
  if (!normTarget.startsWith(`${root}/`)) {
    const err = new Error(
      `Path is outside sandbox root "${root}": "${target}"`,
    );
    Object.assign(err, { code: "EINVAL" });
    throw err;
  }
}

function sandboxAdapterChildPath(adapterDir: string, name: string): string {
  if (adapterDir === "/") {
    return name.replace(/^\/+/, "");
  }
  const child = name.replace(/^\/+/, "");
  return child ? `${adapterDir}/${child}` : adapterDir;
}

function isImmediateChild(relativePath: string): boolean {
  const normalized = relativePath.replace(/^\.\//, "").replace(/\/+$/, "");
  return normalized.length > 0 && !normalized.includes("/");
}
