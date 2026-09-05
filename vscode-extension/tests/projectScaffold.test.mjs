import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const { ProjectScaffoldService } = require('../out/services/projectScaffoldService.js');

test('wizard scaffold creates runnable files, preserves existing files and removes stale gitkeep files', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-context-scaffold-'));
  const root = path.join(parent, 'customer-portal');
  fs.mkdirSync(path.join(root, 'src', 'app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'app', '.gitkeep'), '');
  fs.writeFileSync(path.join(root, 'README.md'), '# Existing documentation\n');

  try {
    const result = new ProjectScaffoldService().create(root, {
      framework: 'Next.js / Node.js (TypeScript/JavaScript)',
      databaseType: 'postgresql',
      authSystem: 'nextauth',
      dependencies: ['next', 'react', '@prisma/client', 'prisma', 'next-auth', 'stripe'],
      folderStructure: [
        'src/app',
        'src/app/api',
        'src/components',
        'src/components/ui',
        'src/lib',
        'src/lib/db',
        'src/services',
        'src/app/api/auth/[...nextauth]',
        'src/app/api/webhooks/stripe',
        'tests'
      ],
      scaffoldOptions: {
        languages: ['typescript'],
        databases: ['postgresql'],
        auths: ['nextauth'],
        billings: ['stripe']
      }
    });

    assert.equal(result.projectName, 'customer-portal');
    assert.ok(result.createdFiles >= 10);
    assert.equal(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), '# Existing documentation\n');
    assert.ok(fs.existsSync(path.join(root, 'package.json')));
    assert.ok(fs.existsSync(path.join(root, 'src', 'app', 'page.tsx')));
    assert.ok(fs.existsSync(path.join(root, 'src', 'app', 'api', 'auth', '[...nextauth]', 'route.ts')));
    assert.ok(fs.existsSync(path.join(root, 'src', 'app', 'api', 'webhooks', 'stripe', 'route.ts')));
    assert.ok(fs.existsSync(path.join(root, 'prisma', 'schema.prisma')));
    assert.equal(fs.existsSync(path.join(root, 'src', 'app', '.gitkeep')), false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name, 'customer-portal');

    const sourceFiles = [];
    const collect = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(target);
        else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(target);
      }
    };
    collect(path.join(root, 'src'));
    for (const sourceFile of sourceFiles) {
      const source = fs.readFileSync(sourceFile, 'utf8');
      const transpiled = ts.transpileModule(source, {
        fileName: sourceFile,
        reportDiagnostics: true,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.Preserve }
      });
      const errors = (transpiled.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error);
      assert.equal(errors.length, 0, `${path.relative(root, sourceFile)} contains TypeScript syntax errors`);
    }
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
