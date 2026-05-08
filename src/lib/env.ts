export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
} as const;
