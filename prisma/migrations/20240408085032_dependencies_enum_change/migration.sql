/*
  Warnings:

  - The values [BLOCKING,WAITING_ON] on the enum `TaskDependencies_dependent_type` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `taskdependencies` MODIFY `dependent_type` ENUM('SUCCESSORS', 'PREDECESSORS') NOT NULL;
