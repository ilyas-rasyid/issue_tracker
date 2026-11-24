export type UploadFile = {
  id: string;
  file: File;
  preview: string;
  status: 'selected' | 'uploading' | 'uploaded' | 'failed';
  error?: string;
};
