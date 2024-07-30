/*
  Warnings:

  - Made the column `project_role` on table `projectassignusers` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `projectassignusers` MODIFY `project_role` ENUM('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_MEMBER') NOT NULL;
