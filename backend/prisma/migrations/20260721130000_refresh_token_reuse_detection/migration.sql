ALTER TABLE "AuthSession" ADD COLUMN "previousRefreshTokenHash" TEXT;

CREATE UNIQUE INDEX "AuthSession_previousRefreshTokenHash_key"
ON "AuthSession"("previousRefreshTokenHash");
