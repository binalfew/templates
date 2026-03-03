/*
  Warnings:

  - You are about to drop the column `metadata` on the `Notification` table. All the data in the column will be lost.
  - Added the required column `tenantId` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Notification_createdAt_idx";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "metadata",
ADD COLUMN     "data" JSONB,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "tenantId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
