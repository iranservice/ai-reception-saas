// ===========================================================================
// Prisma Configuration (Prisma 7+)
//
// Configures the datasource URL and migration directory.
// See: https://pris.ly/d/config-datasource
// ===========================================================================

import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
