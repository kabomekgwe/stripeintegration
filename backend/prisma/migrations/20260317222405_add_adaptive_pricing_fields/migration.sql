-- AlterTable
ALTER TABLE "payment_records" ADD COLUMN     "discountPercent" INTEGER,
ADD COLUMN     "originalAmount" INTEGER,
ADD COLUMN     "tierName" TEXT;
