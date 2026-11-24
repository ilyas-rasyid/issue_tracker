import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
} from '@aws-sdk/client-s3';
import { randomToken } from '../../commons/security/crypto';
export const s3 = new S3Client({
  endpoint: process.env.STORAGE_ENDPOINT || 'http://localhost:9000',
  region: process.env.STORAGE_REGION || 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.STORAGE_SECRET_KEY || 'minioadmin',
  },
});
export const bucket = () => process.env.STORAGE_BUCKET || 'tracker-uploads';
export async function uploadObject(key: string, bytes: Uint8Array) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: bytes,
      ContentType: 'image/webp',
      CacheControl: 'private, no-store',
    }),
  );
}
export async function removeObject(key: string) {
  let keyMarker: string | undefined;
  let versionMarker: string | undefined;
  do {
    const result = await s3.send(
      new ListObjectVersionsCommand({
        Bucket: bucket(),
        Prefix: key,
        KeyMarker: keyMarker,
        VersionIdMarker: versionMarker,
      }),
    );
    const objects = [...(result.Versions || []), ...(result.DeleteMarkers || [])].filter(
      (x) => x.Key === key && x.VersionId,
    );
    for (const obj of objects) {
      await s3.send(
        new DeleteObjectCommand({ Bucket: bucket(), Key: key, VersionId: obj.VersionId }),
      );
    }
    keyMarker = result.IsTruncated ? result.NextKeyMarker : undefined;
    versionMarker = result.IsTruncated ? result.NextVersionIdMarker : undefined;
  } while (keyMarker);
  // Also handles non-versioned buckets and keys that are already absent.
  await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
export async function readObject(key: string) {
  const data = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return data.Body?.transformToByteArray();
}
export function storageKey(kind: 'issue' | 'avatar', id: string) {
  return `${kind}/${id}/${randomToken()}.webp`;
}
export async function findOrphanObjects(
  olderThan: Date,
  known: (key: string) => Promise<boolean>,
): Promise<string[]> {
  let token: string | undefined;
  const orphans: string[] = [];
  do {
    const listing = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket(), ContinuationToken: token, MaxKeys: 1000 }),
    );
    for (const entry of listing.Contents || []) {
      if (!entry.Key || !entry.LastModified || entry.LastModified > olderThan) {
        continue;
      }
      if (!(await known(entry.Key))) {
        orphans.push(entry.Key);
      }
    }
    token = listing.IsTruncated ? listing.NextContinuationToken : undefined;
  } while (token);
  return orphans;
}
