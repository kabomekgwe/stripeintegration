-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "stripeDisputeId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "evidenceDueBy" TIMESTAMP(3),
    "isChargeRefundable" BOOLEAN NOT NULL DEFAULT false,
    "evidenceSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "evidenceSubmittedAt" TIMESTAMP(3),
    "evidence" JSONB,
    "statusTransitions" JSONB[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disputes_stripeDisputeId_key" ON "disputes"("stripeDisputeId");

-- CreateIndex
CREATE INDEX "disputes_userId_idx" ON "disputes"("userId");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "disputes_createdAt_idx" ON "disputes"("createdAt");

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
