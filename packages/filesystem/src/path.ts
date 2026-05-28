import { join, normalize, resolve } from "pathe";

/**
 * Resolve a POSIX filesystem path against virtual root `/` using [pathe](https://github.com/unjs/pathe)
 * {@link resolve} (same contract as [Node `path.resolve`](https://nodejs.org/api/path.html#pathresolvepaths)).
 * Only for real paths, not glob/minimatch patterns — use {@link normalizeGlobPattern} for those.
 */
export function resolvePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";

  const abs = resolve("/", trimmed);
  if (abs === "/" || abs === "") return "/";
  return abs.startsWith("/") ? abs.slice(1) : abs;
}

/**
 * Normalize a minimatch glob to POSIX slashes without applying {@link resolve} (so `**` and
 * literal `..` inside the pattern are not treated as filesystem traversal).
 */
export function normalizeGlobPattern(pattern: string): string {
  const trimmed = pattern.trim();
  if (!trimmed) return "**";
  const n = normalize(join(normalize(trimmed), "."));
  if (n === "" || n === ".") return "**";
  return n;
}
