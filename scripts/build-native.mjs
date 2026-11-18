import assert from 'node:assert/strict';
import { build, loadEnv } from 'vite';

const settings = { ...loadEnv('native', process.cwd(), 'VITE_'), ...process.env };
assert.ok(settings.VITE_SUPABASE_URL && settings.VITE_SUPABASE_ANON_KEY, 'Set the public Supabase URL/key in .env.native.local or the build environment');
assert.equal(new URL(settings.VITE_SUPABASE_URL).protocol, 'https:', 'Native builds require an HTTPS backend');
const key = settings.VITE_SUPABASE_ANON_KEY;
let role;
try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* Opaque publishable key. */ }
assert.ok(!key.startsWith('sb_secret_') && role !== 'service_role', 'Never package a privileged key in a mobile app');
await build({ mode: 'native', build: { outDir: 'dist-native' } });
