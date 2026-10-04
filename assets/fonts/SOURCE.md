# Bundled Source Han Sans CN

- Copyright 2014–2025 Adobe. Reserved Font Name: Source.
- License: SIL Open Font License 1.1; unmodified official `LICENSE.txt` accompanies this file.
- Official release: https://github.com/adobe-fonts/source-han-sans/releases/tag/2.005R
- Pinned commit: `6c709ca72d3d7c46ab42ebecc1a26e7d69595a37`.
- Upstream file: `Variable/WOFF2/TTF/Subset/SourceHanSansCN-VF.ttf.woff2`.
- Download: https://raw.githubusercontent.com/adobe-fonts/source-han-sans/6c709ca72d3d7c46ab42ebecc1a26e7d69595a37/Variable/WOFF2/TTF/Subset/SourceHanSansCN-VF.ttf.woff2
- Font bytes: **7,711,988** (7.71 MB / 7.35 MiB).
- SHA-256: `f971e3bff46f76b49e1d5510556c2297c618ec4b491a295a4e741cdd38257799`.
- Upstream Git blob: `052b1aa5f1479c4aadbf40a6244aaffe5ba4c7c3` (verified against the downloaded file).
- License SHA-256: `fcac737e761ec63dbfbdce11030a1780161920d80315edba9c8beff1c2bac5a2`.

This is Adobe's complete, officially published Simplified Chinese regional subset, with common Latin letters and digits. The binary is preserved byte-for-byte: no sample-driven subsetting, conversion, modification, or internal font renaming. `MCV Source Han Sans CN` is only a CSS/FontFace alias isolating the plugin from installed system fonts.

The font contains 31,072 glyphs and maps 30,926 Unicode code points. Its variable weight axis spans 250–900. The plugin uses body Regular 400, section/company/project headings Medium 500, and name/explicit Markdown bold 700. Synthetic weight is disabled; synthetic italic remains available for Markdown emphasis. This is not universal Unicode coverage: for example, the rare character `𠮷` is outside this official CN resource. No promise of every possible name or non-Chinese writing system is made.

The SC variable TTF WOFF2 (14,129,688 bytes) and SC variable OTF WOFF2 (14,270,432 bytes) were rejected by this host's WOFF2 decoder. The official CN variable WOFF2 loads successfully. CN Regular/Medium/Bold static OTFs total 25,405,088 bytes and offer no advantage for the PDF character-mapping issue: both formats emit correct original text in PDF `/ActualText`, while some extractors ignore it. The selected CN variable resource is the smallest verified choice; no unused alternatives are distributed.

Starting with 0.1.1, the build verifies the font hash and embeds its unmodified bytes as base64 in `main.js`. The bundle also contains the full OFL license, copyright and this source record. The community installer therefore needs no extra asset directory or network download. The plugin decodes the font on first preview, caches its bytes and one loaded FontFace per document, and does not put the payload in the preview DOM. PDF HTML embeds the same bytes as a data URI. Both paths wait for all required weights and fail when the font is unavailable. Neither needs a system installation or CDN. The development deployment script removes the previous managed `fonts` directory when upgrading.
