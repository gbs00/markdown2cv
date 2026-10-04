# Changelog

## 0.1.1 — 2026-10-04

- Embed the original Source Han Sans CN font inside `main.js`, so the standard three-file Obsidian installation works offline without a separate font directory.
- Decode the font on first preview and reuse its bytes and FontFace across edits and PDF export.
- Include the source code MIT license and the font's full SIL OFL license and attribution in the installed bundle.
- Add validated release assets, deterministic manual-install ZIP, SHA-256 checksums and GitHub Actions checks.
- Set the minimum Obsidian version to the tested 1.13.7 and retain desktop-only support.
- Use the preview's owning window for UI timers, cross-window element checks, and CSS classes for fixed page dimensions.

## 0.1.0 — 2026-10-03

- Initial development version: native Markdown editing, live A4 preview, PDF export, a basic resume template and conservative framework repair.
- Source Han Sans CN typography, optional local photo, ribbon context menu and quiet preview status.
- Preview toolbar and 50–200% zoom added during development on 2026-10-04.
