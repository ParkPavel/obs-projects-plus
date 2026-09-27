#!/usr/bin/env node

// npm `version` lifecycle hook: npm has already written the selected version to
// package.json. Copy it verbatim to manifest.json and versions.json; never
// increment. Only strict x.y.z versions are mapped in versions.json.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const STRICT = /^\d+\.\d+\.\d+$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const read = (name) => JSON.parse(readFileSync(join(process.cwd(), name), 'utf8'));
const write = (name, value) =>
	writeFileSync(join(process.cwd(), name), JSON.stringify(value, null, 2) + '\n');

const packageJson = read('package.json');
const manifestJson = read('manifest.json');
const versionsJson = read('versions.json');

const version = packageJson.version;
if (typeof version !== 'string' || !SEMVER.test(version)) {
	console.error(`package.json version "${version}" is not a valid SemVer`);
	process.exit(1);
}

manifestJson.version = version;

for (const key of Object.keys(versionsJson)) {
	if (!STRICT.test(key)) delete versionsJson[key];
}
if (STRICT.test(version)) {
	versionsJson[version] = manifestJson.minAppVersion;
}

write('manifest.json', manifestJson);
write('versions.json', versionsJson);

console.log(`Version synchronized to ${version}`);
