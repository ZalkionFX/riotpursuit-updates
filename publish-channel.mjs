import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repo = 'ZalkionFX/riotpursuit-updates';
const token = process.env.GITHUB_TOKEN;
if (process.env.GITHUB_REPOSITORY !== repo || !token) throw Error('This publisher runs only in the official repository.');
const tag = process.env.RELEASE_TAG;
if (!tag || !/^v[0-9A-Za-z._-]+$/.test(tag)) throw Error('Invalid release tag.');
const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
const releaseResponse = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers });
if (!releaseResponse.ok) throw Error(`Release lookup failed: ${releaseResponse.status}`);
const release = await releaseResponse.json();
if (release.draft) throw Error('Draft releases are never distributed.');
const channel = release.prerelease ? 'beta' : 'stable';
const manifestAsset = release.assets.find(asset => asset.name === 'manifest.json');
if (!manifestAsset) throw Error('Upload manifest.json with the three signed APKs before publishing.');
const manifestResponse = await fetch(manifestAsset.browser_download_url);
if (!manifestResponse.ok) throw Error('Manifest download failed.');
const manifest = await manifestResponse.json();
const certificate = 'd6ec0e23e0b9d82c69e812708d479d8741fc2b3168c76d9e41a2fb6312af412d';
if (manifest.schemaVersion !== 1 || manifest.channel !== channel || manifest.packageName !== 'com.riotpursuit.riotpursuit_members' || manifest.certificateSha256 !== certificate || !Number.isInteger(manifest.buildNumber)) throw Error('Invalid manifest or channel.');
const sdkTools = path.join(process.env.ANDROID_HOME, 'build-tools');
const tools = path.join(sdkTools, readdirSync(sdkTools).filter(name => /^\d+\.\d+\.\d+$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1));
const temporary = path.join(process.env.RUNNER_TEMP, 'riot-apk-verification'); mkdirSync(temporary, { recursive: true });
for (const [abi, offset] of [['armeabi-v7a', 1000], ['arm64-v8a', 2000], ['x86_64', 4000]]) {
  const artifact = manifest.artifacts?.[abi];
  const asset = release.assets.find(item => item.browser_download_url === artifact?.url);
  if (!asset || artifact.size !== asset.size || artifact.size < 1_000_000 || artifact.size > 350_000_000 || artifact.versionCode !== offset + manifest.buildNumber || !/^[a-f0-9]{64}$/.test(artifact.sha256) || !asset.name.endsWith('.apk')) throw Error(`Invalid ${abi} artifact.`);
  const response = await fetch(asset.browser_download_url);
  if (!response.ok || !response.body) throw Error(`Download failed: ${abi}`);
  const hash = createHash('sha256'); let size = 0;
  const file = path.join(temporary, `${abi}.apk`);
  await pipeline(Readable.fromWeb(response.body), new Transform({ transform(chunk, _, next) { size += chunk.length; if (size > artifact.size) return next(Error('Unexpected package size.')); hash.update(chunk); next(null, chunk); } }), createWriteStream(file));
  if (size !== artifact.size || hash.digest('hex') !== artifact.sha256) throw Error(`Integrity check failed: ${abi}`);
  const signature = spawnSync(path.join(tools, 'apksigner'), ['verify', '--print-certs', file], { encoding: 'utf8' });
  if (signature.status !== 0 || !signature.stdout.toLowerCase().includes(certificate)) throw Error(`Signature check failed: ${abi}`);
  const metadata = spawnSync(path.join(tools, 'aapt'), ['dump', 'badging', file], { encoding: 'utf8' });
  if (metadata.status !== 0 || !metadata.stdout.includes(`name='${manifest.packageName}' versionCode='${artifact.versionCode}' versionName='${manifest.version}'`) || !metadata.stdout.includes(`native-code: '${abi}'`)) throw Error(`Package metadata mismatch: ${abi}`);
}
mkdirSync('channels', { recursive: true });
const destination = `channels/${channel}.json`;
const previous = existsSync(destination) ? JSON.parse(readFileSync(destination, 'utf8')) : null;
if (previous && previous.buildNumber > manifest.buildNumber) throw Error('A newer version is already distributed.');
manifest.publishedAt = release.published_at;
writeFileSync(destination, JSON.stringify(manifest, null, 2) + '\n');
// Beta members also receive stable fixes, unless their beta is already newer.
if (channel === 'stable') {
  const beta = existsSync('channels/beta.json') ? JSON.parse(readFileSync('channels/beta.json', 'utf8')) : null;
  if (!beta || beta.buildNumber <= manifest.buildNumber) writeFileSync('channels/beta.json', JSON.stringify({ ...manifest, channel: 'beta' }, null, 2) + '\n');
}
console.log(`Verified ${manifest.version}; prepared ${channel} channel.`);
