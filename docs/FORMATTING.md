# Formatting Rules for Antigravity / Gemini

Use Prettier as the canonical formatter: 2 spaces, LF, 100-column print width.
Do **not** collapse conditional or loop bodies onto the same line.

**Correct:**

```ts
for (const issue of issues) {
  if (issue.deletedAt) {
    continue;
  }

  await processIssue(issue);
}
```

**Incorrect:**

```ts
for (const issue of issues) { if (issue.deletedAt) continue; await processIssue(issue); }
```

Prefer multiline objects, nested JSX and meaningful helper names.

```tsx
return (
  <section className="issue-content">
    <IssueHeader issue={issue} />
    <IssueDescription description={issue.description} />
    <IssueDiscussion issueKey={issue.key} />
  </section>
);
```

Responsibilities: `fe/src/features/{domain}/pages`, `components`, `hooks`, `services`, `schemas`, `types` where relevant;
`be/src/features/{domain}/handler`, `service`, `repository`, `payload` only as necessary.

All handwritten TS/TSX/CSS should stay below 300 lines. For longer logic, split by one responsibility rather than splitting arbitrarily by line number. Generated Prisma files are excluded.

Run these commands from the repository root after installing dependencies:

```bash
bun run format
bun run format:check
bun run check:structure
```
