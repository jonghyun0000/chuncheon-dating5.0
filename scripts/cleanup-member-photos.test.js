import { describe, it, expect, vi } from 'vitest';
import { cleanupMemberPhotos } from './cleanup-member-photos.mjs';

function client() {
  const remove = vi.fn().mockResolvedValue({ error: null });
  return { rpc: vi.fn(), storage: { from: vi.fn(() => ({ remove })) }, remove };
}
describe('physical photo retention cleanup', () => {
  it('removes bytes before metadata and drains the queue', async () => {
    const c = client();
    c.rpc.mockResolvedValueOnce({data:[{path:'synthetic/a.jpg'}]})
      .mockResolvedValueOnce({error:null}).mockResolvedValueOnce({data:[]});
    await expect(cleanupMemberPhotos(c)).resolves.toEqual({removed:1,complete:true});
    expect(c.rpc).toHaveBeenNthCalledWith(2,'finalize_member_photo_cleanup',{p_paths:['synthetic/a.jpg']});
    expect(c.remove.mock.invocationCallOrder[0]).toBeLessThan(c.rpc.mock.invocationCallOrder[1]);
  });
  it('never finalizes metadata after a storage failure', async () => {
    const c=client();c.rpc.mockResolvedValue({data:[{path:'synthetic/a.jpg'}]});
    c.remove.mockResolvedValue({error:{message:'service unavailable'}});
    await expect(cleanupMemberPhotos(c)).rejects.toThrow('metadata retained');
    expect(c.rpc).toHaveBeenCalledTimes(1);
  });
  it('surfaces incomplete cleanup so the scheduled run is marked failed', async () => {
    const c=client();c.rpc.mockResolvedValue({data:[{path:'synthetic/a.jpg'}]});
    await expect(cleanupMemberPhotos(c,1)).rejects.toThrow('batch limit');
  });
});

import { createCleanupHandler } from '../supabase/functions/cleanup-member-photos/handler.mjs';
describe('scheduler authentication',()=>{
  it('rejects missing token before contacting privileged APIs',async()=>{
    const c=client();
    expect((await createCleanupHandler(c)(new Request('http://local.test',{method:'POST'}))).status).toBe(401);
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it('rejects a well-formed but incorrect token without reading cleanup queue',async()=>{
    const c=client();c.rpc.mockResolvedValue({data:false});
    expect((await createCleanupHandler(c)(new Request('http://local.test',{method:'POST',headers:{authorization:'Bearer '+'a'.repeat(64)}}))).status).toBe(401);
    expect(c.rpc).toHaveBeenCalledTimes(1);
    expect(c.remove).not.toHaveBeenCalled();
  });
  it('only a verified scheduler can perform the fixed-scope cleanup',async()=>{
    const c=client();c.rpc.mockResolvedValueOnce({data:true}).mockResolvedValueOnce({data:[]});
    const response=await createCleanupHandler(c)(new Request('http://local.test',{method:'POST',headers:{authorization:'Bearer '+'a'.repeat(64)}}));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({removed:0,complete:true});
  });
});
