# C4 Architecture Specification: LoadModer

Dokumentasi arsitektur perangkat lunak LoadModer berdasarkan standar **C4 Model** (Context, Container, Component, Code) yang mencakup CLI/TUI dan Desktop GUI Application.

---

## Level 1: System Context

Diagram Konteks Sistem menggambarkan posisi LoadModer dalam ekosistem pengelolaan mod Minecraft dan hubungannya dengan aktor eksternal.

```mermaid
---
title: System Context Diagram - LoadModer
---
flowchart TB
    User(["Pengguna / Modder"])
    LoadModer["LoadModer (CLI & Desktop GUI)"]
    Modrinth["Modrinth API v2\n(https://api.modrinth.com/v2)"]
    Launchers["Minecraft Launchers\n(Official, Prism, MultiMC, Modrinth App, CurseForge, TLauncher, Legacy)"]
    FileSystem["Local File System\n(.minecraft / instances)"]

    User -->|Mengelola mod, mencari asset, bisect crash| LoadModer
    LoadModer -->|Cari & unduh mods, modpacks, dependencies| Modrinth
    LoadModer -->|Deteksi path instance & konfigurasi loader| Launchers
    LoadModer -->|Manipulasi atomik: mods, shaderpacks, lockfile| FileSystem
```

---

## Level 2: Container Diagram

Diagram Kontainer memetakan boundary antara runtime CLI, aplikasi Desktop Electron, Core Domain Logic, dan penyimpanan lokal.

```mermaid
---
title: Container Diagram - LoadModer
---
flowchart TB
    subgraph ClientLayer["Runtime Environments"]
        CLI["CLI / TUI Runtime\n(Node.js / Commander.js / Clack)"]
        ElectronMain["Electron Main Process\n(Node.js / IPC Handlers)"]
        ElectronPreload["Electron Preload Bridge\n(contextBridge / IPC Renderer)"]
        DesktopRenderer["Desktop GUI Renderer\n(React 19 / Vite / Tailwind)"]
    end

    subgraph CoreEngine["Core Domain Engine (Decoupled TypeScript)"]
        InstanceMgr["Instance & Drive Scanner"]
        DepResolver["Dependency Graph & DAG Resolver"]
        ModpackEng["Modpack Engine (Unpacker / Exporter)"]
        TroubleshootEng["Diagnostic & Bisect Engine"]
        LocalInstaller["Local File Drag-and-Drop Installer"]
        ProfileSnapshot["Version Profile & Snapshots"]
        DirWatcher["Directory Monitor (ModsWatcher)"]
    end

    subgraph ExternalServices["External Systems & Storage"]
        ModrinthAPI["Modrinth REST API v2"]
        DiskStorage["Local Disk (JSON config, .jar, .mrpack)"]
    end

    DesktopRenderer -->|Safe typed IPC calls| ElectronPreload
    ElectronPreload -->|IPC events| ElectronMain
    CLI --> CoreEngine
    ElectronMain --> CoreEngine

    CoreEngine --> ModrinthAPI
    CoreEngine --> DiskStorage
```

---

## Level 3: Component Diagram (Desktop Subsystem)

Diagram Komponen memperlihatkan arsitektur internal modul desktop dan jembatan ke logika domain murni.

```mermaid
---
title: Component Diagram - Desktop & Core Subsystems
---
flowchart LR
    subgraph RendererComponents["Renderer (UI Layer)"]
        App["App.tsx"]
        TopBar["TopBar"]
        DropZone["DropZoneOverlay"]
        ModsView["ModsView"]
        ExploreView["ExploreView"]
        InstancesView["InstancesView"]
        BisectView["BisectView"]
        ExportModal["ExportModpackModal"]
        DownCenter["DownloadCenter"]
    end

    subgraph PreloadBridge["Preload Security Gateway"]
        DesktopAPI["DesktopAPI Interface\n(src/desktop/preload/index.ts)"]
    end

    subgraph MainProcessHandlers["IPC Dispatcher"]
        IpcHandlers["ipcHandlers.ts\n(registerIpcHandlers)"]
    end

    subgraph DomainCore["Core Services"]
        LocalInst["localInstaller.ts"]
        Exporter["modpack/exporter.ts"]
        Analyzer["troubleshoot/logAnalyzer.ts"]
        Bisect["troubleshoot/bisect.ts"]
        Watcher["watcher/modsWatcher.ts"]
        Unpacker["modpack/unpacker.ts"]
    end

    App --> TopBar
    App --> DropZone
    App --> ModsView
    App --> ExploreView
    App --> InstancesView
    App --> BisectView
    App --> DownCenter
    ModsView --> ExportModal

    RendererComponents --> DesktopAPI
    DesktopAPI --> IpcHandlers

    IpcHandlers --> LocalInst
    IpcHandlers --> Exporter
    IpcHandlers --> Analyzer
    IpcHandlers --> Bisect
    IpcHandlers --> Watcher
    IpcHandlers --> Unpacker
```

