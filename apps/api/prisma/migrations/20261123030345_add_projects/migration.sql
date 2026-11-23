-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "projectId" UUID;

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "ownerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_deletedAt_createdAt_idx" ON "Project"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Project_ownerId_deletedAt_idx" ON "Project"("ownerId", "deletedAt");

-- CreateIndex
CREATE INDEX "Issue_projectId_deletedAt_createdAt_idx" ON "Issue"("projectId", "deletedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill default General project for existing issues
INSERT INTO "Project" ("id", "slug", "name", "description", "ownerId", "createdAt", "updatedAt")
SELECT
    '00000000-0000-4000-8000-000000000001'::uuid,
    'general',
    'General',
    'Default project for general issues.',
    (SELECT "id" FROM "User" WHERE "deletedAt" IS NULL ORDER BY "createdAt" ASC LIMIT 1),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Project" WHERE "slug" = 'general');

UPDATE "Issue"
SET "projectId" = (SELECT "id" FROM "Project" WHERE "slug" = 'general' LIMIT 1)
WHERE "projectId" IS NULL;
