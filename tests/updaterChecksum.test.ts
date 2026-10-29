import { describe, it, expect } from "vitest";
import { parseChecksumsContent, parseLatestYmlContent } from "../src/core/updater/githubRelease.js";

describe("GitHub Release Checksum Parser", () => {
  it("should parse standard sha256 lines (hash  filename)", () => {
    const raw = `
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  LoadModer-Setup-2.7.0.exe
ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  LoadModer-2.7.0-Portable.exe
`;
    const parsed = parseChecksumsContent(raw);
    expect(parsed["loadmoder-setup-2.7.0.exe"]).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(parsed["loadmoder-2.7.0-portable.exe"]).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("should parse PowerShell Get-FileHash Format-Table output", () => {
    const raw = `
Algorithm Hash                                                             Path
--------- ----                                                             ----
SHA256    E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855 C:\\Users\\runneradmin\\release\\LoadModer-Setup-2.7.0.exe
SHA256    BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD C:\\Users\\runneradmin\\release\\LoadModer-2.7.0-Portable.exe
`;
    const parsed = parseChecksumsContent(raw);
    expect(parsed["loadmoder-setup-2.7.0.exe"]).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(parsed["loadmoder-2.7.0-portable.exe"]).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("should return empty object on empty content", () => {
    expect(parseChecksumsContent("")).toEqual({});
  });

  it("should parse electron-builder latest.yml file entries", () => {
    const yml = `
version: 2.11.2
files:
  - url: LoadModer-Setup-2.11.2.exe
    sha512: +DLA174QZJSW8SskWl7/r7rYrHw2fu7U1lHTYuRNi+Ui/3rUoJWqwq6efSCnDld/3cMq539XqMEW0VzPcaWH/g==
    size: 84996570
path: LoadModer-Setup-2.11.2.exe
sha512: +DLA174QZJSW8SskWl7/r7rYrHw2fu7U1lHTYuRNi+Ui/3rUoJWqwq6efSCnDld/3cMq539XqMEW0VzPcaWH/g==
releaseDate: '2026-10-29T15:32:58.990Z'
`;
    const parsed = parseLatestYmlContent(yml);
    expect(parsed["loadmoder-setup-2.11.2.exe"]).toBeDefined();
    expect(parsed["loadmoder-setup-2.11.2.exe"].sha512).toBe("+DLA174QZJSW8SskWl7/r7rYrHw2fu7U1lHTYuRNi+Ui/3rUoJWqwq6efSCnDld/3cMq539XqMEW0VzPcaWH/g==");
    expect(parsed["loadmoder-setup-2.11.2.exe"].size).toBe(84996570);
  });
});