---

## Level 4: Code Diagram & Key Abstractions

### 1. Drag-and-Drop Installation Pipeline
```mermaid
---
title: Code Data Flow - Local File Installation
---
flowchart TD
    DropEvent["User drops files on window (App.tsx)"]
    ExtractPaths["Extract file.path array"]
    IpcCall["window.api.mods.installDroppedFiles(filePaths)"]
    Handler["ipcMain.handle('mods:installDroppedFiles')"]
    DomainFunc["installLocalFiles(filePaths, instanceDir, modsDir)"]
    ExtCheck{"File Extension"}

    DropEvent --> ExtractPaths --> IpcCall --> Handler --> DomainFunc --> ExtCheck

    ExtCheck -->|".jar"| CopyMod["copyFile -> <instance>/mods/"]
    ExtCheck -->|".mrpack"| UnpackMrpack["ModpackUnpacker.install()"]
    ExtCheck -->|".zip"| ZipInspect{"Inspect ZIP Entries via unzipper"}
    ExtCheck -->|Others| ErrorReject["Reject unsupported format"]

    ZipInspect -->|"contains 'shaders/'"| ShaderCopy["copyFile -> <instance>/shaderpacks/"]
    ZipInspect -->|"contains 'pack.mcmeta'"| RPCopy["copyFile -> <instance>/resourcepacks/"]
    ZipInspect -->|"contains 'modrinth.index.json'"| MrpackZip["ModpackUnpacker.install()"]
    ZipInspect -->|"contains .jar files"| ExtractJars["Stream extract -> <instance>/mods/"]

    CopyMod --> SuccessNotify["win.webContents.send('mods:changed')"]
    UnpackMrpack --> SuccessNotify
    ShaderCopy --> SuccessNotify
    RPCopy --> SuccessNotify
    ExtractJars --> SuccessNotify
```

### 2. Modul Domain Utama

#### `installLocalFiles(filePaths, instanceDir, modsDir, unpacker?)`
- **Lokasi**: [src/core/instance/localInstaller.ts](file:///c:/Users/DELL/Downloads/LoadModer/src/core/instance/localInstaller.ts)
- **Tanggung Jawab**: Memeriksa header dan entri berkas secara in-memory untuk menentukan klasifikasi asset (mod, shader, resourcepack, atau modpack), kemudian menyalin atau mengekstrak berkas secara aman tanpa risiko path traversal.
- **Keluaran**: `Promise<InstalledLocalResult[]>`

#### `ModpackExporter.exportModpack(opts)`
- **Lokasi**: [src/core/modpack/exporter.ts](file:///c:/Users/DELL/Downloads/LoadModer/src/core/modpack/exporter.ts)
- **Tanggung Jawab**: Mengompilasi mod yang aktif dan file konfigurasi menjadi bundle `.mrpack` (dengan `modrinth.index.json` dan hash SHA-512) atau `.zip` mandiri.
- **Keluaran**: `Promise<ModpackExportResult>`

#### `logAnalyzer.analyzeLog(logContent)`
- **Lokasi**: [src/core/troubleshoot/logAnalyzer.ts](file:///c:/Users/DELL/Downloads/LoadModer/src/core/troubleshoot/logAnalyzer.ts)
- **Tanggung Jawab**: Melakukan pattern-matching berbasis regex deterministik terhadap crash report atau latest.log Minecraft untuk mengidentifikasi penyebab kegagalan dan mod yang bermasalah.
- **Keluaran**: `Promise<LogAnalysisResult>`

#### `BisectRunner`
- **Lokasi**: [src/core/troubleshoot/bisect.ts](file:///c:/Users/DELL/Downloads/LoadModer/src/core/troubleshoot/bisect.ts)
- **Tanggung Jawab**: Binary search engine untuk membagi mod aktif menjadi subset uji guna mengisolasi mod penyebab crash dalam $\mathcal{O}(\log N)$ langkah.
- **Keluaran**: State tracking dengan persistensi aman ke `bisect_state.json`.

---

## Packaging & Distributables Pipeline

```mermaid
---
title: Distributable Build Pipeline
---
flowchart LR
    SourceCode["TypeScript / React Sources"] --> Vite["Vite (Renderer Bundle)"]
    SourceCode --> Tsup["Tsup (Main, Preload, CLI)"]
    Vite --> DesktopDist["dist-desktop/"]
    Tsup --> DesktopDist
    Tsup --> CliDist["dist/"]

    DesktopDist --> Builder["electron-builder --win"]
    CliDist --> Builder

    Builder --> NSIS["LoadModer-Setup-2.6.0.exe\n(NSIS Installer Wizard)"]
    Builder --> Portable["LoadModer-2.6.0-Portable.exe\n(Standalone Portable Executable)"]
```
