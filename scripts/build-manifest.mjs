#!/usr/bin/env node

// Usage (from the repository): build-manifest.mjs <build-dir>
// Writes <build-dir>/build-manifest.json: which commit, which branch, whether the
// working tree had uncommitted changes (and which), the SHA-256 of main.js and
// styles.css, the plugin version and the time. A build put in front of a person
// for acceptance is identified by this file and nothing else (w4-p00, audit F01/F20).
// Never touches tracked files.

import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const fail = (reason) => {
	console.error(`build-manifest: ${reason}`);
	process.exit(1);
};

const [buildArg] = process.argv.slice(2);
if (!buildArg) fail('usage: build-manifest.mjs <build-dir>');
const buildDir = resolve(process.cwd(), buildArg);

// A git that dies before saying anything (Windows reports 0xC0000005 when the
// machine cannot start processes) is retried; a git that explains itself is not.
const gitRaw = (args) => {
	let last = null;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
		} catch (e) {
			last = e;
			if (String(e.stderr ?? '').trim()) break;
		}
	}
	const said = String(last?.stderr ?? '').trim();
	return fail(`git ${args.join(' ')} failed (exit ${last?.status ?? last?.code ?? '?'})${said ? `: ${said}` : ' without output'}`);
};
const git = (args) => gitRaw(args).trim();

const sha256 = (name) => {
	const file = join(buildDir, name);
	if (!existsSync(file)) fail(`${name} is missing in ${buildDir}`);
	return createHash('sha256').update(readFileSync(file)).digest('hex');
};

const head = git(['rev-parse', 'HEAD']);
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
// -z: NUL-separated, never quoted, and not trimmed — the two status columns
// lead with a space (" M file"), so trimming would eat into the first name.
// A rename entry is followed by its source path, which is skipped.
const changes = [];
const entries = gitRaw(['status', '--porcelain=v1', '-z', '--untracked-files=all']).split('\0');
for (let i = 0; i < entries.length; i++) {
	const entry = entries[i];
	if (entry.length < 4) continue;
	changes.push(entry.slice(3));
	if (entry[0] === 'R' || entry[0] === 'C') i++;
}

const manifestFile = existsSync(join(buildDir, 'manifest.json')) ? join(buildDir, 'manifest.json') : join(process.cwd(), 'manifest.json');
let version = null;
try {
	version = JSON.parse(readFileSync(manifestFile, 'utf8')).version ?? null;
} catch {
	fail(`cannot read ${manifestFile}`);
}

const record = {
	schemaVersion: 1,
	head,
	branch,
	dirty: changes.length > 0,
	changes,
	files: { 'main.js': sha256('main.js'), 'styles.css': sha256('styles.css') },
	version,
	builtAt: new Date().toISOString(),
};
writeFileSync(join(buildDir, 'build-manifest.json'), JSON.stringify(record, null, 2) + '\n');
console.log(`build-manifest: ${head.slice(0, 8)}${record.dirty ? ' + uncommitted changes' : ''} main.js ${record.files['main.js'].slice(0, 8)}`);
