-- AlterTable
ALTER TABLE "users" ADD COLUMN     "country" TEXT,
ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspensionExpiry" TIMESTAMP(3),
ADD COLUMN     "suspensionReason" TEXT;

-- CreateIndex
CREATE INDEX "connected_accounts_userId_idx" ON "connected_accounts"("userId");

-- CreateIndex
CREATE INDEX "connected_accounts_stripeAccountId_idx" ON "connected_accounts"("stripeAccountId");

-- CreateIndex
CREATE INDEX "connected_accounts_status_idx" ON "connected_accounts"("status");

-- CreateIndex
CREATE INDEX "payment_records_userId_status_idx" ON "payment_records"("userId", "status");

-- CreateIndex
CREATE INDEX "payment_records_createdAt_status_idx" ON "payment_records"("createdAt", "status");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_suspended_idx" ON "users"("suspended");

-- CreateIndex
CREATE INDEX "webhook_events_createdAt_idx" ON "webhook_events"("createdAt");

-- CreateIndex
CREATE INDEX "webhook_events_error_idx" ON "webhook_events"("error");
