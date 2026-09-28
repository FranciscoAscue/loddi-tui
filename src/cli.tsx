#!/usr/bin/env node
import process from 'node:process';
import path from 'node:path';
import React from 'react';
import {Command} from 'commander';
import {render} from 'ink';
import {initializeProject, loadProject, loadStandaloneDocument} from './services/project.js';
import {checkProject} from './services/check.js';
import {exportBook, ExportFormat} from './services/export.js';
import {inspectTools, installPandoc, installTypst, platformLabel} from './services/tools.js';
import {App, StandaloneEditor} from './ui/App.js';

const program = new Command()
  .name('loddi')
  .description('Terminal publishing environment for Markdown books')
  .version('0.1.0');

program
  .command('init')
  .description('Create a Loddi project')
  .argument('[directory]', 'Project directory', '.')
  .option('-t, --title <title>', 'Book title')
  .option('--adopt', 'Index existing Markdown files without moving or rewriting them')
  .action(async (directory: string, options: {title?: string; adopt?: boolean}) => {
    const project = await initializeProject(directory, options.title, {adoptExisting: options.adopt === true});
    process.stdout.write(`Project created at ${project.root}\n`);
    if (options.adopt) process.stdout.write(`Indexed ${project.book.content.length} Markdown files.\n`);
    process.stdout.write(`Open it with: loddi ${JSON.stringify(project.root)}\n`);
  });

program
  .command('check')
  .description('Validate the project and external tools')
  .argument('[directory]', 'Project directory', '.')
  .action(async (directory: string) => {
    const project = await loadProject(directory);
    const diagnostics = await checkProject(project);
    if (diagnostics.length === 0) {
      process.stdout.write('✓ Project is valid\n');
      return;
    }
    for (const diagnostic of diagnostics) {
      const icon = diagnostic.level === 'error' ? '✗' : '!';
      const location = diagnostic.file ? `${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}` : ''}: ` : '';
      process.stdout.write(`${icon} ${location}${diagnostic.message}\n`);
    }
    if (diagnostics.some(item => item.level === 'error')) process.exitCode = 1;
  });

program
  .command('export')
  .description('Export a book without opening the TUI')
  .argument('<format>', 'Output format: epub or pdf')
  .argument('[directory]', 'Project directory', '.')
  .action(async (format: string, directory: string) => {
    if (format !== 'epub' && format !== 'pdf') throw new Error('Format must be epub or pdf.');
    const project = await loadProject(directory);
    const output = await exportBook(project, format as ExportFormat, message => process.stdout.write(`${message}\n`));
    process.stdout.write(`Export complete: ${output}\n`);
  });

const toolsCommand = program.command('tools').description('Inspect and install optional publishing tools');

toolsCommand
  .command('status', {isDefault: true})
  .description('Show optional tool status')
  .action(async () => {
    process.stdout.write(`Platform: ${platformLabel()}\n`);
    for (const tool of await inspectTools()) {
      process.stdout.write(`${tool.installed ? '✓' : '!'} ${tool.label}: ${tool.version || 'not installed'}\n`);
      if (!tool.installed) process.stdout.write(`  ${tool.installHint}\n`);
    }
  });

toolsCommand
  .command('install')
  .description('Install an optional tool in Loddi user data')
  .argument('<tool>', 'Tool name: pandoc or typst')
  .action(async (tool: string) => {
    if (tool === 'pandoc') await installPandoc(message => process.stdout.write(`${message}\n`));
    else if (tool === 'typst') await installTypst(message => process.stdout.write(`${message}\n`));
    else throw new Error('Tool must be pandoc or typst.');
  });

program
  .argument('[directory]', 'Project to open', '.')
  .action(async (directory: string) => {
    const target = path.resolve(directory);
    const standalone = /\.md$/i.test(target) ? await loadStandaloneDocument(target) : undefined;
    const project = standalone ? undefined : await loadProject(target);
    const instance = render(standalone
      ? <StandaloneEditor project={standalone.project} relativePath={standalone.relativePath} />
      : <App project={project!} />, {
      alternateScreen: true,
      exitOnCtrlC: false,
    });
    await instance.waitUntilExit();
  });

program.parseAsync().catch(error => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
