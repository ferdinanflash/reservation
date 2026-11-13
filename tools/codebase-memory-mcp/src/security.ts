import path from "node:path";

const SKIP_FILES = [
  /^\.env(?:\.|$)/i,
  /(^|\/)(?:secrets?|credentials?)(?:\/|\.|$)/i,
  /(^|\/).+\.(?:pem|key|p12|pfx|keystore)$/i,
  /(^|\/)(?:id_rsa|id_ed25519)(?:\.pub)?$/i,
  /(^|\/)(?:service-account|supabase-service-role).*\.json$/i
];

export function isExcludedPath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\.\//, "");
  return !normalized || normalized.startsWith("/") ||
    normalized.split("/").some(part => part === "..") ||
    SKIP_FILES.some(pattern => pattern.test(normalized));
}

export function resolveSafePath(root: string, relativePath: string): string | null {
  if (isExcludedPath(relativePath)) return null;
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\.\//, "");
  const absolute = path.resolve(root, normalized);
  return absolute === root || absolute.startsWith(root + path.sep) ? absolute : null;
}
