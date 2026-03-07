/*
  Warnings:

  - You are about to drop the `AnalyticsSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BroadcastMessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CustomObjectDefinition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CustomObjectRecord` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FieldDefinition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MessageDelivery` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MessageTemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SectionTemplate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BroadcastMessage" DROP CONSTRAINT "BroadcastMessage_templateId_fkey";

-- DropForeignKey
ALTER TABLE "CustomObjectRecord" DROP CONSTRAINT "CustomObjectRecord_definitionId_fkey";

-- DropForeignKey
ALTER TABLE "MessageDelivery" DROP CONSTRAINT "MessageDelivery_broadcastId_fkey";

-- DropForeignKey
ALTER TABLE "MessageDelivery" DROP CONSTRAINT "MessageDelivery_userId_fkey";

-- DropTable
DROP TABLE "AnalyticsSnapshot";

-- DropTable
DROP TABLE "BroadcastMessage";

-- DropTable
DROP TABLE "CustomObjectDefinition";

-- DropTable
DROP TABLE "CustomObjectRecord";

-- DropTable
DROP TABLE "FieldDefinition";

-- DropTable
DROP TABLE "MessageDelivery";

-- DropTable
DROP TABLE "MessageTemplate";

-- DropTable
DROP TABLE "SectionTemplate";

-- DropEnum
DROP TYPE "BroadcastStatus";

-- DropEnum
DROP TYPE "FieldDataType";

-- DropEnum
DROP TYPE "FormTemplateStatus";

-- DropEnum
DROP TYPE "MessageChannel";

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_tenantId_key" ON "IdempotencyKey"("key", "tenantId");

-- CreateIndex
CREATE INDEX "ApiKey_tenantId_createdAt_idx" ON "ApiKey"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiKey_expiresAt_idx" ON "ApiKey"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_action_createdAt_idx" ON "AuditLog"("tenantId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_createdAt_idx" ON "Notification"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_createdAt_idx" ON "WebhookDelivery"("createdAt");
