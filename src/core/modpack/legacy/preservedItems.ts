import path from "node:path";

/**
 * Memeriksa apakah berkas/folder merupakan berkas penting Legacy Launcher
 * yang wajib dipertahankan saat profil wadah dibersihkan (clean state).
 */
export function isLegacyPreservedItem(entryName: string, _containerDir?: string): boolean {
  const lower = entryName.toLowerCase();

  // Folder sistem dan konfigurasi game pengguna
  if (
    lower === ".loadmoder" ||
    lower === ".fabric" ||
    lower === "logs" ||
    lower === "saves" ||
    lower === "servers.dat" ||
    lower === "servers.dat.bak" ||
    lower === "server-resource-packs"
  ) {
    return true;
  }

  return false;
}

