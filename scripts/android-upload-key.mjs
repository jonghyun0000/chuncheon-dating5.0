import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, chmodSync, writeFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const directory = join(homedir(), '.config/chuncheon-dating/android-signing');
const configuration = join(directory, 'upload-key.json');
const keystore = join(directory, 'upload-keystore.p12');
if (existsSync(configuration) || existsSync(keystore)) throw Error('An upload key already exists; refusing to replace it.');
mkdirSync(directory, { recursive: true, mode: 0o700 });
chmodSync(directory, 0o700);
const password = randomBytes(32).toString('base64url');
const alias = 'chuncheon-upload';
const javaHome = process.env.JAVA_HOME;
if (!javaHome) throw Error('Set JAVA_HOME to JDK 21 before generating an upload key.');
try {
  execFileSync(join(javaHome, 'bin/keytool'), [
    '-genkeypair', '-keystore', keystore, '-storetype', 'PKCS12',
    '-alias', alias, '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000',
    '-storepass:env', 'CC_NEW_UPLOAD_PASSWORD', '-keypass:env', 'CC_NEW_UPLOAD_PASSWORD',
    '-dname', 'CN=Chuncheon Dating Upload,OU=Mobile,O=HYUNDO,C=KR',
  ], { env: { ...process.env, CC_NEW_UPLOAD_PASSWORD: password }, stdio: 'pipe' });
  chmodSync(keystore, 0o600);
  writeFileSync(configuration, JSON.stringify({ keystore, alias, password }, null, 2), { mode: 0o600, flag: 'wx' });
  execFileSync(join(javaHome, 'bin/keytool'), ['-exportcert', '-rfc', '-keystore', keystore, '-storetype', 'PKCS12', '-alias', alias,
    '-storepass:env', 'CC_NEW_UPLOAD_PASSWORD', '-file', join(directory, 'upload-certificate.pem')],
  { env: { ...process.env, CC_NEW_UPLOAD_PASSWORD: password }, stdio: 'pipe' });
  console.log('Created a private upload key outside the repository. Back up the signing directory securely before the first Play upload. No passwords were printed.');
} catch {
  // The key may already be valid; do not erase it after a later export failure.
  if (!existsSync(configuration)) rmSync(keystore, { force: true });
  throw Error('Upload-key creation did not complete. Inspect the private signing directory before retrying.');
}
