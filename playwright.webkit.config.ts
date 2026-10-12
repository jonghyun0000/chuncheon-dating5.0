import original from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({ ...original, use: { ...original.use, browserName: 'webkit', channel: undefined }, webServer: { ...original.webServer, env: { VITE_SUPABASE_URL: 'http://127.0.0.1:5181', VITE_SUPABASE_ANON_KEY: 'test-only-key' } } });
