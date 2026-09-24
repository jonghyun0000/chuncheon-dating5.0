import { describe, expect, it } from 'vitest';
import { STUDENT_ID_MAX_BYTES, studentIdFileMetadata, validateStudentIdFile } from './studentIdFile';

const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0, 0];
const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
describe('student ID photo validation', () => {
  it('accepts camera JPEGs with an empty browser MIME type', async () => {
    await expect(validateStudentIdFile(new File([new Uint8Array(jpeg)], 'camera.JPEG'))).resolves.toEqual({ extension: 'jpg', contentType: 'image/jpeg' });
  });
  it.each(['heic', 'heif'])('accepts %s photos using their file format signature', async (ext) => {
    const header = new Uint8Array([0, 0, 0, 24, ...Array.from('ftypheic').map((s) => s.charCodeAt(0)), 0, 0, 0, 0, ...Array.from('mif1heic').map((s) => s.charCodeAt(0))]);
    await expect(validateStudentIdFile(new File([header], `photo.${ext}`, { type: `image/${ext}` }))).resolves.toMatchObject({ contentType: `image/${ext}` });
  });
  it('accepts PNG and WebP', async () => {
    await expect(validateStudentIdFile(new File([new Uint8Array(png)], 'id.png', { type: 'image/png' }))).resolves.toBeDefined();
    await expect(validateStudentIdFile(new File(['RIFF0000WEBP'], 'id.webp', { type: 'image/webp' }))).resolves.toBeDefined();
  });
  it('rejects SVG and renamed non-image contents', async () => {
    await expect(validateStudentIdFile(new File(['<svg/>'], 'id.svg', { type: 'image/svg+xml' }))).rejects.toThrow();
    await expect(validateStudentIdFile(new File(['<script/>'], 'id.jpg', { type: 'image/jpeg' }))).rejects.toThrow();
    await expect(validateStudentIdFile(new File([new Uint8Array(png)], 'id.jpg', { type: 'image/png' }))).rejects.toThrow();
  });
  it('enforces the same 5MiB maximum as storage and rejects empty files', () => {
    expect(() => studentIdFileMetadata(new File([new Uint8Array(STUDENT_ID_MAX_BYTES)], 'id.jpg'))).not.toThrow();
    expect(() => studentIdFileMetadata(new File([new Uint8Array(STUDENT_ID_MAX_BYTES + 1)], 'id.jpg'))).toThrow();
    expect(() => studentIdFileMetadata(new File([], 'id.jpg'))).toThrow();
  });
});
