import {describe, it, expect, beforeEach, afterEach, vi} from "vitest";
import {
  isLightTerminal,
  theme,
  clearScreen,
  showBanner,
  renderCommandCenterHeader,
  formatBadge,
} from "../src/ui/theme.js";
import {ui, renderFooter} from "../src/ui/interactive.js";
import {createModsTable, createSearchTable} from "../src/ui/tables.js";
import {p} from "../src/ui/prompts.js";

describe("UI/UX & Accessibility (Theme & Responsive)", () => {
  const originalEnv = {...process.env};

  beforeEach(() => {
    process.env = {...originalEnv};
    delete process.env.LOADMODER_THEME;
    delete process.env.COLORFGBG;
    delete process.env.ACCESSIBLE;
    delete process.env.NO_COLOR;
    delete process.env.CI;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Terminal Background & Theme Detection", () => {
    it("defaults to dark theme when no environment variable is set", () => {
      expect(isLightTerminal()).toBe(false);
      expect(theme.text).toBe("#f1f5f9");
      expect(theme.muted).toBe("#94a3b8");
    });

    it("activates light theme when LOADMODER_THEME=light", () => {
      process.env.LOADMODER_THEME = "light";
      expect(isLightTerminal()).toBe(true);
      expect(theme.text).toBe("#0f172a");
      expect(theme.primary).toBe("#0369a1");
    });

    it("respects LOADMODER_THEME=dark over light COLORFGBG", () => {
      process.env.LOADMODER_THEME = "dark";
      process.env.COLORFGBG = "0;15";
      expect(isLightTerminal()).toBe(false);
      expect(theme.text).toBe("#f1f5f9");
    });

    it("detects light background from COLORFGBG=0;15", () => {
      process.env.COLORFGBG = "0;15";
      expect(isLightTerminal()).toBe(true);
      expect(theme.text).toBe("#0f172a");
    });

    it("detects dark background from COLORFGBG=15;0", () => {
      process.env.COLORFGBG = "15;0";
      expect(isLightTerminal()).toBe(false);
      expect(theme.text).toBe("#f1f5f9");
    });
  });

  describe("WCAG 2.2 Relative Luminance & Contrast Compliance", () => {
    function hexToRgb(hex: string): [number, number, number] {
      const clean = hex.replace("#", "");
      return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
      ];
    }

    function relativeLuminance(rgb: [number, number, number]): number {
      const [r, g, b] = rgb.map((c) => {
        const val = c / 255;
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function contrastRatio(hex1: string, hex2: string): number {
      const l1 = relativeLuminance(hexToRgb(hex1));
      const l2 = relativeLuminance(hexToRgb(hex2));
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    it("ensures all dark theme text tokens satisfy WCAG AA >= 4.5:1 on black", () => {
      process.env.LOADMODER_THEME = "dark";
      const bg = "#000000";
      expect(contrastRatio(theme.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.textMuted, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.muted, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.primary, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.secondary, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.success, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.warning, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.error, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.info, bg)).toBeGreaterThanOrEqual(4.5);
    });

    it("ensures light theme text tokens satisfy WCAG AA >= 4.5:1 on white", () => {
      process.env.LOADMODER_THEME = "light";
      const bg = "#ffffff";
      expect(contrastRatio(theme.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.textMuted, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.muted, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.primary, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.secondary, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.success, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.warning, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.error, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.info, bg)).toBeGreaterThanOrEqual(4.5);
    });

    it("respects NO_COLOR standard by falling back to accessible plain screen clear", () => {
      process.env.NO_COLOR = "1";
      const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      clearScreen();
      expect(stdoutSpy).toHaveBeenCalledWith("\x1B[2J\x1B[H");
      expect(stdoutSpy).not.toHaveBeenCalledWith(expect.stringContaining("\x1B[3J"));
    });
  });

  describe("Interactive UI Proxy Synchronization", () => {
    it("proxies ui tokens to active theme dynamically", () => {
      process.env.LOADMODER_THEME = "dark";
      expect(ui.accent).toBe(theme.primary);
      expect(ui.text).toBe("#f1f5f9");

      process.env.LOADMODER_THEME = "light";
      expect(ui.accent).toBe(theme.primary);
      expect(ui.text).toBe("#0f172a");
    });

    it("renders footer containing cancel navigation hints", () => {
      const footer = renderFooter();
      expect(footer).toContain("Batal/Kembali");
    });
  });

  describe("Scrollback & Banner Accessibility", () => {
    it("preserves terminal scrollback buffer in clearScreen when ACCESSIBLE=true", () => {
      process.env.ACCESSIBLE = "true";
      const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      clearScreen();
      expect(stdoutSpy).toHaveBeenCalledWith("\x1B[2J\x1B[H");
      expect(stdoutSpy).not.toHaveBeenCalledWith(expect.stringContaining("\x1B[3J"));
    });

    it("clears terminal screen and scrollback buffer in normal mode", () => {
      const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      clearScreen();
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("\x1B[3J"));
    });

    it("suppresses multi-line ASCII banner when ACCESSIBLE=true", () => {
      process.env.ACCESSIBLE = "true";
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      showBanner("test-instance", false);
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("LOADMODER");
      expect(output).toContain("v2.0.0");
    });
  });

  describe("Responsive Tables", () => {
    it("constructs mods table without throwing", () => {
      const table = createModsTable();
      expect(table).toBeDefined();
    });

    it("constructs search table without throwing", () => {
      const table = createSearchTable();
      expect(table).toBeDefined();
    });
  });

  describe("Command Center Header & Badges", () => {
    it("formats badges with brackets and color coding", () => {
      const badge = formatBadge("31 mod", "success");
      expect(badge).toContain("[31 mod]");
    });

    it("renders compact accessible header when ACCESSIBLE=true", () => {
      process.env.ACCESSIBLE = "true";
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      renderCommandCenterHeader({
        instanceName: "Test Instance",
        gameVersion: "1.20.1",
        loader: "fabric",
        modsCount: 10,
        activeCount: 8,
        storageUsage: "12 MB",
      });
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("LOADMODER v2.0.0");
      expect(output).toContain("Test Instance");
      expect(output).toContain("fabric 1.20.1");
      expect(output).toContain("8/10");
    });

    it("renders styled command center box without throwing in normal mode", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      renderCommandCenterHeader({
        instanceName: "My Pack",
        gameVersion: "1.20.4",
        loader: "forge",
        modsCount: 5,
        activeCount: 5,
        storageUsage: "20 MB",
        showAscii: true,
      });
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("STATUS INSTANCE");
      expect(output).toContain("My Pack");
      expect(output).toContain("Minecraft Mod & Modpack Manager");
    });

    it("renders compact box without ASCII art when showAscii=false", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      renderCommandCenterHeader({
        instanceName: "Compact Pack",
        gameVersion: "1.21",
        loader: "neoforge",
        modsCount: 15,
        activeCount: 12,
        storageUsage: "35 MB",
        showAscii: false,
      });
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("Compact Pack");
      expect(output).toContain("neoforge 1.21");
    });

    it("renders launcher mode (default / modpack) correctly in header", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      renderCommandCenterHeader({
        instanceName: "TLauncher",
        gameVersion: "1.20.1",
        loader: "fabric",
        mode: "modpack",
        activeContainer: "mypack(fabric)",
        modsCount: 15,
        activeCount: 15,
      });
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("TLauncher");
      expect(output).toContain("modpack (mypack(fabric))");
    });
  });

  describe("safeSpinner Listener Lifecycle & Leak Prevention", () => {
    it("membersihkan listener SIGINT dan SIGTERM dari process saat stop() dipanggil", () => {
      const initialSigint = process.listenerCount("SIGINT");
      const initialSigterm = process.listenerCount("SIGTERM");

      const s = p.spinner();
      s.start("testing spinner");
      s.stop("done spinner");

      expect(process.listenerCount("SIGINT")).toBe(initialSigint);
      expect(process.listenerCount("SIGTERM")).toBe(initialSigterm);
    });

    it("tidak mengakumulasi listener saat membuat dan menghentikan lebih dari 15 spinner berturut-turut", () => {
      const initialSigint = process.listenerCount("SIGINT");
      const initialSigterm = process.listenerCount("SIGTERM");

      for (let i = 0; i < 15; i++) {
        const s = p.spinner();
        s.start(`spinner step ${i}`);
        s.stop(`done step ${i}`);
      }

      expect(process.listenerCount("SIGINT")).toBe(initialSigint);
      expect(process.listenerCount("SIGTERM")).toBe(initialSigterm);
    });

    it("otomatis membersihkan listener sebelumnya jika spinner baru dibuat tanpa stop manual", () => {
      const initialSigint = process.listenerCount("SIGINT");

      p.spinner(); // Dibuat tanpa stop manual
      const s2 = p.spinner();
      s2.start("step 2");
      s2.stop("done 2");

      expect(process.listenerCount("SIGINT")).toBe(initialSigint);
    });
  });

  describe("Interactive Menu Separator & Non-selectable Guard", () => {
    it("converts sep, sep_*, sep:*, and dash lines into unselectable Separator objects", async () => {
      const { formatInquirerChoices } = await import("../src/ui/interactive.js");
      const { Separator } = await import("@inquirer/prompts");

      const choices = formatInquirerChoices([
        { name: "Option 1", value: "opt1" },
        { name: "WADAH KHUSUS", value: "sep_containers" },
        { name: "──────────────────", value: "sep" },
        { name: "Option 2", value: "opt2" },
      ]);

      expect(choices[0].value).toBe("opt1");
      expect(choices[1] instanceof Separator).toBe(true);
      expect(choices[2] instanceof Separator).toBe(true);
      expect(choices[3].value).toBe("opt2");
    });
  });
});
