import { readFileSync } from 'node:fs';
import path from 'node:path';
import { verifyReleaseArtifacts } from './lib/release-verification.mjs';

const root = process.cwd();
const config = JSON.parse(readFileSync(path.join(root, 'updates/release.config.json'), 'utf8'));
const manifestPath = path.join(root, 'updates/dist/releases', config.channel, config.version, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const bundlePath = path.join(path.dirname(manifestPath), 'bundle.zip');
const publicKey = readFileSync(path.join(root, '.capgo_key_v2.pub'), 'utf8');

verifyReleaseArtifacts(manifest, readFileSync(bundlePath), publicKey);
console.log(`[ota-verify] Verified ${manifest.channel} ${manifest.version}: immutable hash and public-key checksum authentication passed.`);
