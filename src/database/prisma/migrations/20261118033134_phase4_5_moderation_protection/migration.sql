-- AlterTable
ALTER TABLE "ModerationLog" ADD COLUMN "durationSeconds" INTEGER;

-- CreateTable
CREATE TABLE "TemporaryModeration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TemporaryModeration_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TemporaryModeration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaptchaVerification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "expectedAnswer" TEXT NOT NULL,
    "messageId" INTEGER,
    "expiresAt" DATETIME NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaptchaVerification_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaptchaVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrustedUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "addedBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustedUser_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrustedUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
INSERT INTO "new_GroupSettings" ("antiFloodEnabled", "antiLinkEnabled", "antiSpamEnabled", "badWordFilterEnabled", "captchaEnabled", "createdAt", "goodbyeEnabled", "goodbyeMessage", "groupId", "id", "maxWarnings", "rules", "updatedAt", "welcomeEnabled", "welcomeMessage") SELECT "antiFloodEnabled", "antiLinkEnabled", "antiSpamEnabled", "badWordFilterEnabled", "captchaEnabled", "createdAt", "goodbyeEnabled", "goodbyeMessage", "groupId", "id", "maxWarnings", "rules", "updatedAt", "welcomeEnabled", "welcomeMessage" FROM "GroupSettings";
DROP TABLE "GroupSettings";
ALTER TABLE "new_GroupSettings" RENAME TO "GroupSettings";
CREATE UNIQUE INDEX "GroupSettings_groupId_key" ON "GroupSettings"("groupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TemporaryModeration_active_expiresAt_idx" ON "TemporaryModeration"("active", "expiresAt");

-- CreateIndex
CREATE INDEX "TemporaryModeration_groupId_userId_action_active_idx" ON "TemporaryModeration"("groupId", "userId", "action", "active");

-- CreateIndex
CREATE INDEX "CaptchaVerification_verified_expiresAt_idx" ON "CaptchaVerification"("verified", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CaptchaVerification_groupId_userId_key" ON "CaptchaVerification"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedUser_groupId_userId_key" ON "TrustedUser"("groupId", "userId");
