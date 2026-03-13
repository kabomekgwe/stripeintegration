-- AlterTable
ALTER TABLE "payment_records" ADD COLUMN     "taxAmount" INTEGER,
ADD COLUMN     "taxDisplayName" TEXT,
ADD COLUMN     "taxRate" DOUBLE PRECISION;
