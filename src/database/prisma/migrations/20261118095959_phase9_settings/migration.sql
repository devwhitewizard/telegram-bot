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
    "gamesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "funEnabled" BOOLEAN NOT NULL DEFAULT true,
    "commandPermissions" TEXT NOT NULL DEFAULT '{}',
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
INSERT INTO "new_GroupSettings" ("activityTrackingEnabled", "allowedDomains", "antiFloodAction", "antiFloodEnabled", "antiFloodMaxMessages", "antiFloodWindowSeconds", "antiLinkAction", "antiLinkEnabled", "antiRaidEnabled", "antiSpamEnabled", "antiSpamThreshold", "antiSpamWindowSeconds", "badWordFilterEnabled", "captchaAction", "captchaEnabled", "captchaTimeoutSeconds", "createdAt", "goodbyeDeleteAfterSeconds", "goodbyeEnabled", "goodbyeMessage", "groupId", "id", "maxWarnings", "raidJoinThreshold", "raidModeActive", "raidWindowSeconds", "rules", "updatedAt", "warnAction", "warnMuteMinutes", "welcomeDeleteAfterSeconds", "welcomeEnabled", "welcomeImageUrl", "welcomeMessage") SELECT "activityTrackingEnabled", "allowedDomains", "antiFloodAction", "antiFloodEnabled", "antiFloodMaxMessages", "antiFloodWindowSeconds", "antiLinkAction", "antiLinkEnabled", "antiRaidEnabled", "antiSpamEnabled", "antiSpamThreshold", "antiSpamWindowSeconds", "badWordFilterEnabled", "captchaAction", "captchaEnabled", "captchaTimeoutSeconds", "createdAt", "goodbyeDeleteAfterSeconds", "goodbyeEnabled", "goodbyeMessage", "groupId", "id", "maxWarnings", "raidJoinThreshold", "raidModeActive", "raidWindowSeconds", "rules", "updatedAt", "warnAction", "warnMuteMinutes", "welcomeDeleteAfterSeconds", "welcomeEnabled", "welcomeImageUrl", "welcomeMessage" FROM "GroupSettings";
DROP TABLE "GroupSettings";
ALTER TABLE "new_GroupSettings" RENAME TO "GroupSettings";
CREATE UNIQUE INDEX "GroupSettings_groupId_key" ON "GroupSettings"("groupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
