# 06 — Dependency Graph, Lockfile & Automatic Resolver

Dokumen ini menjelaskan struktur data `loadmoder.lock.json`, algoritma pelacakan dependensi menggunakan **Directed Acyclic Graph (DAG)** dan **Reference Counting**, serta arsitektur **Automatic Dependency Resolver** yang mendeteksi dan menginstal library mod secara otomatis.

---

## 1. Masalah Utama Manajer Mod Konvensional

Pada sistem pengelolaan manual atau skrip sederhana:
1. Pemain memasang mod **A** yang membutuhkan library **B** dan **C**.
2. Beberapa waktu kemudian, pemain menghapus mod **A** secara manual.
3. Berkas **B** dan **C** tertinggal di folder `mods/`. Seiring waktu, puluhan file pustaka tak terpakai menumpuk dan dapat memicu konflik kelas (*classloader crash*).
4. Jika mod **D** juga membutuhkan pustaka **B**, menghapus mod **A** tidak boleh menghapus **B**.

**LoadModer** menyelesaikan masalah ini dengan mekanisme **Dependency Reference Counting** melalui `loadmoder.lock.json` dan **Automated Dependency Resolver**.

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
   - Library `fabric-api` masih memiliki `dependedBy: ["sodium"]` $\rightarrow$ **Pertahankan**.
   - Jika nantinya `sodium` juga dihapus, maka `fabric-api.dependedBy` bernilai `[]` (0 referensi) $\rightarrow$ **Tandai sebagai yatim (orphan) dan hapus dari disk**.

---

## 4. Mesin Resolusi Dependensi Otomatis (`src/core/dependency/resolver.ts`)

Sering kali pengguna mengunduh mod tanpa menyadari bahwa mod tersebut membutuhkan library pendukung (seperti *Fabric API*, *Cloth Config*, *Architectury*, atau *Indium*).

LoadModer mengintegrasikan mesin resolusi multi-tahap:

### A. Deteksi Dependensi Tingkat API (Metadata Modrinth)
Endpoint API `GET /v2/version/{id}` menyediakan array `dependencies`:
```typescript
{
  project_id: "P7dR8mBk", // ID Fabric API
  dependency_type: "required" // | "optional" | "embedded" | "incompatible"
}
```
Resolver hanya mengambil dependensi dengan status `required`.

### B. Fallback Regex Parsing pada Teks Deskripsi
Jika author mod tidak mendeklarasikan dependensi pada form versi Modrinth namun mencantumkannya di badan deskripsi mod (Markdown), fungsi `extractDependenciesFromText` menganalisis teks deskripsi menggunakan pola reguler:
* `"Requires Cloth Config to function"`
* `"Depends on: Fabric API, Architectury"`
* `"Dependency: YetAnotherConfigLib"`

### C. Verifikasi Keberadaan Lokal & Pencocokan Versi
Sebelum mengunduh file baru dari internet, resolver melakukan:
1. **Local Pre-Check**: Memindai folder `mods/` aktif. Jika file JAR library yang cocok (misalnya `fabric-api-0.102.0.jar`) sudah ada, proses pengunduhan dilewati (*skipped*).
2. **Loader & Version Matching**: Mengambil rilis library yang secara presisi cocok dengan mod loader (`fabric`/`forge`) dan versi Minecraft instance pengguna saat ini.
3. **Pencatatan DAG**: Memasukkan library yang diinstal ke dalam `loadmoder.lock.json` dengan status `isRoot: false` dan mencatat slug mod induk pada `dependedBy`.
