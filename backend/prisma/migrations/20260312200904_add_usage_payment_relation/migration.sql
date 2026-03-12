-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
