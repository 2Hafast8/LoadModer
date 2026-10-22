import path from "node:path";
import { readdir, rename } from "node:fs/promises";
import { assertMinecraftNotRunning } from "./processGuard.js";

export async function toggleModFile(modsDir: string, modQuery: string, enable: boolean): Promise<string> {
  await assertMinecraftNotRunning("mengubah status aktif/nonaktif mod");

  const files = await readdir(modsDir);
  const targetSuffix = enable ? ".jar.disabled" : ".jar";
  const replaceSuffix = enable ? ".jar" : ".jar.disabled";

  const match = files.find(
    (f) => f.toLowerCase().includes(modQuery.toLowerCase()) && f.endsWith(targetSuffix)
  );

  if (!match) {
    throw new Error(`Berkas "${modQuery}" dengan status ${enable ? "nonaktif" : "aktif"} tidak ditemukan.`);
  }

  const oldPath = path.join(modsDir, match);
  const newName = match.replace(new RegExp(`\\${targetSuffix}$`), replaceSuffix);
  const newPath = path.join(modsDir, newName);

  await rename(oldPath, newPath);
  return newName;
}
