import path from "node:path";

/**
 * Memeriksa apakah berkas/folder merupakan berkas mesin TLauncher
 * yang wajib dipertahankan saat wadah dibersihkan (clean state).
 */
export function isTLauncherPreservedEngineItem(entryName: string, containerDir: string): boolean {
  const cName = path.basename(containerDir).toLowerCase();
  const lower = entryName.toLowerCase();

  if (lower === ".loadmoder" || lower === ".fabric" || lower === "logs") return true;
  if (lower === "tlauncheradditional.json") return true;
  if (lower === `${cName}.jar` || lower === `${cName}.json`) return true;
  if (lower.startsWith("mypack") && (lower.endsWith(".jar") || lower.endsWith(".json"))) return true;

  return false;
}

