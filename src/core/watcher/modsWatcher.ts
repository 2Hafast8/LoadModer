import {watch, type FSWatcher} from "node:fs";
import {EventEmitter} from "node:events";
import {DependencyGraph} from "../dependency/graph.js";

export interface WatcherSyncEvent {
  unregistered: string[];
  orphanedSlugs: string[];
  timestamp: string;
}

export interface WatcherFileEvent {
  eventType: "rename" | "change";
  filename: string;
  timestamp: string;
}

export class ModsWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isWatching = false;

  constructor(
    public readonly modsDir: string,
    public readonly instanceDir: string,
  ) {
    super();
  }

  start(): void {
    if (this.isWatching) return;

    try {
      this.watcher = watch(this.modsDir, (eventType, filename) => {
        if (!filename) return;
        const nameStr = filename.toString();

        if (!nameStr.endsWith(".jar") && !nameStr.endsWith(".disabled")) {
          return;
        }

        const fileEvent: WatcherFileEvent = {
          eventType,
          filename: nameStr,
          timestamp: new Date().toLocaleTimeString(),
        };
        this.emit("file-event", fileEvent);

        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(async () => {
          await this.sync();
        }, 300);
      });

      this.isWatching = true;
      this.emit("started", {modsDir: this.modsDir});
    } catch (err) {
      this.emit("error", err);
    }
  }

  async sync(): Promise<WatcherSyncEvent> {
    const graph = new DependencyGraph(this.instanceDir);
    await graph.load();

    const res = await graph.reconcileWithDisk(this.modsDir);
    const syncEvent: WatcherSyncEvent = {
      unregistered: res.unregistered,
      orphanedSlugs: res.orphanedSlugs,
      timestamp: new Date().toLocaleTimeString(),
    };

    if (res.unregistered.length > 0 || res.orphanedSlugs.length > 0) {
      this.emit("sync", syncEvent);
    }

    return syncEvent;
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.isWatching = false;
    this.emit("stopped");
  }

  get running(): boolean {
    return this.isWatching;
  }
}
