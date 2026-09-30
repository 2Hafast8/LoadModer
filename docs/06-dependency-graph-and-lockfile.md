# 06 — Dependency Graph & Lockfile Engine

Dokumen ini menjelaskan struktur data, skema berkas `loadmoder.lock.json`, serta algoritma pelacakan dependensi menggunakan **Directed Acyclic Graph (DAG)** dan **Reference Counting** untuk mencegah file sampah (*orphan libraries*).

---

## 1. Masalah Utama Manajer Mod Konvensional

Pada sistem pengelolaan manual atau skrip sederhana:
1. Pemain memasang mod **A** yang membutuhkan pustaka **B** dan **C**.
2. Beberapa minggu kemudian, pemain menghapus mod **A** secara manual.
3. Berkas **B** dan **C** tertinggal selamanya di folder `mods/`. Seiring waktu, puluhan file pustaka tak terpakai menumpuk dan dapat memicu konflik kelas (*classloading crash*).
4. Jika mod **D** juga membutuhkan pustaka **B**, menghapus mod **A** tidak boleh menghapus **B**.

**LoadModer** menyelesaikan masalah ini dengan mekanisme **Dependency Reference Counting** melalui `loadmoder.lock.json`.

---

## 2. Struktur Skema `loadmoder.lock.json`

File ini disimpan langsung di folder instance game pengguna:

```json
{
  "$schema": "https://loadmoder.dev/schema/v1/lock.json",
  "version": 1,
  "gameVersion": "1.21.1",
  "loader": "fabric",
  "environment": "client",
  "updatedAt": "2026-09-30T14:00:00.000Z",
  "mods": {
    "sodium": {
      "projectId": "AANobbMI",
      "versionId": "f90B2c1A",
      "versionNumber": "0.6.0+mc1.21.1",
      "filename": "sodium-fabric-0.6.0+mc1.21.1.jar",
      "sha512": "3a8f...b291",
      "isRoot": true,
      "dependencies": ["fabric-api"],
      "dependedBy": []
    },
    "iris": {
      "projectId": "YL57xq9U",
      "versionId": "kL89m12Z",
      "versionNumber": "1.7.5+mc1.21.1",
      "filename": "iris-fabric-1.7.5+mc1.21.1.jar",
      "sha512": "b123...ff01",
      "isRoot": true,
      "dependencies": ["sodium", "fabric-api"],
      "dependedBy": []
    },
    "fabric-api": {
      "projectId": "P7dR8mSH",
      "versionId": "hJ98aK2L",
      "versionNumber": "0.102.0+1.21.1",
      "filename": "fabric-api-0.102.0+1.21.1.jar",
      "sha512": "9e12...a04c",
      "isRoot": false,
      "dependencies": [],
      "dependedBy": ["sodium", "iris"]
    }
  }
}
```

---

## 3. Algoritma Directed Acyclic Graph (DAG) & Reference Counting

```
    [ sodium ] (isRoot: true)          [ iris ] (isRoot: true)
         │                                  │
         │ (requires)                       │ (requires)
         ├──────────────────┬───────────────┘
         │                  │
         ▼                  ▼
  [ fabric-api ]       [ sodium ] (juga dibutuhkan oleh iris)
  (dependedBy: 2)      (isRoot: true, dependedBy: 1)
```

### Logika Penambahan (Install):
1. Jika pengguna meminta instalasi mod `A` $\rightarrow$ `A.isRoot = true`.
2. Untuk setiap dependensi `B` yang dibutuhkan `A`:
   - Jika `B` belum ada di lockfile, pasang `B` dan tandai `B.isRoot = false`.
   - Tambahkan `A` ke dalam array `B.dependedBy`.

### Logika Penghapusan (Remove & Prune):
1. Pengguna meminta penghapusan mod `iris`:
   - Hapus berkas file `iris` dari folder `mods/`.
   - Iterasi semua dependensi `iris` (`sodium` dan `fabric-api`).
   - Hapus string `"iris"` dari array `dependedBy` milik `sodium` dan `fabric-api`.
