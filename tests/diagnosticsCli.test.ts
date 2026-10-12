import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { diagnoseCommand } from '../src/commands/diagnose.js';

describe('CLI Diagnostics Command (diagnose / diagnostics)', () => {
  let tempDir: string;
  let consoleSpy: any;
  let loggedOutput: string[];

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'lm-diag-test-'));
    loggedOutput = [];
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      loggedOutput.push(args.join(' '));
    });
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('outputs clean JSON report when no crash or errors exist', async () => {
    await diagnoseCommand({ dir: tempDir, json: true });

    expect(loggedOutput.length).toBeGreaterThan(0);
    const parsed = JSON.parse(loggedOutput[0]);
    expect(parsed.hasCrash).toBe(false);
  });

  it('outputs parsed crash report in JSON format when crash report exists', async () => {
    const crashDir = path.join(tempDir, 'crash-reports');
    await mkdir(crashDir, { recursive: true });
    const crashContent = `
---- Minecraft Crash Report ----
// Don't do that.

Time: 2026-10-12 12:00:00
Description: Initializing game

net.fabricmc.loader.impl.FormattedException: Some of your mods have failed to start:
 - Mod 'iris' requires fabric-api of fabric-api, which is missing!
    `;
    await writeFile(path.join(crashDir, 'crash-2026-10-12_12.00.00-client.txt'), crashContent, 'utf8');

    await diagnoseCommand({ dir: tempDir, json: true });

    expect(loggedOutput.length).toBeGreaterThan(0);
    const parsed = JSON.parse(loggedOutput[0]);
    expect(parsed.hasCrash).toBe(true);
    expect(parsed.category).toBe('missing_dependency');
    expect(parsed.culprit).toBe('fabric-api');
    expect(parsed.action?.type).toBe('install');
  });

  it('outputs raw log string when --raw is specified', async () => {
    const logsDir = path.join(tempDir, 'logs');
    await mkdir(logsDir, { recursive: true });
    const logText = '[12:00:00] [main/INFO]: Minecraft started successfully.';
    await writeFile(path.join(logsDir, 'latest.log'), logText, 'utf8');

    await diagnoseCommand({ dir: tempDir, raw: true });

    expect(loggedOutput.length).toBeGreaterThan(0);
    expect(loggedOutput[0]).toContain('Minecraft started successfully.');
  });

  it('outputs raw log in JSON wrapper when both --raw and --json are specified', async () => {
    const logsDir = path.join(tempDir, 'logs');
    await mkdir(logsDir, { recursive: true });
    const logText = '[12:00:00] [main/INFO]: Test log output.';
    await writeFile(path.join(logsDir, 'latest.log'), logText, 'utf8');

    await diagnoseCommand({ dir: tempDir, raw: true, json: true });

    expect(loggedOutput.length).toBeGreaterThan(0);
    const parsed = JSON.parse(loggedOutput[0]);
    expect(parsed.log).toContain('Test log output.');
  });
});

