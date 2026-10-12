import { createClient } from 'npm:@supabase/supabase-js@2.105.1';
import { createCleanupHandler } from './handler.mjs';

const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
// verify_jwt=false: requests use a dedicated random scheduler token, validated
// against Vault through a service-only RPC before any cleanup is performed.
Deno.serve(createCleanupHandler(client));
