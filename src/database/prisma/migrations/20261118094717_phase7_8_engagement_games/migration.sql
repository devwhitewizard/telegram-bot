-- CreateTable
CREATE TABLE "UserActivity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserActivity_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyActivity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "dateKey" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyActivity_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "hostUserId" INTEGER NOT NULL,
    "gameType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "stateJson" TEXT NOT NULL,
    "messageId" INTEGER,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameSession_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerStats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastDailyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerStats_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GroupSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "welcomeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "goodbyeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "antiSpamEnabled" BOOLEAN NOT NULL DEFAULT false,
    "antiFloodEnabled" BOOLEAN NOT NULL DEFAULT false,
    "antiLinkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "badWordFilterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "captchaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "antiRaidEnabled" BOOLEAN NOT NULL DEFAULT false,
    "raidModeActive" BOOLEAN NOT NULL DEFAULT false,
    "welcomeMessage" TEXT,
    "goodbyeMessage" TEXT,
    "welcomeImageUrl" TEXT,
    "welcomeDeleteAfterSeconds" INTEGER NOT NULL DEFAULT 0,
    "goodbyeDeleteAfterSeconds" INTEGER NOT NULL DEFAULT 0,
    "activityTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rules" TEXT,
    "maxWarnings" INTEGER NOT NULL DEFAULT 3,
    "warnAction" TEXT NOT NULL DEFAULT 'MUTE',
    "warnMuteMinutes" INTEGER NOT NULL DEFAULT 60,
    "antiSpamThreshold" INTEGER NOT NULL DEFAULT 3,
    "antiSpamWindowSeconds" INTEGER NOT NULL DEFAULT 30,
    "antiFloodMaxMessages" INTEGER NOT NULL DEFAULT 5,
    "antiFloodWindowSeconds" INTEGER NOT NULL DEFAULT 5,
    "antiFloodAction" TEXT NOT NULL DEFAULT 'MUTE',
    "antiLinkAction" TEXT NOT NULL DEFAULT 'DELETE',
    "allowedDomains" TEXT NOT NULL DEFAULT '[]',
    "raidJoinThreshold" INTEGER NOT NULL DEFAULT 10,
    "raidWindowSeconds" INTEGER NOT NULL DEFAULT 30,
    "captchaTimeoutSeconds" INTEGER NOT NULL DEFAULT 120,
    "captchaAction" TEXT NOT NULL DEFAULT 'KICK',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GroupSettings_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GroupSettings" ("allowedDomains", "antiFloodAction", "antiFloodEnabled", "antiFloodMaxMessages", "antiFloodWindowSeconds", "antiLinkAction", "antiLinkEnabled", "antiRaidEnabled", "antiSpamEnabled", "antiSpamThreshold", "antiSpamWindowSeconds", "badWordFilterEnabled", "captchaAction", "captchaEnabled", "captchaTimeoutSeconds", "createdAt", "goodbyeEnabled", "goodbyeMessage", "groupId", "id", "maxWarnings", "raidJoinThreshold", "raidModeActive", "raidWindowSeconds", "rules", "updatedAt", "warnAction", "warnMuteMinutes", "welcomeEnabled", "welcomeMessage") SELECT "allowedDomains", "antiFloodAction", "antiFloodEnabled", "antiFloodMaxMessages", "antiFloodWindowSeconds", "antiLinkAction", "antiLinkEnabled", "antiRaidEnabled", "antiSpamEnabled", "antiSpamThreshold", "antiSpamWindowSeconds", "badWordFilterEnabled", "captchaAction", "captchaEnabled", "captchaTimeoutSeconds", "createdAt", "goodbyeEnabled", "goodbyeMessage", "groupId", "id", "maxWarnings", "raidJoinThreshold", "raidModeActive", "raidWindowSeconds", "rules", "updatedAt", "warnAction", "warnMuteMinutes", "welcomeEnabled", "welcomeMessage" FROM "GroupSettings";
DROP TABLE "GroupSettings";
ALTER TABLE "new_GroupSettings" RENAME TO "GroupSettings";
CREATE UNIQUE INDEX "GroupSettings_groupId_key" ON "GroupSettings"("groupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UserActivity_groupId_messageCount_idx" ON "UserActivity"("groupId", "messageCount");

-- CreateIndex
CREATE UNIQUE INDEX "UserActivity_groupId_userId_key" ON "UserActivity"("groupId", "userId");

-- CreateIndex
CREATE INDEX "DailyActivity_groupId_dateKey_idx" ON "DailyActivity"("groupId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailyActivity_groupId_dateKey_key" ON "DailyActivity"("groupId", "dateKey");

-- CreateIndex
CREATE INDEX "GameSession_groupId_status_expiresAt_idx" ON "GameSession"("groupId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "GameSession_groupId_gameType_status_idx" ON "GameSession"("groupId", "gameType", "status");

-- CreateIndex
CREATE INDEX "PlayerStats_groupId_score_idx" ON "PlayerStats"("groupId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerStats_groupId_userId_key" ON "PlayerStats"("groupId", "userId");
