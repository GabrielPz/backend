/*
  Warnings:

  - A unique constraint covering the columns `[orderId]` on the table `proofs_of_payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orderId]` on the table `qrcodes` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "qrcodes" DROP CONSTRAINT "qrcodes_orderId_fkey";

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "userPaymentStatus" SET DEFAULT 'pending',
ALTER COLUMN "adminPaymentStatus" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "qrcodes" ALTER COLUMN "orderId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "proofs_of_payment_orderId_key" ON "proofs_of_payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "qrcodes_orderId_key" ON "qrcodes"("orderId");

-- AddForeignKey
ALTER TABLE "qrcodes" ADD CONSTRAINT "qrcodes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
