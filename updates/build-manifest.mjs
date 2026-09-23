import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ID = 'org.readyall.logbookcompanion';
const UPDATE_ORIGIN = 'https://updates.logbook.readyall.org';
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '..');
const webDirectory = path.join(directory, 'web');
const outputDirectory = path.join(directory, 'dist');
const configPath = path.join(directory, 'release.config.json');

function fail(message) {
  throw new Error(`[ota-build] ${message}`);
}

function readConfig() {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (config.schemaVersion !== 1) fail('Unsupported release configuration schema.');
  if (!/^[a-z][a-z0-9-]*$/.test(config.channel)) fail('Channel must be a lowercase slug.');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(config.version)) fail('Bundle version must be semver.');
  if (!Number.isSafeInteger(config.releaseSequence) || config.releaseSequence < 1) fail('Release sequence must be a positive integer.');
  if (!config.compatibleNativeVersions.length) fail('At least one compatible native version is required.');
  return config;
}

function signingKey(tempDirectory) {
  const configuredPath = process.env.OTA_PRIVATE_KEY_FILE;
  if (configuredPath) {
    const resolved = path.resolve(root, configuredPath);
    if (!existsSync(resolved)) fail('OTA_PRIVATE_KEY_FILE does not exist.');
    return resolved;
  }
  const encoded = process.env.OTA_PRIVATE_KEY_BASE64;
  if (!encoded) fail('Enabled OTA releases require OTA_PRIVATE_KEY_BASE64 or OTA_PRIVATE_KEY_FILE.');
  const privateKeyPath = path.join(tempDirectory, 'ota-private.key');
  writeFileSync(privateKeyPath, Buffer.from(encoded, 'base64'), { mode: 0o600 });
  chmodSync(privateKeyPath, 0o600);
  return privateKeyPath;
}

function capgo(arguments_) {
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const output = execFileSync(executable, ['--yes', '@capgo/cli@8.64.1', ...arguments_], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const jsonStart = output.indexOf('{');
  if (jsonStart < 0) fail(`Capgo command returned no JSON: ${arguments_.join(' ')}`);
  return JSON.parse(output.slice(jsonStart));
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function writeOffer(offer) {
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(path.join(outputDirectory, 'release-offer.json'), `${JSON.stringify(offer, null, 2)}\n`);
}

const config = readConfig();
rmSync(outputDirectory, { recursive: true, force: true });

if (!config.enabled && process.env.OTA_FORCE_BUILD !== 'true') {
  writeOffer({ ...config, enabled: false });
  console.log(`[ota-build] ${config.channel} is halted; emitted a no-update offer.`);
  process.exit(0);
}

if (!existsSync(path.join(webDirectory, 'index.html'))) fail('Run the OTA web build before creating a release.');

const commit = process.env.VERCEL_GIT_COMMIT_SHA
  ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const baseUrl = process.env.OTA_BASE_URL ?? UPDATE_ORIGIN;
if (baseUrl !== UPDATE_ORIGIN) fail(`OTA_BASE_URL must equal the pinned origin ${UPDATE_ORIGIN}.`);

const releaseMetadata = {
  schemaVersion: 1,
  appId: APP_ID,
  channel: config.channel,
  version: config.version,
  releaseSequence: config.releaseSequence,
  commit,
  compatibleNativeVersions: config.compatibleNativeVersions,
  platforms: config.platforms,
};
writeFileSync(path.join(webDirectory, 'ota-release.json'), `${JSON.stringify(releaseMetadata, null, 2)}\n`);

const tempDirectory = mkdtempSync(path.join(tmpdir(), 'lc-ota-'));
try {
  const plainZip = path.join(tempDirectory, 'bundle.zip');
  const zipped = capgo([
    'bundle', 'zip', APP_ID,
    '--path', webDirectory,
    '--bundle', config.version,
    '--name', plainZip,
    '--json',
    '--key-v2',
    '--package-json', 'package.json',
  ]);
  if (!zipped.checksum || !existsSync(zipped.filename)) fail('Capgo did not produce a valid bundle ZIP.');

  const encrypted = capgo([
    'bundle', 'encrypt', zipped.filename, zipped.checksum,
    '--key', signingKey(tempDirectory),
    '--json',
    '--package-json', 'package.json',
  ]);
  if (!encrypted.checksum || !encrypted.ivSessionKey || !existsSync(encrypted.filename)) {
    fail('Capgo did not produce authenticated encrypted bundle metadata.');
  }

  const releaseDirectory = path.join(outputDirectory, 'releases', config.channel, config.version);
  mkdirSync(releaseDirectory, { recursive: true });
  const bundlePath = path.join(releaseDirectory, 'bundle.zip');
  copyFileSync(encrypted.filename, bundlePath);
  const bundleUrl = `${UPDATE_ORIGIN}/releases/${encodeURIComponent(config.channel)}/${encodeURIComponent(config.version)}/bundle.zip`;
  const offer = {
    ...config,
    enabled: true,
    commit,
    bundleSha256: sha256(bundlePath),
    capgoPlaintextChecksum: zipped.checksum,
    capgo: {
      url: bundleUrl,
      checksum: encrypted.checksum,
      session_key: encrypted.ivSessionKey,
    },
  };
  writeFileSync(path.join(releaseDirectory, 'manifest.json'), `${JSON.stringify(offer, null, 2)}\n`);
  writeOffer(offer);
  console.log(`[ota-build] Built ${config.channel} ${config.version} from ${commit.slice(0, 12)}.`);
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
