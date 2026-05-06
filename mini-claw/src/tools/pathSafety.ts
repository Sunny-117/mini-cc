import * as path from "path";

export function resolveSafePath(baseDir: string, inputPath: string): string | null {
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(baseDir, inputPath);

  const normalizedBase = path.resolve(baseDir);
  const normalizedTarget = path.resolve(resolved);
  const withSep = `${normalizedBase}${path.sep}`;

  if (normalizedTarget === normalizedBase || normalizedTarget.startsWith(withSep)) {
    return normalizedTarget;
  }

  return null;
}

export function relativeToBase(baseDir: string, targetPath: string): string {
  return path.relative(path.resolve(baseDir), path.resolve(targetPath)) || ".";
}
