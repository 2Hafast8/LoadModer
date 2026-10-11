import { describe, it, expect } from 'vitest';
import { translations } from '../src/desktop/renderer/src/i18n/translations.js';

describe('Desktop i18n bilingual support', () => {
  it('should have complete dictionary parity between en and id', () => {
    const enSections = Object.keys(translations.en) as Array<keyof typeof translations.en>;
    const idSections = Object.keys(translations.id) as Array<keyof typeof translations.id>;

    expect(idSections.sort()).toEqual(enSections.sort());

    for (const section of enSections) {
      const enKeys = Object.keys(translations.en[section]).sort();
      const idKeys = Object.keys(translations.id[section]).sort();

      expect(idKeys).toEqual(enKeys);

      for (const key of enKeys) {
        const enVal = (translations.en[section] as any)[key];
        const idVal = (translations.id[section] as any)[key];

        expect(typeof enVal).toBe('string');
        expect(typeof idVal).toBe('string');
        expect(enVal.trim().length).toBeGreaterThan(0);
        expect(idVal.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('should have proper english defaults for critical labels', () => {
    expect(translations.en.topbar.mods).toBe('Mods');
    expect(translations.en.topbar.explore).toBe('Explore');
    expect(translations.en.topbar.instances).toBe('Instances');
    expect(translations.en.topbar.diagnostics).toBe('Diagnostics');
    expect(translations.en.common.install).toBe('Install');
    expect(translations.en.common.active).toBe('Active');
  });

  it('should have proper indonesian translations for critical labels', () => {
    expect(translations.id.topbar.mods).toBe('Mod');
    expect(translations.id.topbar.explore).toBe('Jelajahi');
    expect(translations.id.topbar.instances).toBe('Instance');
    expect(translations.id.topbar.diagnostics).toBe('Diagnostik');
    expect(translations.id.common.install).toBe('Pasang');
    expect(translations.id.common.active).toBe('Aktif');
  });
});
