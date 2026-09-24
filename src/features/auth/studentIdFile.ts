import { tr } from '@/i18n';
import { authMessages } from './auth.messages';

export const STUDENT_ID_MAX_BYTES = 5 * 1024 * 1024;
export const STUDENT_ID_ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif';
const FORMATS: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
};

export function studentIdFileMetadata(file: File): { extension: string; contentType: string } {
  if (!file.size) throw new Error(authMessages().invalidImage);
  if (file.size > STUDENT_ID_MAX_BYTES) throw new Error(tr().register.errImageTooLarge);
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const contentType = FORMATS[extension];
  const reportedType = file.type.toLowerCase().replace(/-sequence$/, '');
  if (!contentType || (reportedType && reportedType !== contentType)) {
    throw new Error(authMessages().formats);
  }
  return { extension: extension === 'jpeg' ? 'jpg' : extension, contentType };
}

function readHeader(file: File): Promise<ArrayBuffer> {
  const slice = file.slice(0, 64);
  if (typeof slice.arrayBuffer === 'function') return slice.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error(authMessages().invalidImage));
    reader.readAsArrayBuffer(slice);
  });
}

/** Check metadata and actual format before creating an account or uploading. */
export async function validateStudentIdFile(file: File) {
  const metadata = studentIdFileMetadata(file);
  let bytes: Uint8Array;
  try { bytes = new Uint8Array(await readHeader(file)); }
  catch { throw new Error(authMessages().invalidImage); }
  const startsWith = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  let valid = false;
  switch (metadata.contentType) {
    case 'image/jpeg': valid = startsWith([0xff, 0xd8, 0xff]); break;
    case 'image/png': valid = startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); break;
    case 'image/webp': valid = text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP'; break;
    case 'image/heic':
    case 'image/heif': {
      const brands = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);
      const boxLength = bytes.length >= 4 ? new DataView(bytes.buffer).getUint32(0) : 0;
      if (text(4, 8) === 'ftyp' && boxLength >= 16) {
        valid = brands.has(text(8, 12));
        for (let index = 16; !valid && index + 4 <= Math.min(bytes.length, boxLength); index += 4) {
          valid = brands.has(text(index, index + 4));
        }
      }
      break;
    }
  }
  if (!valid) throw new Error(authMessages().invalidImage);
  return metadata;
}
