import { prisma } from '../src/lib/prisma';
import {
  liveUsernameKey,
  ISSUE_ACTIVITY_TYPE,
  ISSUE_PRIORITY,
  ISSUE_STATUS,
  ISSUE_TYPE,
} from '../src/lib/core';
const password = process.env.SEED_DEMO_PASSWORD;
if (!password) {
  console.log('Seed skipped. Set SEED_DEMO_PASSWORD to create an optional local verified account.');
  await prisma.$disconnect();
  process.exit(0);
}
if (process.env.NODE_ENV === 'production') throw Error('Seed must not run in production');
const username = 'demo_developer',
  email = 'demo@localhost.test';
if (!(await prisma.user.findFirst({ where: { usernameKey: liveUsernameKey(username) } }))) {
  const user = await prisma.user.create({
    data: {
      username,
      usernameKey: liveUsernameKey(username),
      email,
      displayName: 'Demo Developer',
      emailVerifiedAt: new Date(),
      passwordHash: await Bun.password.hash(password, { algorithm: 'argon2id' }),
    },
  });
  const project =
    (await prisma.project.findFirst({ where: { slug: 'general', deletedAt: null } })) ||
    (await prisma.project.create({
      data: {
        slug: 'general',
        name: 'General',
        description: 'Default project for general issues.',
        ownerId: user.id,
      },
    }));
  for (const [title, type, priority] of [
    ['Login form does not report invalid credentials', 'BUG', 'HIGH'],
    ['Add accessible keyboard shortcut help', 'FEATURE', 'MEDIUM'],
    ['Document error response contract', 'TASK', 'LOW'],
  ] as const) {
    const issue = await prisma.issue.create({
      data: {
        projectId: project.id,
        authorId: user.id,
        title,
        description:
          '## Context\n\nA realistic example for local development.\n\n## Acceptance\n\n- [ ] Reproduce and verify',
        type,
        status: ISSUE_STATUS.OPEN,
        priority,
      },
    });
    await prisma.issueActivity.create({
      data: { issueId: issue.id, actorId: user.id, eventType: ISSUE_ACTIVITY_TYPE.ISSUE_CREATED },
    });
  }
  console.log('Demo account + 3 real local sample issues created');
} else console.log('Demo account already exists');
await prisma.$disconnect();
