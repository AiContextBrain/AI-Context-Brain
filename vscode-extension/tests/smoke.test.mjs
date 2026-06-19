import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('manifest commands are registered by the extension', () => {
  const manifest = JSON.parse(read('package.json'));
  const extension = read('src/extension.ts');
  const commandIds = manifest.contributes.commands.map((command) => command.command);

  assert.equal(manifest.displayName, 'AI Context Brain');
  assert.ok(commandIds.length >= 10);
  for (const commandId of commandIds) {
    assert.match(extension, new RegExp(commandId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('API routes and plan-aware exports remain connected', () => {
  const apiClient = read('src/services/apiClient.ts');
  const explain = read('src/commands/aiExplain.ts');
  const exports = read('src/services/contextExportService.ts');

  for (const route of [
    '/auth/login',
    '/project/scan-repo',
    '/project/generate-context',
    '/architectureguard/validate-file'
  ]) {
    assert.match(apiClient, new RegExp(route.replaceAll('/', '\\/')));
  }
  assert.match(apiClient, /wizard-blueprint/);
  assert.match(apiClient, /initialize-local/);
  assert.match(explain, /\/architectureguard\/ai-explain/);
  assert.match(exports, /getPlanTokenLimit/);
  assert.match(exports, /\.cursor.*rules.*ai-context-brain\.mdc/s);
  assert.match(exports, /CLAUDE\.md/);
  assert.match(exports, /copilot-instructions\.md/);
});

test('auto-sync tracks metadata without background AI generation', () => {
  const watcher = read('src/services/fileWatcher.ts');
  const pending = read('src/services/pendingChangeService.ts');

  assert.match(watcher, /PendingChangeService/);
  assert.match(pending, /pending/i);
  assert.doesNotMatch(watcher, /generateContext\(|generateOptimizedContext\(|scanProject\(/);
});

test('provider scanner requires runtime integration evidence', () => {
  const scanner = read('src/commands/scanProject.ts');

  assert.match(scanner, /generativelanguage\\\.googleapis\\\.com/);
  assert.match(scanner, /api\\\.openai\\\.com/);
  assert.match(scanner, /api\\\.anthropic\\\.com/);
  assert.doesNotMatch(scanner, /content\.includes\('OPENAI_API_KEY/);
  assert.doesNotMatch(scanner, /Multi-provider AI integration/);
});

test('wizard preserves existing files and scans before generating context', () => {
  const wizard = read('src/commands/newProjectWizard.ts');
  const extension = read('src/extension.ts');
  const manifest = JSON.parse(read('package.json'));
  const contextExport = read('src/services/contextExportService.ts');
  const initializeIndex = wizard.indexOf('initializeLocal(projectId.trim(), projectPath)');
  const scanIndex = wizard.indexOf('scanCmd.execute({ silent: true, force: true, requireCloud: true })');
  const generateIndex = wizard.indexOf('generateAndWrite(projectPath');

  assert.ok(initializeIndex >= 0 && scanIndex > initializeIndex && generateIndex > scanIndex);
  assert.match(wizard, /AI_CONTEXT_BRAIN_BLUEPRINT\.md/);
  assert.match(wizard, /if \(!fs\.existsSync\(projectDocumentPath\)\)/);
  assert.match(wizard, /resolveSafeChildPath/);
  assert.match(wizard, /mysql:\/\/user:password/);
  assert.match(wizard, /mongodb:\/\/localhost/);
  assert.match(contextExport, /OPTIMISTIC_CONTEXT_TOKEN_LIMIT = 2000/);
  assert.ok(manifest.contributes.commands.some((command) => command.command === 'aiContextBrain.initializeLocalWorkspace'));
  assert.match(extension, /uri\.path === '\/initialize'/);
  assert.match(extension, /PENDING_WIZARD_PROJECT_ID/);
  assert.match(extension, /runPendingInitialization/);
  assert.match(wizard, /initializeWithProjectId/);
});
