-- CreateEnum
CREATE TYPE "ViewType" AS ENUM ('TABLE', 'KANBAN', 'CALENDAR', 'GALLERY');

-- CreateEnum
CREATE TYPE "FieldDataType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'ENUM', 'MULTI_ENUM', 'EMAIL', 'URL', 'PHONE', 'FILE', 'IMAGE', 'REFERENCE', 'FORMULA', 'JSON');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "period" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "viewType" "ViewType" NOT NULL DEFAULT 'TABLE',
    "filters" JSONB NOT NULL DEFAULT '[]',
    "sorts" JSONB NOT NULL DEFAULT '[]',
    "columns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config" JSONB NOT NULL DEFAULT '{}',
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'Generic',
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "dataType" "FieldDataType" NOT NULL DEFAULT 'TEXT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "validation" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomObjectDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomObjectDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomObjectRecord" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomObjectRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'EMAIL',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'EMAIL',
    "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageDelivery" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "definition" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_tenantId_metric_period_timestamp_idx" ON "AnalyticsSnapshot"("tenantId", "metric", "period", "timestamp");

-- CreateIndex
CREATE INDEX "SavedView_tenantId_entityType_idx" ON "SavedView"("tenantId", "entityType");

-- CreateIndex
CREATE INDEX "SavedView_userId_idx" ON "SavedView"("userId");

-- CreateIndex
CREATE INDEX "FieldDefinition_tenantId_entityType_sortOrder_idx" ON "FieldDefinition"("tenantId", "entityType", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FieldDefinition_tenantId_entityType_name_key" ON "FieldDefinition"("tenantId", "entityType", "name");

-- CreateIndex
CREATE INDEX "CustomObjectDefinition_tenantId_isActive_idx" ON "CustomObjectDefinition"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CustomObjectDefinition_tenantId_slug_key" ON "CustomObjectDefinition"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "CustomObjectRecord_definitionId_tenantId_idx" ON "CustomObjectRecord"("definitionId", "tenantId");

-- CreateIndex
CREATE INDEX "MessageTemplate_tenantId_channel_idx" ON "MessageTemplate"("tenantId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_tenantId_name_key" ON "MessageTemplate"("tenantId", "name");

-- CreateIndex
CREATE INDEX "BroadcastMessage_tenantId_status_idx" ON "BroadcastMessage"("tenantId", "status");

-- CreateIndex
CREATE INDEX "MessageDelivery_broadcastId_status_idx" ON "MessageDelivery"("broadcastId", "status");

-- CreateIndex
CREATE INDEX "UploadedFile_tenantId_idx" ON "UploadedFile"("tenantId");

-- CreateIndex
CREATE INDEX "SectionTemplate_tenantId_isActive_idx" ON "SectionTemplate"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SectionTemplate_tenantId_name_key" ON "SectionTemplate"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomObjectRecord" ADD CONSTRAINT "CustomObjectRecord_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "CustomObjectDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "BroadcastMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
