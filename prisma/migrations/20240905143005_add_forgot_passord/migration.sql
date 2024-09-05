-- CreateTable
CREATE TABLE "forgotPassword" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "forgotPassword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forgotPassword_userId_key" ON "forgotPassword"("userId");

-- AddForeignKey
ALTER TABLE "forgotPassword" ADD CONSTRAINT "forgotPassword_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
