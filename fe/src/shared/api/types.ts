export type Actor = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
} | null;
export type ProjectSummary = {
  id: string;
  slug: string;
  name: string;
};
export type Project = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  owner: Actor;
  issueCount: number;
  createdAt: string;
  updatedAt: string;
};
export type Issue = {
  id: string;
  key: string;
  title: string;
  description?: string;
  status: string;
  type: string;
  priority: string;
  version: number;
  project?: ProjectSummary | null;
  author: Actor;
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
  allowedTransitions?: string[];
  attachments?: Attachment[];
};
export type Attachment = {
  id: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  contentUrl: string;
  createdAt: string;
};
export type Comment = {
  id: string;
  content: string;
  author: Actor;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
};
export type Activity = {
  id: string;
  eventType: string;
  actor: Actor;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};
export type Notification = {
  id: string;
  type: string;
  actor: Actor;
  issue: {
    key: string;
    title: string;
  };
  commentId: string | null;
  readAt: string | null;
  createdAt: string;
};
export type Page<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
export type InfinitePage<T> = {
  data: T[];
  meta: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
};
