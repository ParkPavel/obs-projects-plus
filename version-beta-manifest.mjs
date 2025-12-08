#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Get build number from command line argument
const buildNumber = process.argv[2];

if (!buildNumber) {
  console.error('Usage: node version-beta-manifest.mjs <build-number>');
  process.exit(1);
}

// Read manifest-beta.json
const manifestBetaPath = join(process.cwd(), 'manifest-beta.json');
const manifestBeta = JSON.parse(readFileSync(manifestBetaPath, 'utf8'));

// Read package.json for base version
const packageJsonPath = join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

// Extract base version (major.minor.patch)
const baseVersion = packageJson.version.split('-')[0];

// Create beta version: baseVersion-beta.buildNumber
const betaVersion = `${baseVersion}-beta.${buildNumber}`;

// Update manifest-beta.json
manifestBeta.version = betaVersion;

// Write file back
writeFileSync(manifestBetaPath, JSON.stringify(manifestBeta, null, 2) + '\n');

console.log(`Beta manifest version updated to ${betaVersion}`);
