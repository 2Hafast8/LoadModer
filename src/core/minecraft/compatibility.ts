import type {ModVersion} from "../../types/modrinth.js";
import {isMinecraftVersionAtLeast1_16, compareMinecraftVersionsDesc} from "./versions.js";

export interface ModCompatibilityInfo {
  isCompatible: boolean;
  userLoader: string;
  userGameVersion: string;
  compatibleVersionCount: number;
  bestCompatibleVersion?: ModVersion;
  availableLoaders: string[];
  availableGameVersions: string[];
}

export function computeModCompatibility(
  versions: ModVersion[],
  userLoader: string,
  userGameVersion: string,
): ModCompatibilityInfo {
  const allLoaders = Array.from(new Set(versions.flatMap((v) => v.loaders)));
  const allGameVersions = Array.from(new Set(versions.flatMap((v) => v.game_versions)))
    .filter(isMinecraftVersionAtLeast1_16)
    .sort(compareMinecraftVersionsDesc);

  const cleanUserLoader = userLoader.toLowerCase().trim();
  const cleanUserVer = userGameVersion.toLowerCase().trim();

  const compatibleVersions = versions.filter((v) => {
    const hasLoader =
      v.loaders.length === 0 ||
      v.loaders.some((l) => {
        const cl = l.toLowerCase();
        return (
          cl === cleanUserLoader ||
          cl === "minecraft" ||
          cl === "vanilla" ||
          cl === "iris" ||
          cl === "optifine" ||
          cl === "canvas"
        );
      });
    const hasGameVer = v.game_versions.some((gv) => gv.toLowerCase() === cleanUserVer);
    return hasLoader && hasGameVer;
  });

  const isCompatible = compatibleVersions.length > 0;
  const bestCompatibleVersion =
    compatibleVersions.find((v) => v.version_type === "release") ?? compatibleVersions[0];

  return {
    isCompatible,
    userLoader,
    userGameVersion,
    compatibleVersionCount: compatibleVersions.length,
    bestCompatibleVersion,
    availableLoaders: allLoaders,
    availableGameVersions: allGameVersions,
  };
}
