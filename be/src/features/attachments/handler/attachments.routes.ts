import { Elysia } from 'elysia';
import { assert } from '../../../commons/errors/app-error';
import { requireUser } from '../../../security/session';
import { limitRate } from '../../../security/rate-limit';
import {
  listAttachments,
  getAttachmentContent,
  uploadAttachment,
  deleteAttachment,
} from '../service/attachment.service';

/** Attachment endpoints. */
export const attachmentRoutes = new Elysia({ prefix: '/api/v1/issues' })
  .get('/:key/attachments', async ({ params }) => {
    const data = await listAttachments(params.key);
    return { data };
  })
  .get('/:key/attachments/:id/content', async ({ params }) => {
    const bytes = await getAttachmentContent(params.key, params.id);
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  })
  .post('/:key/attachments', async ({ params, request }) => {
    limitRate(request, 'upload-image', 120, 3600000);
    const user = await requireUser(request);
    const size = Number(request.headers.get('content-length') || 0);
    assert(!size || size <= 6 * 1024 * 1024, 413, 'FILE_TOO_LARGE', 'Request exceeds upload limit');
    const form = await request.formData();
    const file = form.get('file');
    assert(file instanceof File, 422, 'VALIDATION_ERROR', 'Select one image file');

    const created = await uploadAttachment(user.id, params.key, file);
    return new Response(JSON.stringify({ data: created }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  })
  .delete('/:key/attachments/:id', async ({ params, request }) => {
    const user = await requireUser(request);
    await deleteAttachment(user.id, params.key, params.id);
    return new Response(null, { status: 204 });
  });
