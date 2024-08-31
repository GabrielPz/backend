-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "closed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pixInfo" JSONB;
