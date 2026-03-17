-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "accountType" TEXT,
ADD COLUMN     "bankCode" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "walletType" TEXT;
