import { z } from 'zod';
import { ISSUE_TYPE, ISSUE_STATUS, ISSUE_PRIORITY } from '../constants/domain.constants';
import { AppError } from '../errors/app-error';
export function validate<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      field: i.path.join('.') || 'body',
      message: i.message,
    }));
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields', errors);
  }
  return parsed.data;
}
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, 'Use 3–30 lowercase letters, digits or underscores');
export const emailSchema = z.email().trim().toLowerCase().max(320);
export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
  .regex(/[0-9]/, 'Password must include at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character');
export const createProjectSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use 2–60 lowercase letters, digits, or hyphens')
    .min(2)
    .max(60)
    .optional(),
  description: z.string().trim().max(300).nullable().optional(),
});
export const editProjectSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(300).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field is required',
  });
export const createIssueSchema = z.strictObject({
  clientRequestId: z.uuid(),
  projectId: z.uuid().nullable().optional(),
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(1).max(10000),
  type: z.enum(ISSUE_TYPE),
  priority: z.enum(ISSUE_PRIORITY).default(ISSUE_PRIORITY.MEDIUM),
});
export const editIssueSchema = z
  .strictObject({
    projectId: z.uuid().nullable().optional(),
    title: z.string().trim().min(3).max(150).optional(),
    description: z.string().trim().min(1).max(10000).optional(),
    type: z.enum(ISSUE_TYPE).optional(),
    priority: z.enum(ISSUE_PRIORITY).optional(),
    expectedVersion: z.number().int().positive(),
  })
  .refine((v) => Object.keys(v).some((k) => k !== 'expectedVersion'), {
    message: 'At least one field is required',
  });
export const statusSchema = z.strictObject({
  status: z.enum(ISSUE_STATUS),
  expectedVersion: z.number().int().positive(),
});
export const commentSchema = z.strictObject({
  clientRequestId: z.uuid(),
  content: z.string().trim().min(1).max(2000),
});
export const editCommentSchema = z.strictObject({ content: z.string().trim().min(1).max(2000) });
export const registerSchema = z.strictObject({
  username: usernameSchema,
  displayName: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
});
export const loginSchema = z.strictObject({ email: emailSchema, password: z.string() });
export const profileSchema = z.strictObject({
  displayName: z.string().trim().min(2).max(100).optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  githubUrl: z
    .union([z.url().regex(/^https:\/\/github\.com\/[a-zA-Z0-9-]+\/?$/), z.null()])
    .optional(),
});
export const deleteAccountSchema = z.strictObject({
  password: z.string().min(1),
  confirmation: z.literal('DELETE'),
});
