-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "competitionLeagueId" INTEGER,
ADD COLUMN     "competitionName" TEXT,
ADD COLUMN     "competitionSeason" INTEGER;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "fixtureId" TEXT;

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "round" TEXT,
    "teamA" TEXT NOT NULL,
    "teamB" TEXT NOT NULL,
    "teamALogo" TEXT,
    "teamBLogo" TEXT,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "status" "FixtureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "minute" INTEGER,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_externalId_key" ON "Fixture"("externalId");

-- CreateIndex
CREATE INDEX "Fixture_leagueId_season_idx" ON "Fixture"("leagueId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "Match_groupId_fixtureId_key" ON "Match"("groupId", "fixtureId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

