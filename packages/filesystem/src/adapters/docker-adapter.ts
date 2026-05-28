import { PassThrough, Writable, type Readable } from "node:stream";
import type { Container } from "dockerode";
import Dockerode from "dockerode";
import { posix } from "node:path";
import { extract, pack } from "tar-stream";
import { FileSystemAdapter, type FileStat } from "../adapter";
import { resolvePath } from "../path";
export type DockerFileSystemCreateOptions = {
  /** Container ID or name. */
  container: string;
  /**
   * Directory inside the container that bounds adapter paths (default `/`).
   * Adapter paths are {@link resolvePath} results relative to this root.
   */
  root?: string;
  /** dockerode client (default: `DOCKER_HOST` / local socket). */
  docker?: Dockerode;
};

/**
 * {@link FileSystemAdapter} for a running Docker container.
 * Lists via `find` in the container (BusyBox on Alpine, GNU on Debian); reads/writes use archive APIs.
 */
export class DockerFileSystem extends FileSystemAdapter {
  readonly root: string;

  private constructor(
    private readonly container: Container,
    root: string,
    private readonly useFindPrintf: boolean,
  ) {
    super();
    this.root = root;
  }

  static async create(
    options: DockerFileSystemCreateOptions,
  ): Promise<DockerFileSystem> {
    const docker = options.docker ?? new Dockerode();
    const container = docker.getContainer(options.container);
    await container.inspect();
    const root = normalizeContainerRoot(options.root ?? "/");
    const useFindPrintf = await probeFindPrintf(container, root);
    return new DockerFileSystem(container, root, useFindPrintf);
  }

  createReadStream(path: string): Readable {
    const containerPath = toContainerPath(this.root, path);
    const out = new PassThrough();
    void readContainerFile(this.container, containerPath)
      .then((data) => {
        out.end(data);
      })
      .catch((err) => {
        out.destroy(err instanceof Error ? err : new Error(String(err)));
      });
    return out;
  }

  createWriteStream(path: string): Writable {
    const container = this.container;
    const root = this.root;
    const containerPath = toContainerPath(root, path);
    const relInRoot = posix.relative(root, containerPath);
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
            const body = Buffer.concat(chunks);
            const archive = await packPathTar(relInRoot, body);
            await container.putArchive(archive, {
              path: archiveExtractPath(root),
            });
            callback();
          } catch (err) {
            callback(err instanceof Error ? err : new Error(String(err)));
          }
        })();
      },
    });
  }

  async readDir(path: string): Promise<FileStat[]> {
    const { containerPath, adapterDir } = toContainerPathWithAdapterDir(
      this.root,
      path,
    );
    return listContainerPaths(this.container, this.useFindPrintf, {
      containerPath,
      adapterDir,
      root: this.root,
      maxDepth: 1,
    });
  }

  override async readDirRecursive(path: string): Promise<FileStat[]> {
    const { containerPath, adapterDir } = toContainerPathWithAdapterDir(
      this.root,
      path,
    );
    return listContainerPaths(this.container, this.useFindPrintf, {
      containerPath,
      adapterDir,
      root: this.root,
    });
  }
}

type ListContainerPathsOptions = {
  containerPath: string;
  adapterDir: string;
  root: string;
  /** When set, only immediate children of `containerPath` (for {@link readDir}). */
  maxDepth?: number;
};

async function probeFindPrintf(
  container: Container,
  root: string,
): Promise<boolean> {
  const result = await execInContainer(container, [
    "find",
    root,
    "-maxdepth",
    "0",
    "-printf",
    "",
  ]);
  return result.exitCode === 0;
}

async function listContainerPaths(
  container: Container,
  useFindPrintf: boolean,
  options: ListContainerPathsOptions,
): Promise<FileStat[]> {
  const lines = useFindPrintf
    ? await listWithFindPrintf(container, options)
    : await listWithFindByType(container, options);

  const stats: FileStat[] = [];
  for (const line of lines) {
    const stat = parseFindLine(line, options);
    if (stat) stats.push(stat);
  }
  return stats.sort((a, b) => a.path.localeCompare(b.path));
}

async function listWithFindPrintf(
  container: Container,
  options: ListContainerPathsOptions,
): Promise<string[]> {
  const args = ["find", options.containerPath];
  if (options.maxDepth === 1) {
    args.push("-maxdepth", "1", "-mindepth", "1");
  } else {
    args.push("-mindepth", "1");
  }
  args.push("(", "-type", "f", "-o", "-type", "d", ")", "-printf", "%y\\t%p\\n");

  const result = await execInContainer(container, args);
  if (result.exitCode !== 0) {
    throw findExecError(options.containerPath, result);
  }
  return result.stdout.split("\n").filter((l) => l.length > 0);
}

async function listWithFindByType(
  container: Container,
  options: ListContainerPathsOptions,
): Promise<string[]> {
  const depthArgs =
    options.maxDepth === 1
      ? ["-maxdepth", "1", "-mindepth", "1"]
      : ["-mindepth", "1"];

  const files = await execFindPaths(container, [
    "find",
    options.containerPath,
    ...depthArgs,
    "-type",
    "f",
  ]);
  const dirs = await execFindPaths(container, [
    "find",
    options.containerPath,
    ...depthArgs,
    "-type",
    "d",
  ]);

  const lines: string[] = [];
  for (const p of files) lines.push(`f\t${p}`);
  for (const p of dirs) lines.push(`d\t${p}`);
  return lines;
}

