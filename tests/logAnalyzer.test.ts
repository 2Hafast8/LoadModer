import { describe, it, expect } from 'vitest';
import { LogAnalyzer } from '../src/core/troubleshoot/logAnalyzer.js';

describe('LogAnalyzer domain logic', () => {
  const analyzer = new LogAnalyzer();

  it('detects missing dependencies correctly', () => {
    const log = `
      [12:00:00] [main/ERROR]: Failed to start Minecraft
      net.fabricmc.loader.impl.FormattedException: Some of your mods have failed to start:
      - Mod 'iris' requires fabric-api of fabric-api, which is missing!
    `;
    const res = analyzer.parseLogContent(log, 'crash-reports/crash.txt', true);

    expect(res.hasCrash).toBe(true);
    expect(res.category).toBe('missing_dependency');
    expect(res.culprit).toBe('fabric-api');
    expect(res.action?.type).toBe('install');
  });

  it('detects mixin conflicts correctly', () => {
    const log = `
      [12:00:00] [main/FATAL]: Mixin apply failed sodium.mixins.json:features.buffer.MixinBufferBuilder from mod sodium -> net.minecraft.class_287
      org.spongepowered.asm.mixin.transformer.throwables.MixinTransformerError: Critical injection failure
    `;
    const res = analyzer.parseLogContent(log, 'logs/latest.log', false);

    expect(res.hasCrash).toBe(true);
    expect(res.category).toBe('incompatible_mod');
    expect(res.culprit).toBe('sodium');
    expect(res.action?.type).toBe('disable');
  });

  it('detects out of memory exceptions', () => {
    const log = `
      Exception in thread "main" java.lang.OutOfMemoryError: Java heap space
      at java.base/java.util.Arrays.copyOf(Arrays.java:3537)
    `;
    const res = analyzer.parseLogContent(log, 'crash-reports/crash.txt', true);

    expect(res.hasCrash).toBe(true);
    expect(res.category).toBe('out_of_memory');
    expect(res.culprit).toContain('Memory');
  });

  it('detects java version mismatch', () => {
    const log = `
      java.lang.UnsupportedClassVersionError: net/coderbot/iris/Iris has been compiled by a more recent version of the Java Runtime (class file version 65.0)
    `;
    const res = analyzer.parseLogContent(log, 'crash-reports/crash.txt', true);

    expect(res.hasCrash).toBe(true);
    expect(res.category).toBe('java_version');
  });

  it('handles clean log without fatal errors', () => {
    const log = `
      [12:00:00] [main/INFO]: Setting user: Player
      [12:00:01] [main/INFO]: Loaded 50 mods
      [12:00:02] [main/INFO]: Sound engine started
    `;
    const res = analyzer.parseLogContent(log, 'logs/latest.log', false);

    expect(res.hasCrash).toBe(false);
    expect(res.category).toBeUndefined();
  });
});
