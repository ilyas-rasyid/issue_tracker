import { Elysia } from 'elysia';
import { issueReadRoutes } from './issue-read.routes';
import { issueWriteRoutes } from './issue-write.routes';
export const issueRoutes = new Elysia().use(issueReadRoutes).use(issueWriteRoutes);
