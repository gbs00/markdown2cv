"""Package the complete desktop development plugin for manual installation only."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / "manifest.json").read_text())
package = json.loads((root / "package.json").read_text())
assert manifest["id"] == "markdown-to-cv", "Unexpected plugin ID"
assert manifest["version"] == package["version"], "Package/manifest versions differ"
assert json.loads((root / "dist/manifest.json").read_text()) == manifest, "Rebuild first"
assert "sourceMappingURL=" not in (root / "dist/main.js").read_text(), "Use build:release"

files = [
    "main.js", "manifest.json", "styles.css",
    "fonts/SourceHanSansCN-VF.ttf.woff2", "fonts/LICENSE.txt", "fonts/SOURCE.md",
]
font = (root / "dist/fonts/SourceHanSansCN-VF.ttf.woff2").read_bytes()
assert hashlib.sha256(font).hexdigest() == "f971e3bff46f76b49e1d5510556c2297c618ec4b491a295a4e741cdd38257799", "Font checksum mismatch"

destination = root / "release"
destination.mkdir(exist_ok=True)
archive = destination / f"{manifest['id']}-{manifest['version']}-manual.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for name in files:
        output.write(root / "dist" / name, f"{manifest['id']}/{name}")

with zipfile.ZipFile(archive) as result:
    assert result.testzip() is None, "Archive corruption"
    assert result.namelist() == [f"{manifest['id']}/{name}" for name in files]
    for name in files:
        assert result.read(f"{manifest['id']}/{name}") == (root / "dist" / name).read_bytes()

digest = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix(".zip.sha256").write_text(f"{digest}  {archive.name}\n")
print(f"Manual-install ZIP: {archive} ({archive.stat().st_size:,} bytes)")
print("Verified all 6 files, bundled font, archive integrity and release build without sourcemap.")
print("Community-directory installation is not supported by this ZIP; see docs/RELEASING.md.")
