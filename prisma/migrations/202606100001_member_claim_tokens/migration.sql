ALTER TABLE "Member"
ADD COLUMN "claimToken" TEXT;

CREATE UNIQUE INDEX "Member_claimToken_key" ON "Member"("claimToken");
