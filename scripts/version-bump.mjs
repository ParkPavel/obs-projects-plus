#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Read package.json
const packageJsonPath = join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

// Read manifest.json
const manifestJsonPath = join(process.cwd(), 'manifest.json');
const manifestJson = JSON.parse(readFileSync(manifestJsonPath, 'utf8'));

// Read versions.json
const versionsJsonPath = join(process.cwd(), 'versions.json');
const versionsJson = JSON.parse(readFileSync(versionsJsonPath, 'utf8'));

// Extract version parts
const [major, minor, patch] = packageJson.version.split('.').map(Number);

// Increment patch version
const newVersion = `${major}.${minor}.${patch + 1}`;

// Update package.json
packageJson.version = newVersion;

// Update manifest.json
manifestJson.version = newVersion;

// Update versions.json
versionsJson[packageJson.name] = newVersion;

// Write files back
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2) + '\n');
writeFileSync(versionsJsonPath, JSON.stringify(versionsJson, null, 2) + '\n');

console.log(`Version bumped to ${newVersion}`);