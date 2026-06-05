export {
  FileSystemAdapter,
  type FileEncodingOptions,
  type FileStat,
  type FileStatType,
  type GrepMatch,
  type GrepOptions,
  type LsOptions,
  type LsStreamOptions,
} from "./index";
export type { Readable, Writable } from "node:stream";
export {
  CompositeFileSystem,
  type CompositeFileSystemCreateOptions,
} from "./composite-adapter";
