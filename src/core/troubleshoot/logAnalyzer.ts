import path from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';

export type CrashCategory =
  | 'missing_dependency'
  | 'incompatible_mod'
  | 'java_version'
  | 'out_of_memory'
  | 'corrupted_file'
  | 'unknown';

export interface CrashAction {
  type: 'disable' | 'install' | 'reinstall' | 'none';
  target: string;
  label: string;
}

export interface CrashAnalysisReport {
  hasCrash: boolean;
  sourceFile?: string;
  sourceType?: 'crash_report' | 'latest_log';
  timestamp?: string;
  category?: CrashCategory;
  culprit?: string;
  summary?: string;
  solution?: string;
  action?: CrashAction;
  rawExcerpt: string;
}

export class LogAnalyzer {
  async getLatestCrashFile(instanceDir: string): Promise<string | null> {
    const crashReportsDir = path.join(instanceDir, 'crash-reports');
    try {
      const files = await readdir(crashReportsDir);
      const textFiles = files.filter((f) => f.endsWith('.txt'));
      if (textFiles.length === 0) return null;

      const fileStats = await Promise.all(
        textFiles.map(async (filename) => {
          const filePath = path.join(crashReportsDir, filename);
          const st = await stat(filePath);
          return { filePath, mtime: st.mtimeMs };
        })
      );

      fileStats.sort((a, b) => b.mtime - a.mtime);
      return fileStats[0].filePath;
    } catch {
      return null;
    }
  }

  async getLatestLogFile(instanceDir: string): Promise<string | null> {
    const logPath = path.join(instanceDir, 'logs', 'latest.log');
    try {
      await stat(logPath);
      return logPath;
    } catch {
      return null;
    }
  }

