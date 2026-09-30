import { instanceConfig } from '../core/instance/config.js';
import { profileSnapshotManager } from '../core/profile/snapshotManager.js';
import { p, pc, showBanner } from '../ui/prompts.js';

export async function configCommand(action: 'show' | 'set' | 'use', key?: string, value?: string) {
  showBanner();
  await instanceConfig.load();
  const cfg = instanceConfig.get();

  switch (action) {
    case 'show': {
      const active = instanceConfig.getActiveInstance();
      p.note(
        `Instance Aktif     : ${pc.bold(active?.name ?? 'Belum ada')} (${active?.launcher ?? '-'})\n` +
          `Folder Mods        : ${pc.dim(active?.modsDir ?? '-')}\n` +
          `Minecraft Version  : ${active?.gameVersion ?? '-'}\n` +
          `Mod Loader         : ${active?.loader ?? '-'}\n` +
          `Lingkungan Target  : ${cfg.defaultEnvironment ?? 'client'}\n` +
          `Total Instance     : ${Object.keys(cfg.instances).length}`,
        'Konfigurasi LoadModer'
      );
      p.outro(pc.cyan('Gunakan "lm config set <key> <value>" untuk mengubah opsi.'));
      break;
    }

    case 'use': {
      if (!key) {
        p.log.error('Masukkan ID instance yang ingin digunakan. Contoh: lm config use prism-1.21');
        return;
      }
      try {
        instanceConfig.setActiveInstance(key);
        await instanceConfig.save();
        p.outro(pc.green(`Instance aktif berhasil dialihkan ke: ${key}`));
      } catch (err) {
        p.log.error((err as Error).message);
      }
      break;
    }

    case 'set': {
      if (!key || value === undefined) {
        p.log.error('Gunakan: lm config set <key> <value>');
        return;
      }

      if (key === 'defaultGameVersion' || key === 'mc-version') {
        instanceConfig.set('defaultGameVersion', value);
        const activeKey = cfg.activeInstance;
        const active = instanceConfig.getActiveInstance();
        if (activeKey && active) {
          const s = p.spinner();
          s.start(`Mengalihkan versi game instance "${active.name}" ke ${value}...`);
          try {
            const res = await profileSnapshotManager.switchProfile(activeKey, active.loader || 'fabric', value);
            s.stop(pc.green(`Versi dialihkan ke ${value}! (${res.savedCount} mod diarsipkan, ${res.restoredCount} mod dipulihkan)`));
          } catch (err: any) {
            s.stop(pc.red('Gagal mengalihkan profil!'));
            p.log.error(err.message);
          }
        }
      } else if (key === 'defaultLoader' || key === 'loader') {
        instanceConfig.set('defaultLoader', value);
        const activeKey = cfg.activeInstance;
        const active = instanceConfig.getActiveInstance();
        if (activeKey && active) {
          const s = p.spinner();
          s.start(`Mengalihkan mod loader instance "${active.name}" ke ${value}...`);
          try {
            const res = await profileSnapshotManager.switchProfile(activeKey, value, active.gameVersion || '1.21.1');
            s.stop(pc.green(`Loader dialihkan ke ${value}! (${res.savedCount} mod diarsipkan, ${res.restoredCount} mod dipulihkan)`));
          } catch (err: any) {
            s.stop(pc.red('Gagal mengalihkan loader!'));
            p.log.error(err.message);
          }
        }
      } else if (key === 'defaultEnvironment' || key === 'env') {
        if (value !== 'client' && value !== 'server') {
          p.log.error('Environment harus "client" atau "server".');
          return;
        }
        instanceConfig.set('defaultEnvironment', value);
      } else {
        p.log.error(`Key "${key}" tidak valid.`);
        return;
      }

      await instanceConfig.save();
      p.outro(pc.green(`Konfigurasi "${key}" diatur ke "${value}".`));
      break;
    }

    default: {
      p.log.error(`Aksi "${action}" tidak dikenal. Gunakan: show | set | use`);
      break;
    }
  }
}
