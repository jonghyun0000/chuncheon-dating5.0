import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.env.CC_ANDROID_SIGNING_CONFIG || join(homedir(), '.config/chuncheon-dating/android-signing/upload-key.json');
assert.equal(statSync(file).mode & 0o077, 0, 'Signing credentials must not be group/world readable');
const signing = JSON.parse(readFileSync(file, 'utf8'));
assert.ok(signing.keystore && signing.alias && signing.password, 'Incomplete signing configuration');
assert.equal(statSync(signing.keystore).mode & 0o077, 0, 'Keystore must not be group/world readable');
assert.ok(process.env.JAVA_HOME && process.env.ANDROID_HOME, 'Set JAVA_HOME and ANDROID_HOME');
const settings = { ...loadEnv('native', root, 'VITE_'), ...process.env };
const backend = new URL(settings.VITE_SUPABASE_URL);
assert.ok(backend.protocol === 'https:' && backend.hostname.endsWith('.supabase.co'), 'Release requires a real HTTPS Supabase backend, not a fixture');
assert.ok(settings.VITE_SUPABASE_ANON_KEY && settings.VITE_SUPABASE_ANON_KEY !== 'test-only-key', 'Release requires a public client key');
const run = (cmd, args, extra = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...extra });
run('npm', ['run', 'build:native']);
run(join(root, 'node_modules/.bin/cap'), ['sync', 'android']);
run(join(root, 'android/gradlew'), ['-p', 'android', '--no-daemon', 'bundleRelease', 'assembleRelease'], {
  env: { ...process.env, CC_ANDROID_STORE_FILE: signing.keystore, CC_ANDROID_STORE_PASSWORD: signing.password,
    CC_ANDROID_KEY_ALIAS: signing.alias, CC_ANDROID_KEY_PASSWORD: signing.password },
});
const aab = join(root, 'android/app/build/outputs/bundle/release/app-release.aab');
const verification = execFileSync(join(process.env.JAVA_HOME, 'bin/jarsigner'), ['-verify', aab], { encoding: 'utf8' });
assert.match(verification, /jar verified\./, 'AAB signature verification failed');
const certificate = execFileSync(join(process.env.JAVA_HOME, 'bin/keytool'), ['-exportcert', '-keystore', signing.keystore,
  '-storetype', 'PKCS12', '-alias', signing.alias, '-storepass:env', 'CC_CERT_PASSWORD'],
{ env: { ...process.env, CC_CERT_PASSWORD: signing.password }, stdio: ['ignore', 'pipe', 'pipe'] });
const metadata = JSON.parse(readFileSync(join(root, 'android/app/build/outputs/apk/release/output-metadata.json'), 'utf8'));
const version = metadata.elements[0];
assert.match(version.versionName, /^[a-zA-Z0-9.-]+$/);
const out = join(root, 'release-candidates/android');
mkdirSync(out, { recursive: true });
const name = `chuncheon-${version.versionName}-candidate`;
copyFileSync(aab, join(out, name+'.aab'));
copyFileSync(join(root, 'android/app/build/outputs/apk/release/app-release.apk'), join(out, name+'.apk'));
const report = { status: 'candidate-not-approved-for-upload', packageId: metadata.applicationId, versionCode: version.versionCode, versionName: version.versionName,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  uploadCertificateSha256: createHash('sha256').update(certificate).digest('hex'),
  backend: backend.origin, signatureVerified: true, sha256: createHash('sha256').update(readFileSync(aab)).digest('hex'),
  blockers: ['Confirm final Play application identity and upload certificate', 'Apply and verify server safety changes with approval',
    'Complete app-content declarations and reviewer access', 'Resolve required dependency audit findings', 'Verify physical device and store pre-launch report'],
};
writeFileSync(join(out, 'BUILD_REPORT.json'), JSON.stringify(report, null, 2)+'\n');
console.log('Signed candidate created under release-candidates/android. No store upload or production database changes performed.');
