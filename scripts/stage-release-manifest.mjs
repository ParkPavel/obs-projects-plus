#!/usr/bin/env node

// Usage: stage-release-manifest.mjs <tag> <output-dir>
// Validates a release tag against the committed metadata and writes the release
// manifest copy to <output-dir>/manifest.json. Never touches tracked files.

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const STABLE = /^(\d+)\.(\d+)\.(\d+)$/;
const BETA = /^(\d+)\.(\d+)\.(\d+)-beta\.\d+$/;

const fail = (reason) => {
	console.error(`stage-release-manifest: ${reason}`);
	process.exit(1);
};

const [tag, outputDir] = process.argv.slice(2);
if (!tag || !outputDir) fail('usage: stage-release-manifest.mjs <tag> <output-dir>');

const read = (name) => {
	try {
		return JSON.parse(readFileSync(join(process.cwd(), name), 'utf8'));
	} catch (e) {
		return fail(`cannot read ${name}: ${e.message}`);
	}
};

const packageJson = read('package.json');
const manifest = read('manifest.json');
const versions = read('versions.json');

const committed = manifest.version;
if (packageJson.version !== committed) {
	fail(`package.json (${packageJson.version}) and manifest.json (${committed}) versions differ`);
}
const current = STABLE.exec(committed);
if (!current) fail(`committed version "${committed}" is not a strict x.y.z`);

const stable = STABLE.exec(tag);
const beta = BETA.exec(tag);
if (!stable && !beta) fail(`tag "${tag}" is neither x.y.z nor x.y.z-beta.N`);

let staged = manifest;
if (stable) {
	if (tag !== committed) fail(`stable tag ${tag} differs from committed version ${committed}`);
	if (versions[tag] !== manifest.minAppVersion) {
		fail(`versions.json does not map ${tag} to minAppVersion ${manifest.minAppVersion}`);
	}
} else {
	const core = beta.slice(1, 4).map(Number);
	const base = current.slice(1, 4).map(Number);
	const greater = core.some((n, i) => (core.slice(0, i).every((m, j) => m === base[j]) ? n > base[i] : false));
	if (!greater) fail(`beta core ${core.join('.')} must be greater than committed ${committed}`);
	staged = { ...manifest, version: tag };
}

const dir = resolve(process.cwd(), outputDir);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(staged, null, 2) + '\n');
console.log(`Staged manifest ${staged.version} in ${dir}`);
