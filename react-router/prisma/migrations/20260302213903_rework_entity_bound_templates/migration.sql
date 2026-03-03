/*
  Warnings:

  - You are about to drop the `FormSubmission` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FormSubmission" DROP CONSTRAINT "FormSubmission_templateId_fkey";

-- DropForeignKey
ALTER TABLE "FormSubmission" DROP CONSTRAINT "FormSubmission_userId_fkey";

-- AlterTable
ALTER TABLE "SectionTemplate" ADD COLUMN     "entityType" TEXT NOT NULL DEFAULT 'Generic';

-- DropTable
DROP TABLE "FormSubmission";

-- CreateIndex
CREATE INDEX "SectionTemplate_tenantId_entityType_status_idx" ON "SectionTemplate"("tenantId", "entityType", "status");
