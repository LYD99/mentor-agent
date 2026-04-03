-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GrowthTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goalId" TEXT NOT NULL,
    "taskOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "durationDays" INTEGER,
    "resourcesJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthTask_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "GrowthGoal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GrowthTask" ("createdAt", "description", "durationDays", "goalId", "id", "resourcesJson", "taskOrder", "title", "type") SELECT "createdAt", "description", "durationDays", "goalId", "id", "resourcesJson", "taskOrder", "title", "type" FROM "GrowthTask";
DROP TABLE "GrowthTask";
ALTER TABLE "new_GrowthTask" RENAME TO "GrowthTask";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
