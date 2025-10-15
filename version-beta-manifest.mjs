import fs from "fs";

if (process.argv.length === 2) {
  console.error("Missing build number");
  process.exit(1);
}

const buildNumber = process.argv[2];

fs.readFile("manifest.json", "utf8", (err, data) => {
  if (err) {
    console.error(`Error reading file from disk: ${err}`);
  } else {
    const manifest = JSON.parse(data);

    // Derive beta version from current manifest version.
    // If version already contains a pre-release, normalize to `x.y.z-beta.<build>`.
    // Otherwise, append `-beta.<build>` to the current version.
    const baseVersion = String(manifest.version).split("-")[0];
    manifest.version = `${baseVersion}-beta.${buildNumber}`;

    fs.writeFile("manifest-beta.json", JSON.stringify(manifest, null, 2), (err) => {
      if (err) console.log(err);
      else {
        console.log("manifest-beta.json written\n");
      }
    });

    // Also update versions.json so beta version maps to the same minAppVersion.
    try {
      const versionsRaw = fs.readFileSync("versions.json", "utf8");
      const versions = JSON.parse(versionsRaw);
      versions[manifest.version] = manifest.minAppVersion ?? versions[manifest.version];
      fs.writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));
      console.log("versions.json updated with", manifest.version);
    } catch (e) {
      console.warn("Could not update versions.json:", e?.message ?? e);
    }
  }
});
