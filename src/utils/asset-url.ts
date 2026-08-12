/**
 * Resolves a path inside `public/` against the configured Vite base path.
 *
 * Assets are always referenced relatively so the same build works at the root
 * of a domain and inside a sub-directory. No domain is ever hard-coded.
 */
export function resolveAssetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL;
  const normalisedBase = base.endsWith('/') ? base : `${base}/`;
  const normalisedPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  return `${normalisedBase}${normalisedPath}`;
}
