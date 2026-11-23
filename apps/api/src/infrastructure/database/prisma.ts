import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
export const url = process.env.DATABASE_URL;
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
