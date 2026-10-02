# Security Policy

The LoadModer team takes the security of our application, user environments, and Minecraft instances seriously.

---

## Supported Versions

| Version | Supported          |
| :------ | :----------------- |
| `2.x.x` | :white_check_mark: |
| `< 2.0` | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability within LoadModer, please **do not** disclose it publicly via GitHub Issues.

Instead, please report security issues responsibly via:

1. **GitHub Private Security Advisory:**  
   Navigate to the [Security Advisories tab](https://github.com/2Hafast8/LoadModer/security/advisories/new) and submit a private report.

2. **Direct Contact:**  
   Send an email with the subject `[SECURITY] LoadModer Vulnerability Report` to the repository maintainer.

### What to Include in Your Report:

- A clear description of the vulnerability.
- Steps to reproduce or proof-of-concept (PoC).
- Impact assessment (e.g., path traversal, SSRF, arbitrary file write).
- Affected versions or platforms (Windows, Linux, macOS).

---

## Response Timeline

- **Initial Acknowledgment:** Within 48 hours.
- **Triage & Reproduction:** Within 5 business days.
- **Fix & Advisory Release:** Coordinated with the reporter prior to public disclosure.

---

## Security Architecture Highlights

LoadModer enforces strict defensive controls:
- **Zip-Slip & Path Traversal Prevention:** Remote modpack archive paths are sanitized against traversal attacks.
- **SSRF Mitigation:** Download targets are strictly restricted to trusted Modrinth CDN and Mojang domain endpoints.
- **Streaming Integrity Verification:** Remote files are downloaded to temporary `.part` buffers and verified against SHA-512 checksums before moving to final destinations.
- **Atomic State Persistence:** All critical states are written using `write-file-atomic` to prevent partial corruption.
