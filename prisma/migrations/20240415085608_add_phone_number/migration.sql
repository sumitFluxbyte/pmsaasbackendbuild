-- AlterTable
ALTER TABLE `user` ADD COLUMN `country_code` VARCHAR(191) NULL,
    ADD COLUMN `is_phone_number_verified` BOOLEAN NULL,
    ADD COLUMN `phone_number` VARCHAR(191) NULL;
