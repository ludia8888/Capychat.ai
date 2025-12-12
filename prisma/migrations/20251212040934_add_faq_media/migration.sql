-- CreateTable
CREATE TABLE "InteractionLog" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "faqId" INTEGER,
    "faqTitle" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InteractionLog_type_createdAt_idx" ON "InteractionLog"("type", "createdAt");

-- CreateIndex
CREATE INDEX "InteractionLog_faqId_createdAt_idx" ON "InteractionLog"("faqId", "createdAt");
