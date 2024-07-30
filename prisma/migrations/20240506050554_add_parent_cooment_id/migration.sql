-- AlterTable
ALTER TABLE `comments` ADD COLUMN `parent_comment_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Comments` ADD CONSTRAINT `Comments_parent_comment_id_fkey` FOREIGN KEY (`parent_comment_id`) REFERENCES `Comments`(`comment_id`) ON DELETE CASCADE ON UPDATE CASCADE;
