-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TestSuite" ADD COLUMN     "deletedAt" TIMESTAMP(3);
