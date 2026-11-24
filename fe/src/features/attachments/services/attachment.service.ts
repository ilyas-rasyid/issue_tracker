import { get, mutate, type Attachment } from '../../../shared/api/index';

export function fetchAttachments(issueKey: string) {
  return get<Attachment[]>(`/issues/${issueKey}/attachments`);
}

export function uploadAttachment(issueKey: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return mutate<Attachment>(`/issues/${issueKey}/attachments`, 'POST', formData);
}

export function deleteAttachment(issueKey: string, attachmentId: string) {
  return mutate<void>(`/issues/${issueKey}/attachments/${attachmentId}`, 'DELETE');
}