async function execFindPaths(
  container: Container,
  args: string[],
): Promise<string[]> {
  const result = await execInContainer(container, args);
  if (result.exitCode !== 0) {
    throw findExecError(args[1] ?? "", result);
  }
  return result.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function parseFindLine(
  line: string,
  options: ListContainerPathsOptions,
): FileStat | undefined {
  const tab = line.indexOf("\t");
  if (tab < 0) return undefined;
  const typeChar = line.slice(0, tab);
  const containerAbs = line.slice(tab + 1);
  const type: FileStat["type"] = typeChar === "d" ? "dir" : "file";

  if (options.maxDepth === 1) {
    const name = posix.basename(containerAbs);
    return { type, path: dockerAdapterChildPath(options.adapterDir, name) };
  }

  const adapterPath = containerPathToAdapterPath(options.root, containerAbs);
  if (adapterPath === "/") return undefined;
  return { type, path: adapterPath };
}

function findExecError(
  containerPath: string,
  result: ExecResult,
): Error {
  const detail = result.stderr.trim() || result.stdout.trim();
  if (/no such file|not found/i.test(detail)) {
    const err = new Error(`ENOENT: no such directory in container: "${containerPath}"`);
    Object.assign(err, { code: "ENOENT" });
    return err;
  }
  const err = new Error(
    `find failed in container (exit ${result.exitCode}) for "${containerPath}": ${detail}`,
  );
  Object.assign(err, { code: "EIO" });
  return err;
}

type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

async function execInContainer(
  container: Container,
  cmd: string[],
): Promise<ExecResult> {
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({ hijack: true, stdin: false });
  const stdout = new CollectStream();
  const stderr = new CollectStream();
  container.modem.demuxStream(stream, stdout, stderr);

  await new Promise<void>((resolve, reject) => {
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });

  const inspect = await exec.inspect();
  return {
    stdout: stdout.text(),
    stderr: stderr.text(),
    exitCode: inspect.ExitCode ?? 1,
  };
}

class CollectStream extends Writable {
  private readonly chunks: Buffer[] = [];

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding),
    );
    callback();
  }

  text(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

function normalizeContainerRoot(root: string): string {
  const trimmed = root.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function containerPathToAdapterPath(
  root: string,
  containerAbsPath: string,
): string {
  const normRoot = normalizeContainerRoot(root);
  const abs = containerAbsPath.replace(/\/+$/, "") || "/";
  if (abs === normRoot) return "/";
  const rel = posix.relative(normRoot, abs);
  if (rel === ".." || rel.startsWith("../")) {
    throw dockerPathOutsideRootError(abs, normRoot);
  }
  return resolvePath(rel);
}

function toContainerPath(root: string, adapterPath: string): string {
  return toContainerPathWithAdapterDir(root, adapterPath).containerPath;
}

function toContainerPathWithAdapterDir(
  root: string,
  adapterPath: string,
): { containerPath: string; adapterDir: string } {
  const adapterDir = resolvePath(adapterPath);
  const rel = adapterDir === "/" ? "" : adapterDir;
  const containerPath = rel
    ? posix.join(root === "/" ? "" : root, rel).replace(/\\/g, "/")
    : root;
  const normalized = containerPath.startsWith("/")
    ? containerPath
    : `/${containerPath}`;
  assertUnderContainerRoot(root, normalized);
  return { containerPath: normalized, adapterDir };
}

function assertUnderContainerRoot(root: string, target: string): void {
  const normRoot = normalizeContainerRoot(root);
  const normTarget = target.replace(/\/+$/, "") || "/";
  if (normTarget === normRoot) return;
  if (!normTarget.startsWith(`${normRoot}/`)) {
    throw dockerPathOutsideRootError(target, normRoot);
  }
}

function dockerAdapterChildPath(adapterDir: string, name: string): string {
  if (adapterDir === "/") return name;
  return `${adapterDir}/${name}`;
}

function dockerPathOutsideRootError(
  adapterPath: string,
  root: string,
): Error {
  const err = new Error(
    `Path is outside container root "${root}": "${adapterPath}"`,
  );
  Object.assign(err, { code: "EINVAL" });
  return err;
}

async function readContainerFile(
  container: Container,
  filePath: string,
): Promise<Buffer> {
  const archive = await container.getArchive({ path: filePath });
  const file = await readSingleFileFromTar(archive);
  if (!file) {
    const err = new Error(`ENOENT: no such file in container: "${filePath}"`);
    Object.assign(err, { code: "ENOENT" });
    throw err;
  }
  return file;
}

function readSingleFileFromTar(
  archive: NodeJS.ReadableStream,
): Promise<Buffer | undefined> {
  const extractor = extract();
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    archive.on("error", reject);
    extractor.on("error", reject);
    extractor.on("finish", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    extractor.on("entry", (header, stream, next) => {
      if (header.type === "file") {
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      }
      stream.on("end", () => next());
      stream.on("error", reject);
      stream.resume();
    });
    archive.pipe(extractor);
  });
}

function archiveExtractPath(parent: string): string {
  if (parent === "/") return "/";
  return `${parent.replace(/\/+$/, "")}/`;
}

function packPathTar(relativePath: string, body: Buffer): Promise<Buffer> {
  const parts = relativePath.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) {
    return Promise.reject(new Error("Cannot write empty path"));
  }

  const tarball = pack();
  const chunks: Buffer[] = [];
  tarball.on("data", (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  return new Promise((resolve, reject) => {
    tarball.on("error", reject);
    tarball.on("end", () => resolve(Buffer.concat(chunks)));

    const addFile = () => {
      tarball.entry({ name: relativePath, size: body.length }, body, (err) => {
        if (err) reject(err);
        else tarball.finalize();
      });
    };

    const addDir = (index: number) => {
      if (index >= parts.length) {
        addFile();
        return;
      }
      const dirPath = parts.slice(0, index + 1).join("/");
      tarball.entry({ name: dirPath, type: "directory" }, (err) => {
        if (err) reject(err);
        else addDir(index + 1);
      });
    };

    addDir(0);
  });
}