  parseLogContent(content: string, sourcePath: string, isCrashReport: boolean): CrashAnalysisReport {
    const cleanContent = content.slice(-150000);
    const lines = cleanContent.split(/\r?\n/);
    const excerptLines = lines.slice(-120);
    const rawExcerpt = excerptLines.join('\n');

    const oomMatch = cleanContent.match(/java\.lang\.OutOfMemoryError|Java heap space/i);
    if (oomMatch) {
      return {
        hasCrash: true,
        sourceFile: path.basename(sourcePath),
        sourceType: isCrashReport ? 'crash_report' : 'latest_log',
        category: 'out_of_memory',
        culprit: 'JVM Heap / Memory Limit',
        summary: 'Minecraft kehabisan alokasi memori RAM (OutOfMemoryError).',
        solution: 'Tingkatkan alokasi RAM Minecraft di launcher (minimal 4 GB atau 6 GB untuk modpack).',
        action: {
          type: 'none',
          target: '',
          label: 'Alokasikan lebih banyak RAM di pengaturan launcher',
        },
        rawExcerpt,
      };
    }

    const javaVerMatch = cleanContent.match(
      /has been compiled by a more recent version of the Java Runtime|UnsupportedClassVersionError/i
    );
    if (javaVerMatch) {
      return {
        hasCrash: true,
        sourceFile: path.basename(sourcePath),
        sourceType: isCrashReport ? 'crash_report' : 'latest_log',
        category: 'java_version',
        culprit: 'Java Runtime Environment',
        summary: 'Versi Java tidak kompatibel. Mod membutuhkan versi Java yang lebih baru.',
        solution: 'Ganti atau perbarui versi Java di launcher ke Java 17 atau Java 21.',
        action: {
          type: 'none',
          target: '',
          label: 'Perbarui versi Java di launcher',
        },
        rawExcerpt,
      };
    }

    const depMatch1 = cleanContent.match(
      /Mod ([a-zA-Z0-9_.-]+) requires ([a-zA-Z0-9_.-]+) of ([a-zA-Z0-9_.-]+), which is missing/i
    );
    const depMatch2 = cleanContent.match(
      /Could not find required mod: ([a-zA-Z0-9_.-]+)/i
    );
    const depMatch3 = cleanContent.match(
      /Requires:? \s*([a-zA-Z0-9_.-]+)/i
    );

    if (depMatch1 || depMatch2 || depMatch3) {
      const missingMod = depMatch1?.[3] ?? depMatch1?.[2] ?? depMatch2?.[1] ?? depMatch3?.[1] ?? '';
      const requestingMod = depMatch1?.[1] ?? '';

      return {
        hasCrash: true,
        sourceFile: path.basename(sourcePath),
        sourceType: isCrashReport ? 'crash_report' : 'latest_log',
        category: 'missing_dependency',
        culprit: missingMod,
        summary: requestingMod
          ? `Mod "${requestingMod}" membutuhkan dependensi "${missingMod}" yang belum terpasang.`
          : `Dependensi wajib "${missingMod}" tidak ditemukan di folder instance.`,
        solution: `Pasang mod dependensi "${missingMod}" melalui tab Explore.`,
        action: {
          type: 'install',
          target: missingMod,
          label: `Cari & Pasang "${missingMod}"`,
        },
        rawExcerpt,
      };
    }

    const duplicateMatch = cleanContent.match(/Duplicate mods? found:.*([a-zA-Z0-9_.-]+\.jar)/i);
    if (duplicateMatch) {
      const dupFile = duplicateMatch[1];
      return {
        hasCrash: true,
        sourceFile: path.basename(sourcePath),
        sourceType: isCrashReport ? 'crash_report' : 'latest_log',
        category: 'incompatible_mod',
        culprit: dupFile,
        summary: `Ditemukan berkas mod ganda/duplikat untuk "${dupFile}".`,
        solution: `Nonaktifkan atau hapus salah satu versi berkas duplikat "${dupFile}".`,
        action: {
          type: 'disable',
          target: dupFile,
          label: `Nonaktifkan "${dupFile}"`,
        },
        rawExcerpt,
      };
    }

    const mixinMatch = cleanContent.match(
      /(?:Mixin apply failed|org\.spongepowered\.asm\.mixin).*?(?:for mod|from mod)\s+([a-zA-Z0-9_.-]+)|Incompatible mod set!.*Mod '([^']+)'/i
    );
    if (mixinMatch) {
      const conflictMod = mixinMatch[1] ?? mixinMatch[2] ?? 'mod';
      return {
        hasCrash: true,
        sourceFile: path.basename(sourcePath),
        sourceType: isCrashReport ? 'crash_report' : 'latest_log',
        category: 'incompatible_mod',
        culprit: conflictMod,
        summary: `Terjadi bentrok mod (Mixin conflict) yang disebabkan oleh "${conflictMod}".`,
        solution: `Nonaktifkan mod "${conflictMod}" atau ganti ke versi yang kompatibel.`,
        action: {
          type: 'disable',
          target: conflictMod,
          label: `Nonaktifkan "${conflictMod}"`,
        },
        rawExcerpt,
      };
    }

    const corruptedMatch = cleanContent.match(
      /ZipException: ([^\r\n]+)|InvalidJarException.*([a-zA-Z0-9_.-]+\.jar)/i
    );
    if (corruptedMatch) {
      const corruptFile = corruptedMatch[2] ?? corruptedMatch[1] ?? '';
      return {
        hasCrash: true,
        sourceFile: path.basename(sourcePath),
        sourceType: isCrashReport ? 'crash_report' : 'latest_log',
        category: 'corrupted_file',
        culprit: corruptFile,
        summary: `Berkas mod "${corruptFile}" rusak atau tidak lengkap saat diunduh.`,
        solution: `Unduh ulang berkas mod "${corruptFile}" atau hapus berkas tersebut.`,
        action: {
          type: 'reinstall',
          target: corruptFile,
          label: `Hapus & Pasang Ulang "${corruptFile}"`,
        },
        rawExcerpt,
      };
    }

    const hasErrorIndicator =
      isCrashReport ||
      cleanContent.includes('FATAL') ||
      cleanContent.includes('Exception in thread') ||
      cleanContent.includes('Crash Report');

    return {
      hasCrash: hasErrorIndicator,
      sourceFile: path.basename(sourcePath),
      sourceType: isCrashReport ? 'crash_report' : 'latest_log',
      category: hasErrorIndicator ? 'unknown' : undefined,
      culprit: hasErrorIndicator ? 'Unidentified Mod / Engine' : undefined,
      summary: hasErrorIndicator
        ? 'Ditemukan error saat eksekusi Minecraft. Silakan periksa stack trace di bawah ini.'
        : 'Tidak terdeteksi error fatal pada berkas log.',
      solution: hasErrorIndicator
        ? 'Gunakan alat Diagnostik Bisect untuk mengisolasi mod bermasalah secara otomatis.'
        : undefined,
      action: hasErrorIndicator
        ? {
            type: 'none',
            target: '',
            label: 'Jalankan Diagnostik Bisect',
          }
        : undefined,
      rawExcerpt,
    };
  }

  async analyze(instanceDir: string): Promise<CrashAnalysisReport> {
    const crashFile = await this.getLatestCrashFile(instanceDir);
    if (crashFile) {
      try {
        const content = await readFile(crashFile, 'utf8');
        return this.parseLogContent(content, crashFile, true);
      } catch {}
    }

    const logFile = await this.getLatestLogFile(instanceDir);
    if (logFile) {
      try {
        const content = await readFile(logFile, 'utf8');
        return this.parseLogContent(content, logFile, false);
      } catch {}
    }

    return {
      hasCrash: false,
      rawExcerpt: 'Tidak ditemukan berkas crash-reports atau logs/latest.log pada instance aktif.',
    };
  }

  async getLatestLog(instanceDir: string): Promise<string> {
    const crashFile = await this.getLatestCrashFile(instanceDir);
    if (crashFile) {
      try {
        return await readFile(crashFile, 'utf8');
      } catch {}
    }
    const logFile = await this.getLatestLogFile(instanceDir);
    if (logFile) {
      try {
        return await readFile(logFile, 'utf8');
      } catch {}
    }
    return '';
  }
}

export const logAnalyzer = new LogAnalyzer();
