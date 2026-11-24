import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const maxLines = 300;
const failures = [];
let inspected = 0;

function inspectDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'generated', 'coverage'].includes(entry.name)) {
        inspectDirectory(absolute);
      }
      continue;
    }

    if (!/\.(tsx?|css)$/.test(entry.name)) {
      continue;
    }

    inspected += 1;
    const relative = path.relative(root, absolute);
    const content = fs.readFileSync(absolute, 'utf8');
    const lineCount = content.split('\n').length;

    if (lineCount > maxLines) {
      failures.push(`${relative}: ${lineCount} lines exceeds the ${maxLines}-line source limit`);
    }

    if (/\breturn\s*\(\s*</.test(content) && /\breturn\s*\(</.test(content)) {
      failures.push(`${relative}: JSX return collapsed into one line`);
    }

    if (/\.tsx?$/.test(entry.name)) {
      const importPattern = /\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g;
      for (const match of content.matchAll(importPattern)) {
        const destination = path.resolve(path.dirname(absolute), match[1]);
        const candidates = [
          destination,
          `${destination}.ts`,
          `${destination}.tsx`,
          `${destination}.js`,
          path.join(destination, 'index.ts'),
          path.join(destination, 'index.tsx'),
        ];
        const generatedPrisma = match[1].includes('generated/prisma/client.js');

        if (!generatedPrisma && !candidates.some((candidate) => fs.existsSync(candidate))) {
          failures.push(`${relative}: unresolved local import ${match[1]}`);
        }
      }
    }
  }
}

for (const directory of ['fe/src', 'be/src']) {
  if (!fs.existsSync(path.join(root, directory))) {
    failures.push(`Missing required directory: ${directory}`);
    continue;
  }
  inspectDirectory(path.join(root, directory));
}

const schemaPath = path.join(root, 'be/prisma/schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');
if (/^\s*enum\s+\w+\s*\{/m.test(schema)) {
  failures.push('Prisma enum declarations are forbidden');
}

if (fs.existsSync(path.join(root, 'apps'))) {
  failures.push('Legacy apps/ directory is forbidden; use fe/ and be/');
}

if (failures.length > 0) {
  console.error(`Structural audit failed (${failures.length}):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Structural audit passed: ${inspected} source files, max ${maxLines} lines, fe/ + be/, no Prisma enum.`);
}
