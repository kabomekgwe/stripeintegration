/*
  Warnings:

  - You are about to drop the column `discountPercent` on the `payment_records` table. All the data in the column will be lost.
  - You are about to drop the column `originalAmount` on the `payment_records` table. All the data in the column will be lost.
  - You are about to drop the column `tierName` on the `payment_records` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "payment_records" DROP COLUMN "discountPercent",
DROP COLUMN "originalAmount",
DROP COLUMN "tierName";
