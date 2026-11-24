import { z } from 'zod';
export const issueSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(1).max(10000),
  type: z.enum(['BUG', 'FEATURE', 'TASK']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
});
export type IssueFields = z.infer<typeof issueSchema>;
