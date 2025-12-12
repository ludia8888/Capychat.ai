/*
  Warnings:

  - The primary key for the `SiteConfig` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[tenantId,name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,key]` on the table `SiteConfig` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `FAQArticle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `InteractionLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `SiteConfig` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "category_name_unique";

-- DropIndex
DROP INDEX "InteractionLog_faqId_createdAt_idx";

-- DropIndex
DROP INDEX "InteractionLog_type_createdAt_idx";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "tenantId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "FAQArticle" ADD COLUMN     "tenantId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "InteractionLog" ADD COLUMN     "message" TEXT,
ADD COLUMN     "tenantId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "SiteConfig" DROP CONSTRAINT "SiteConfig_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "tenantId" INTEGER NOT NULL,
ADD CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "Tenant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_key_key" ON "Tenant"("key");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "category_name_unique" ON "Category"("tenantId", "name");

-- CreateIndex
CREATE INDEX "FAQArticle_tenantId_idx" ON "FAQArticle"("tenantId");

-- CreateIndex
CREATE INDEX "InteractionLog_tenantId_type_createdAt_idx" ON "InteractionLog"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "InteractionLog_tenantId_faqId_createdAt_idx" ON "InteractionLog"("tenantId", "faqId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteConfig_tenantId_idx" ON "SiteConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteConfig_tenantId_key_key" ON "SiteConfig"("tenantId", "key");

-- AddForeignKey
ALTER TABLE "FAQArticle" ADD CONSTRAINT "FAQArticle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteConfig" ADD CONSTRAINT "SiteConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionLog" ADD CONSTRAINT "InteractionLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
