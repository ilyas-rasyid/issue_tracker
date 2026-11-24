-- Initial Mini Issue Tracker schema, generated from the frozen eight-model specification.
-- Validate against Prisma 7 on PostgreSQL before deploying. No database enums.
CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "username" VARCHAR(30),
  "usernameKey" VARCHAR(80) NOT NULL,
  "email" VARCHAR(320),
  "passwordHash" TEXT,
  "displayName" VARCHAR(100),
  "bio" VARCHAR(500),
  "githubUrl" VARCHAR(255),
  "avatarKey" VARCHAR(512),
  "emailVerifiedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Session" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuthToken" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "purpose" VARCHAR(40) NOT NULL,
  "pendingEmail" VARCHAR(320),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);
CREATE SEQUENCE "Issue_issueNumber_seq" AS INTEGER;
CREATE TABLE "Issue" (
  "id" UUID NOT NULL,
  "issueNumber" INTEGER DEFAULT nextval('"Issue_issueNumber_seq"'::regclass),
  "authorId" UUID,
  "title" VARCHAR(150) NOT NULL,
  "description" TEXT NOT NULL,
  "type" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "priority" VARCHAR(20) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "clientRequestId" UUID,
  "requestFingerprint" CHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "purgedAt" TIMESTAMP(3),
  CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);
ALTER SEQUENCE "Issue_issueNumber_seq" OWNED BY "Issue"."issueNumber";
CREATE TABLE "IssueAttachment" (
  "id" UUID NOT NULL,
  "issueId" UUID NOT NULL,
  "storageKey" VARCHAR(512),
  "originalName" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(50) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "purgedAt" TIMESTAMP(3),
  CONSTRAINT "IssueAttachment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Comment" (
  "id" UUID NOT NULL,
  "issueId" UUID NOT NULL,
  "authorId" UUID,
  "content" TEXT NOT NULL,
  "clientRequestId" UUID,
  "requestFingerprint" CHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "purgedAt" TIMESTAMP(3),
  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IssueActivity" (
  "id" UUID NOT NULL,
  "issueId" UUID NOT NULL,
  "actorId" UUID,
  "eventType" VARCHAR(40) NOT NULL,
  "oldValue" VARCHAR(80),
  "newValue" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "auditExpiresAt" TIMESTAMP(3),
  CONSTRAINT "IssueActivity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Notification" (
  "id" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "actorId" UUID,
  "issueId" UUID NOT NULL,
  "commentId" UUID,
  "type" VARCHAR(40) NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_usernameKey_key" ON "User"("usernameKey");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX "AuthToken_userId_purpose_idx" ON "AuthToken"("userId", "purpose");
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");
CREATE UNIQUE INDEX "Issue_issueNumber_key" ON "Issue"("issueNumber");
CREATE UNIQUE INDEX "Issue_clientRequestId_key" ON "Issue"("clientRequestId");
CREATE INDEX "Issue_deletedAt_createdAt_idx" ON "Issue"("deletedAt", "createdAt");
CREATE INDEX "Issue_status_deletedAt_createdAt_idx" ON "Issue"("status", "deletedAt", "createdAt");
CREATE INDEX "Issue_authorId_deletedAt_idx" ON "Issue"("authorId", "deletedAt");
CREATE INDEX "Issue_purgedAt_idx" ON "Issue"("purgedAt");
CREATE UNIQUE INDEX "IssueAttachment_storageKey_key" ON "IssueAttachment"("storageKey");
CREATE INDEX "IssueAttachment_issueId_deletedAt_status_idx" ON "IssueAttachment"("issueId", "deletedAt", "status");
CREATE INDEX "IssueAttachment_deletedAt_purgedAt_idx" ON "IssueAttachment"("deletedAt", "purgedAt");
CREATE UNIQUE INDEX "Comment_clientRequestId_key" ON "Comment"("clientRequestId");
CREATE INDEX "Comment_issueId_createdAt_id_idx" ON "Comment"("issueId", "createdAt", "id");
CREATE INDEX "Comment_authorId_deletedAt_idx" ON "Comment"("authorId", "deletedAt");
CREATE INDEX "Comment_deletedAt_purgedAt_idx" ON "Comment"("deletedAt", "purgedAt");
CREATE INDEX "IssueActivity_issueId_createdAt_id_idx" ON "IssueActivity"("issueId", "createdAt", "id");
CREATE INDEX "IssueActivity_auditExpiresAt_idx" ON "IssueActivity"("auditExpiresAt");
CREATE UNIQUE INDEX "Notification_commentId_key" ON "Notification"("commentId");
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId", "readAt", "createdAt");
CREATE INDEX "Notification_recipientId_createdAt_id_idx" ON "Notification"("recipientId", "createdAt", "id");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IssueAttachment" ADD CONSTRAINT "IssueAttachment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IssueActivity" ADD CONSTRAINT "IssueActivity_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IssueActivity" ADD CONSTRAINT "IssueActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
