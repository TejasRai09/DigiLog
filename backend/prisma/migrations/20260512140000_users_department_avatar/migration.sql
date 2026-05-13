-- AlterTable: users profile fields (see prisma/schema.prisma model users)
--
-- If columns already exist (e.g. DB created from mysql/init.sql), mark applied without running SQL:
--   npx prisma migrate resolve --applied 20260512140000_users_department_avatar

ALTER TABLE `users` ADD COLUMN `department` VARCHAR(255) NULL;
ALTER TABLE `users` ADD COLUMN `avatar` MEDIUMTEXT NULL;
