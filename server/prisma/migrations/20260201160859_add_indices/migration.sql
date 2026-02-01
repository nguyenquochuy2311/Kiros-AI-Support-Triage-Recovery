-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "error" JSONB;

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");
