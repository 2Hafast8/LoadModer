export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n);
}

export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toISOString().split('T')[0];
  } catch {
    return isoString;
  }
}

/**
 * Memotong teks jika melebihi batas maksimal karakter,
 * mempertahankan keterbacaan dengan akhiran elipsis (...).
 */
export function truncateText(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str;
  const sliced = str.slice(0, Math.max(0, maxLength - 3)).replace(/[\s\-_.]+$/, "");
  return `${sliced}...`;
}
