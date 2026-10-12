import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareMemberPhoto, searchPhotoArchive } from './photos.api';
const mock=vi.hoisted(()=>({ from:vi.fn(), query:{select:vi.fn(),not:vi.fn(),order:vi.fn(),range:vi.fn(),eq:vi.fn(),or:vi.fn(),data:[],error:null} }));
vi.mock('@/lib/supabaseClient',()=>({supabase:{from:mock.from}}));
describe('photo validation and archive filters',()=>{
 beforeEach(()=>{
  for(const key of ['select','not','order','range','eq','or'] as const) mock.query[key].mockReset().mockReturnValue(mock.query);
  mock.from.mockReturnValue(mock.query);
 });
 it('uses exact gender matching so male never also matches female',async()=>{
  await searchPhotoArchive('남자 컴퓨터',0);
  expect(mock.query.eq).toHaveBeenCalledWith('gender','male');
  expect(mock.query.or).toHaveBeenCalledTimes(1);
  expect(mock.query.or).toHaveBeenCalledWith(expect.stringContaining('department.ilike.*컴퓨터*'));
 });
 it('removes PostgREST expression characters from search text',async()=>{
  await searchPhotoArchive('x),owner_id.eq.secret',0);
  for(const [expression] of mock.query.or.mock.calls) expect(expression).not.toMatch(/[()]/);
 });
 it('rejects SVG and empty image input before requesting a reservation',async()=>{
  await expect(prepareMemberPhoto(new File(['<svg/>'],'x.svg',{type:'image/svg+xml'}))).rejects.toThrow();
  await expect(prepareMemberPhoto(new File([],'x.jpg',{type:'image/jpeg'}))).rejects.toThrow();
 });
});
