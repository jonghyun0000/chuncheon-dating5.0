#!/usr/bin/env node
/** Service-only hourly job. Removes Storage bytes FIRST; only then drops expired metadata. */
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';

import { cleanupMemberPhotos } from '../supabase/functions/cleanup-member-photos/cleanup.mjs';
export { cleanupMemberPhotos };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Photo cleanup credentials are not configured');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try { console.log(JSON.stringify(await cleanupMemberPhotos(client))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
