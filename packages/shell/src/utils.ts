import type { Readable, Writable } from "node:stream";
import { Writable as WritableStream } from "node:stream";

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function mergeEnvLayers(
  ...layers: (Record<string, string> | undefined)[]
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const layer of layers) {
    if (layer) {
      Object.assign(merged, layer);
    }
  }
  return merged;
}

export function toDockerEnvList(env: Record<string, string>): string[] {
  return Object.entries(env).map(([key, value]) => `${key}=${value}`);
}

export function toBuffer(chunk: Buffer | string): Buffer {
  return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
}

export function writeChunk(
  sink: Writable | undefined,
  chunks: Buffer[],
  chunk: Buffer | string,
): void {
  if (sink) {
    sink.write(chunk);
    return;
  }
  chunks.push(toBuffer(chunk));
}

export function bufferedUtf8(chunks: Buffer[]): string {
  return Buffer.concat(chunks).toString("utf8");
}

export function attachStdin(
  stdin: string | Readable | undefined,
  target: NodeJS.WritableStream | null | undefined,
): void {
  if (!target) {
    return;
  }
  if (stdin === undefined) {
    target.end();
    return;
  }
  if (typeof stdin === "string") {
    target.write(stdin);
    target.end();
    return;
  }
  stdin.pipe(target);
}

export class CollectStream extends WritableStream {
  private readonly chunks: Buffer[] = [];

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(toBuffer(chunk));
    callback();
  }

  text(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

/** Writable that exposes stdout/stderr chunks as an async iterable. */
export class AsyncChunkWritable extends WritableStream {
  private readonly buffer: string[] = [];
  private readonly waiters: Array<(chunk: string | null) => void> = [];
  private ended = false;

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.pushChunk(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    callback();
  }

  override _final(callback: (error?: Error | null) => void): void {
    this.ended = true;
    for (const waiter of this.waiters) {
      waiter(null);
    }
    this.waiters.length = 0;
    callback();
  }

  async *chunks(): AsyncIterable<string> {
    while (true) {
      if (this.buffer.length > 0) {
        yield this.buffer.shift()!;
        continue;
      }
      if (this.ended) {
        return;
      }
      const chunk = await new Promise<string | null>((resolve) => {
        this.waiters.push(resolve);
      });
      if (chunk === null) {
        return;
      }
      yield chunk;
    }
  }

  private pushChunk(text: string): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(text);
      return;
    }
    this.buffer.push(text);
  }
}

export async function* mergeTaggedAsync<T extends string, V>(
  streams: Array<{ tag: T; iterable: AsyncIterable<V> }>,
): AsyncGenerator<{ tag: T; value: V }> {
  type Pending = {
    tag: T;
    iterator: AsyncIterator<V>;
    next: Promise<{ tag: T; item: IteratorResult<V> }>;
  };

  const pending: Pending[] = streams.map(({ tag, iterable }) => {
    const iterator = iterable[Symbol.asyncIterator]();
    return {
      tag,
      iterator,
      next: iterator.next().then((item) => ({ tag, item })),
    };
  });

  let active = pending.length;

  while (active > 0) {
    const ready = await Promise.race(pending.map((entry) => entry.next));
    const entry = pending.find((candidate) => candidate.tag === ready.tag);
    if (!entry) {
      continue;
    }

    if (ready.item.done) {
      active -= 1;
      entry.next = new Promise(() => {});
      continue;
    }

    yield { tag: ready.tag, value: ready.item.value };
    entry.next = entry.iterator.next().then((item) => ({ tag: entry.tag, item }));
  }
}

export function takeStreamText(
  text: string,
  used: number,
  max: number,
): { text: string; used: number } {
  if (used >= max) {
    return { text: "", used };
  }
  const slice = text.slice(0, max - used);
  return { text: slice, used: used + slice.length };
}
