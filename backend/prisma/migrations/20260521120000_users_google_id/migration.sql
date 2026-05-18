-- Add Google OAuth subject id for users who sign in with Google
ALTER TABLE `users` ADD COLUMN `google_id` VARCHAR(200) NULL;
