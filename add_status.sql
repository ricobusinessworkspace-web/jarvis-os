ALTER TABLE "public"."transactions" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
