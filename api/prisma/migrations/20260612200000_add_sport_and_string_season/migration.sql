-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('FOOTBALL', 'AFL', 'BASEBALL', 'BASKETBALL', 'HANDBALL', 'HOCKEY', 'NFL', 'RUGBY', 'VOLLEYBALL');

-- DropIndex
DROP INDEX "Fixture_externalId_key";

-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "sport" "Sport" NOT NULL DEFAULT 'FOOTBALL',
ALTER COLUMN "season" SET DATA TYPE TEXT USING "season"::text;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "sport" "Sport" NOT NULL DEFAULT 'FOOTBALL',
ALTER COLUMN "competitionSeason" SET DATA TYPE TEXT USING "competitionSeason"::text;

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_sport_externalId_key" ON "Fixture"("sport", "externalId");

