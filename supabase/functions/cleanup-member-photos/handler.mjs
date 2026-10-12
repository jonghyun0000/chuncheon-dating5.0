import { cleanupMemberPhotos } from './cleanup.mjs';
/** Private scheduler authentication; never accepts target paths from the HTTP caller. */
export function createCleanupHandler(client) {
  return async request => {
    if (request.method !== 'POST') return new Response('Method not allowed', {status:405});
    const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) return new Response('Unauthorized', {status:401});
    try {
      const {data,error} = await client.rpc('authorize_member_photo_cleanup', {p_token:token});
      if (error || data !== true) return new Response('Unauthorized', {status:401});
      const result=await cleanupMemberPhotos(client,10);
      return Response.json(result, {headers:{'cache-control':'no-store'}});
    } catch {
      // No credentials, paths, request payloads or personal data in logs/responses.
      return Response.json({error:'Cleanup failed; queued files will be retried'}, {status:500});
    }
  };
}
