-- CreateEnum
CREATE TYPE "DeliveryChangeType" AS ENUM ('reschedule', 'update_instructions', 'change_address');

-- CreateEnum
CREATE TYPE "DeliveryChangeStatus" AS ENUM ('pending', 'approved', 'rejected', 'applied');

-- CreateTable
CREATE TABLE "DeliveryChangeRequest" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "changeType" "DeliveryChangeType" NOT NULL,
    "newValue" TEXT NOT NULL,
    "newDate" TIMESTAMP(3),
    "status" "DeliveryChangeStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryChangeRequest_shipmentId_idx" ON "DeliveryChangeRequest"("shipmentId");

-- CreateIndex
CREATE INDEX "DeliveryChangeRequest_requestedByUserId_idx" ON "DeliveryChangeRequest"("requestedByUserId");

-- CreateIndex
CREATE INDEX "DeliveryChangeRequest_status_idx" ON "DeliveryChangeRequest"("status");

-- CreateIndex
CREATE INDEX "DeliveryChangeRequest_createdAt_idx" ON "DeliveryChangeRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "DeliveryChangeRequest" ADD CONSTRAINT "DeliveryChangeRequest_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChangeRequest" ADD CONSTRAINT "DeliveryChangeRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChangeRequest" ADD CONSTRAINT "DeliveryChangeRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
