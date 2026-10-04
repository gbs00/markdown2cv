"""Validate and package the exact three files installed by the community directory."""
from pathlib import Path
import base64
import hashlib
import json
import re
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / "manifest.json").read_text())
package = json.loads((root / "package.json").read_text())
versions = json.loads((root / "versions.json").read_text())
assert manifest["id"] == "markdown-to-cv", "Unexpected plugin ID"
assert re.fullmatch(r"\d+\.\d+\.\d+", manifest["version"]), "Use x.y.z versions"
assert manifest["version"] == package["version"], "Package/manifest versions differ"
assert versions[manifest["version"]] == manifest["minAppVersion"], "Compatibility map differs"
assert manifest["isDesktopOnly"] is True, "Electron export requires desktop"
assert len(manifest["description"]) <= 250 and manifest["description"].endswith(".")
assert json.loads((root / "dist/manifest.json").read_text()) == manifest, "Rebuild first"
bundle = (root / "dist/main.js").read_text()
assert "sourceMappingURL=" not in bundle, "Use build:release"
assert (root / "LICENSE").read_text() in bundle, "MIT license missing from installed files"
assert (root / "assets/fonts/LICENSE.txt").read_text() in bundle, "Font license missing"
assert (root / "assets/fonts/SOURCE.md").read_text() in bundle, "Font attribution missing"
payload = re.findall(r'"([A-Za-z0-9+/]{1000000,}={0,2})"', bundle)
assert len(payload) == 1, "Expected exactly one embedded font"
font = base64.b64decode(payload[0], validate=True)
assert font == (root / "assets/fonts/SourceHanSansCN-VF.ttf.woff2").read_bytes()
assert hashlib.sha256(font).hexdigest() == "f971e3bff46f76b49e1d5510556c2297c618ec4b491a295a4e741cdd38257799"

files = ["main.js", "manifest.json", "styles.css"]
assert sorted(p.name for p in (root / "dist").iterdir()) == sorted(files), "Unexpected build assets"
destination = root / "release" / manifest["version"]
destination.mkdir(parents=True, exist_ok=True)
for name in files:
    shutil.copyfile(root / "dist" / name, destination / name)
archive = destination / f"{manifest['id']}-{manifest['version']}.zip"
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for name in files:
        entry = zipfile.ZipInfo(f"{manifest['id']}/{name}", date_time=(1980, 1, 1, 0, 0, 0))
        entry.external_attr = 0o100644 << 16
        entry.compress_type = zipfile.ZIP_DEFLATED
        output.writestr(entry, (destination / name).read_bytes(), compresslevel=9)

with zipfile.ZipFile(archive) as result:
    assert result.testzip() is None, "Archive corruption"
    assert result.namelist() == [f"{manifest['id']}/{name}" for name in files]
    for name in files:
        assert result.read(f"{manifest['id']}/{name}") == (destination / name).read_bytes()

checksums = []
for file in [*(destination / name for name in files), archive]:
    checksums.append(f"{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.name}")
(destination / "SHA256SUMS.txt").write_text("\n".join(checksums) + "\n")
print(f"Release assets: {destination}")
print(f"ZIP: {archive.name} ({archive.stat().st_size:,} bytes)")
print("Verified 3-file installation, original embedded font, both licenses, versions and ZIP integrity.")