2. **Evaluasi Yatim (Orphan Check)**:
   - Untuk setiap dependensi yang terpengaruh, periksa kondisi:
     `if (!mod.isRoot && mod.dependedBy.length === 0)`
   - Pustaka `fabric-api` masih memiliki `dependedBy: ["sodium"]` $\rightarrow$ **Pertahankan**.
   - Jika nantinya `sodium` juga dihapus, maka `fabric-api.dependedBy` bernilai `[]` (0 referensi) $\rightarrow$ **Tandai sebagai yatim (orphan) dan hapus dari disk**.

---

## 4. Implementasi `DependencyGraph` (`src/core/dependencyGraph.ts`)

```typescript
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import writeFileAtomic from 'write-file-atomic';

export interface LockModEntry {
  projectId: string;
  versionId: string;
  versionNumber: string;
  filename: string;
  sha512: string;
  isRoot: boolean;
  dependencies: string[];
  dependedBy: string[];
}

export interface LockfileData {
  version: 1;
  gameVersion: string;
  loader: string;
  environment: 'client' | 'server';
  updatedAt: string;
  mods: Record<string, LockModEntry>;
}

export class DependencyGraphManager {
  private lockfilePath: string;
  private data: LockfileData;

  constructor(instanceDir: string, gameVersion: string, loader: string) {
    this.lockfilePath = path.join(instanceDir, 'loadmoder.lock.json');
    this.data = {
      version: 1,
      gameVersion,
      loader,
      environment: 'client',
      updatedAt: new Date().toISOString(),
      mods: {},
    };
  }

  async load(): Promise<void> {
    try {
      const content = await readFile(this.lockfilePath, 'utf8');
      this.data = JSON.parse(content);
    } catch {
      // Inisialisasi lockfile baru jika belum ada
    }
  }

  async save(): Promise<void> {
    this.data.updatedAt = new Date().toISOString();
    await writeFileAtomic(this.lockfilePath, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
  }

  registerMod(slug: string, entry: Omit<LockModEntry, 'dependedBy'>): void {
    const existing = this.data.mods[slug];
    this.data.mods[slug] = {
      ...entry,
      dependedBy: existing ? existing.dependedBy : [],
    };

    // Tambahkan relasi dependedBy ke anak dependensi
    for (const depSlug of entry.dependencies) {
      if (this.data.mods[depSlug] && !this.data.mods[depSlug].dependedBy.includes(slug)) {
        this.data.mods[depSlug].dependedBy.push(slug);
      }
    }
  }

  /** Menghapus mod dan mengembalikan daftar slug dependensi yang menjadi yatim (orphan) */
  removeMod(slug: string): { removedFile: string | null; orphanedSlugs: string[] } {
    const target = this.data.mods[slug];
    if (!target) return { removedFile: null, orphanedSlugs: [] };

    const removedFile = target.filename;
    delete this.data.mods[slug];

    const orphanedSlugs: string[] = [];

    // Kurangi referensi dari dependensinya
    for (const depSlug of target.dependencies) {
      const dep = this.data.mods[depSlug];
      if (dep) {
        dep.dependedBy = dep.dependedBy.filter((parent) => parent !== slug);
        // Jika bukan root dan sudah tidak ada yang bergantung, berarti yatim
        if (!dep.isRoot && dep.dependedBy.length === 0) {
          orphanedSlugs.push(depSlug);
        }
      }
    }

    return { removedFile, orphanedSlugs };
  }

  getOrphanModFiles(orphanedSlugs: string[]): string[] {
    return orphanedSlugs.map((slug) => this.data.mods[slug]?.filename).filter(Boolean);
  }
}
```

---

## 5. Deteksi Inkompatibilitas Sebelum Unduhan (Pre-Flight Check)

Modrinth API menyediakan array `dependencies[]` dengan `dependency_type: 'incompatible'`.

LoadModer memeriksa ini **sebelum satu bita pun berkas diunduh**:
```typescript
for (const dep of version.dependencies) {
  if (dep.dependency_type === 'incompatible' && dep.project_id) {
    const conflictMod = Object.values(this.data.mods).find((m) => m.projectId === dep.project_id);
    if (conflictMod) {
      throw new Error(
        `🚨 Konflik Terdeteksi! Mod "${version.name}" tidak kompatibel dengan "${conflictMod.filename}" yang sudah terpasang.`
      );
    }
  }
}
```
Pemeriksaan awal ini mencegah pengguna mengalami crash fatal saat memulai game setelah instalasi.
