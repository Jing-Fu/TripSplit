-- Allow legacy email/googleSub users to coexist with LINE-based users.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Add LINE identity fields.
ALTER TABLE "User"
ADD COLUMN "lineUserId" TEXT,
ADD COLUMN "linePushEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lineDisplayName" TEXT,
ADD COLUMN "linePictureUrl" TEXT;

-- Backfill existing rows so the new required identifier can be enforced safely.
UPDATE "User"
SET "lineUserId" = 'legacy_' || "id"
WHERE "lineUserId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "lineUserId" SET NOT NULL;

CREATE UNIQUE INDEX "User_lineUserId_key" ON "User"("lineUserId");

-- Add PaymentMethod model introduced after the initial schema.
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");

ALTER TABLE "PaymentMethod"
ADD CONSTRAINT "PaymentMethod_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep BackupRecord aligned with the current Prisma schema.
ALTER TABLE "BackupRecord" RENAME COLUMN "filePath" TO "storageKey";
ALTER TABLE "BackupRecord" ADD COLUMN "contentType" TEXT;
