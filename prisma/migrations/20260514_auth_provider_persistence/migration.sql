-- Auth Provider Persistence Migration (TASK-0031)
--
-- Adds:
--   1. users.email_verified — nullable timestamp for email verification
--   2. accounts table — Auth.js provider account linking
--   3. verification_tokens table — Auth.js email verification tokens
--
-- All changes are additive. No existing tables or columns are modified.
-- Rollback: DROP TABLE verification_tokens; DROP TABLE accounts; ALTER TABLE users DROP COLUMN email_verified;

-- AlterTable: Add email_verified to users
ALTER TABLE "users" ADD COLUMN "email_verified" TIMESTAMP(3);

-- CreateTable: accounts
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: verification_tokens
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex: accounts(user_id)
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex: accounts(provider, provider_account_id) UNIQUE
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex: verification_tokens(identifier, token) UNIQUE
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- AddForeignKey: accounts.user_id -> users.id (CASCADE)
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
