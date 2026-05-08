// ===========================================================================
// Prisma Configuration (Prisma 7+)
//
// Configures the datasource URL and migration directory.
// See: https://pris.ly/d/config-datasource
//
// Uses process.env directly so prisma generate / prisma format
// can run without DATABASE_URL being set.
// ===========================================================================

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
