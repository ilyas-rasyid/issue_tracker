import sharp from 'sharp';
import { AppError, assert } from '../../lib/core';
export async function normalizeImage(file: File, avatar = false) {
  assert(
    file.size > 0 && file.size <= (avatar ? 2 : 5) * 1024 * 1024,
    413,
    'FILE_TOO_LARGE',
    'Image exceeds the upload limit',
  );
  assert(
    ['image/png', 'image/jpeg', 'image/webp'].includes(file.type),
    415,
    'UNSUPPORTED_FILE_TYPE',
    'Only PNG, JPEG and WebP are allowed',
  );
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const transformer = sharp(buffer, { limitInputPixels: 16000000, failOn: 'error' });
    const meta = await transformer.metadata();
    assert(
      ['png', 'jpeg', 'webp'].includes(meta.format || ''),
      415,
      'UNSUPPORTED_FILE_TYPE',
      'Image signature is not supported',
    );
    assert(
      !!meta.width && !!meta.height && meta.width >= 1 && meta.height >= 1,
      422,
      'INVALID_IMAGE',
      'Invalid image dimensions',
    );
    const output = await transformer
      .rotate()
      .resize(avatar ? 256 : 3000, avatar ? 256 : 3000, {
        fit: avatar ? 'cover' : 'inside',
        withoutEnlargement: !avatar,
      })
      .webp({ quality: avatar ? 80 : 85 })
      .toBuffer();
    return new Uint8Array(output);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(422, 'INVALID_IMAGE', 'The image could not be decoded');
  }
}
