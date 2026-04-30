-- CreateTable
CREATE TABLE "SettlementReminder" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SettlementReminder_tripId_userId_key" ON "SettlementReminder"("tripId", "userId");

-- CreateIndex
CREATE INDEX "SettlementReminder_userId_idx" ON "SettlementReminder"("userId");

-- AddForeignKey
ALTER TABLE "SettlementReminder" ADD CONSTRAINT "SettlementReminder_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementReminder" ADD CONSTRAINT "SettlementReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
