import fs from 'node:fs';
import path from 'node:path';

const tag = process.env.REF_NAME || process.argv[2] || '';
const version = tag.replace(/^v/, '');

const changelogPath = path.resolve('CHANGELOG.md');
const content = fs.readFileSync(changelogPath, 'utf8');

const escapedVer = version.replace(/\./g, '\\.');
const regex = new RegExp(`## \\[${escapedVer}\\] - \\d{4}-\\d{2}-\\d{2}\\r?\\n([\\s\\S]*?)(?=\\r?\\n---|\\r?\\n## \\[|$)`);
const match = content.match(regex);
const notes = match ? match[1].trim() : `Release ${tag}`;

const table = `

---

### 📥 Download Binaries (Windows)

| File | Type | Description |
| :--- | :---: | :--- |
| **\`LoadModer-Setup-${version}.exe\`** | NSIS Installer | Standard Windows setup wizard with desktop shortcut & uninstaller |
| **\`LoadModer-${version}-Portable.exe\`** | Portable App | Standalone executable without installation (run directly) |
| **\`SHA256SUMS.txt\`** | Checksum | SHA-256 integrity verification file |
`;

const body = `# 📦 LoadModer ${tag}\n\n${notes}${table}`;

fs.mkdirSync('release', { recursive: true });
fs.writeFileSync(path.join('release', 'RELEASE_NOTES.md'), body, 'utf8');
console.log(`Successfully generated release/RELEASE_NOTES.md for ${tag}`);
