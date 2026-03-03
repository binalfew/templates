-- CreateEnum
CREATE TYPE "FormTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "SectionTemplate" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "status" "FormTemplateStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "userId" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormSubmission_tenantId_templateId_idx" ON "FormSubmission"("tenantId", "templateId");

-- CreateIndex
CREATE INDEX "FormSubmission_tenantId_createdAt_idx" ON "FormSubmission"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "FormSubmission_userId_idx" ON "FormSubmission"("userId");

-- CreateIndex
CREATE INDEX "SectionTemplate_tenantId_status_idx" ON "SectionTemplate"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SectionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
