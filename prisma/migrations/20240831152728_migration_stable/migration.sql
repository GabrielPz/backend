/*
  Warnings:

  - You are about to drop the column `proofOfPaymentId` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `supplierQrCodeId` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `qrcodes` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[external_reference]` on the table `orders` will be added. If there are existing duplicate values, this will fail.
  - Made the column `orderId` on table `qrcodes` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "qrcodes" DROP CONSTRAINT "qrcodes_orderId_fkey";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "proofOfPaymentId",
DROP COLUMN "supplierQrCodeId",
ADD COLUMN     "external_reference" TEXT;

-- AlterTable
ALTER TABLE "qrcodes" DROP COLUMN "status",
ALTER COLUMN "orderId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "orders_external_reference_key" ON "orders"("external_reference");

-- AddForeignKey
ALTER TABLE "qrcodes" ADD CONSTRAINT "qrcodes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
