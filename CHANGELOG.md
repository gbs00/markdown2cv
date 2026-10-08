# Changelog

## Unreleased

- Create resumes in the folder selected in the core File Explorer or Notebook Navigator; otherwise use the current note (or preview source) folder, then the vault root.
- Add a New resume action to folder/file context menus, and stop old sidebar selections from overriding a newly opened note.

## 0.1.2 — 2026-10-05

- Coalesce editor reads and skip repeated previews when content, resources, and owning document are unchanged.
- Track body image dependencies as well as the profile photo; retry unresolved attachments when resource metadata becomes available.
- Separate cancellation/timeout utilities from Markdown adaptation and release pending operations on PDF-service disposal.
- Release font registrations when popout windows close; reuse the bundled font's encoded data for export.
- Remove repeated full-tail scans in blank-field handling and unnecessary DOM cloning during long-paragraph pagination.
- Clean up image loading/conversion on cancellation and encode repeated local images only once per export.
- Make production the default build; keep debug sourcemaps explicit, refresh static assets in watch mode, and remove duplicate typechecking.
- Add cancellation, font lifecycle, PDF lifecycle, and real-host render-deduplication regression coverage.
- Add English installation, usage, data-access and compatibility documentation.

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
