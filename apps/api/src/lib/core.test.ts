import { test, expect, describe } from 'bun:test';
import {
  createIssueSchema,
  TRANSITIONS,
  ISSUE_STATUS,
  issueKey,
  validate,
  decodeCursor,
  encodeCursor,
  fingerprint,
} from './core';
describe('domain contracts', () => {
  test('only guided lifecycle transitions are allowed', () => {
    expect(TRANSITIONS.OPEN).toEqual(['IN_PROGRESS']);
    expect(TRANSITIONS.RESOLVED).toEqual(['IN_PROGRESS', 'CLOSED']);
    expect(TRANSITIONS.CLOSED).toEqual(['OPEN']);
  });
  test('issue key stable padded number', () => expect(issueKey(5)).toBe('ISS-005'));
  test('create rejects forbidden fields', () => {
    expect(
      createIssueSchema.safeParse({
        clientRequestId: crypto.randomUUID(),
        title: 'Fix bug',
        description: 'Steps',
        type: 'BUG',
        authorId: 'hacker',
      }).success,
    ).toBe(false);
  });
  test('cursor scope mismatch rejected', () => {
    const c = encodeCursor(new Date('2026-01-01'), crypto.randomUUID(), 'comments:abc');
    expect(() => decodeCursor(c, 'comments:xyz')).toThrow();
  });
  test('fingerprint deterministic', () =>
    expect(fingerprint({ a: 1 })).toBe(fingerprint({ a: 1 })));
});
