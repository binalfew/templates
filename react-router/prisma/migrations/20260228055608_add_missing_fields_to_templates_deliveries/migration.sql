-- AlterTable
ALTER TABLE "BroadcastMessage" ADD COLUMN     "cancelledBy" TEXT;

-- AlterTable
ALTER TABLE "MessageDelivery" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "recipient" TEXT;

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "updatedBy" TEXT;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
