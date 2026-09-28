import React, {useMemo, useState} from 'react';
import path from 'node:path';
import {Box, Text, useInput, useStdout} from 'ink';
import TextInput from 'ink-text-input';
import {filterDocuments, getListWindow} from '../domain/launcher.js';
import {BookProject, addChapter, addSection, ensureCover, moveContentItem, removeContentItem, renameContentItem} from '../services/project.js';
import type {SlashCommand} from './commands.js';
import {Logo} from './Logo.js';
import {Prompt} from './Prompt.js';

type CreateMode = 'chapter' | 'section' | undefined;
type ConfirmDelete = {path: string; label: string} | undefined;

type DocumentEntry = {
  kind: 'cover' | 'section' | 'chapter' | 'document';
  path: string;
  label: string;
};

export function Dashboard({
  project,
  commands,
  onOpen,
  onChanged,
  onCommand,
  onQuit,
  active = true,
}: {
  project: BookProject;
  commands: SlashCommand[];
  onOpen: (relativePath: string) => void;
  onChanged: () => void;
  onCommand: (command: string) => void;
  onQuit: () => void;
  active?: boolean;
}) {
  const {stdout} = useStdout();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [createMode, setCreateMode] = useState<CreateMode>();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('Ready');
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete>();
  const [renameTarget, setRenameTarget] = useState<DocumentEntry>();
  const [renameTitle, setRenameTitle] = useState('');
  const panelWidth = Math.min(76, Math.max(44, (stdout?.columns ?? 80) - 6));
  const screenHeight = Math.max(18, (stdout?.rows ?? 24) - 1);

  const entries: DocumentEntry[] = [
    {kind: 'cover', path: project.book.cover.document, label: 'Cover'},
    ...project.book.content.map(relativePath => ({
      kind: relativePath.startsWith('frontmatter/') ? 'section' as const
        : relativePath.startsWith('chapters/') ? 'chapter' as const : 'document' as const,
      path: relativePath,
      label: path.basename(relativePath, path.extname(relativePath)),
    })),
  ];

  const commandMode = query.startsWith('/');
  const results = useMemo(() => {
    if (commandMode) {
      const needle = query.toLowerCase();
      return commands.filter(command =>
        command.value.toLowerCase().includes(needle)
        || command.description.toLowerCase().includes(needle.slice(1)),
      );
    }

    return filterDocuments(entries, query);
  }, [commandMode, commands, entries, query]);

  const selectedIndex = Math.min(selected, Math.max(0, results.length - 1));
  const visibleLimit = commandMode
    ? Math.max(4, Math.min(8, screenHeight - 8))
    : Math.max(3, Math.min(4, screenHeight - 18));
  const {start: windowStart, end: windowEnd} = getListWindow(results.length, selectedIndex, visibleLimit);
  const visibleResults = results.slice(windowStart, windowStart + visibleLimit);

  async function openEntry(entry: DocumentEntry) {
    try {
      if (entry.kind === 'cover') await ensureCover(project);
      onOpen(entry.path);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function submitLauncher(value: string) {
    if (value.startsWith('/')) {
      const exact = commands.find(command => command.value === value.trim());
      const command = exact ?? results[selectedIndex];
      if (command && 'value' in command) onCommand(command.value);
      else setMessage('No matching command');
      return;
    }

    const entry = results[selectedIndex];
    if (entry && 'path' in entry) await openEntry(entry);
    else setMessage('No matching document');
  }

  async function create(value: string) {
    const cleanTitle = value.trim();
    if (!cleanTitle || !createMode) return;
    try {
      const relativePath = createMode === 'chapter'
        ? await addChapter(project, cleanTitle)
        : await addSection(project, cleanTitle);
      setCreateMode(undefined);
      setTitle('');
      onChanged();
      onOpen(relativePath);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function moveSelected(direction: 'up' | 'down') {
    const entry = results[selectedIndex];
    if (!entry || !('path' in entry) || entry.kind === 'cover') {
      setMessage('Cannot reorder the cover.');
      return;
    }
    try {
      await moveContentItem(project, entry.path, direction);
      onChanged();
      setMessage(`Moved ${entry.label} ${direction}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function confirmAndDelete() {
    if (!confirmDelete) return;
    try {
      await removeContentItem(project, confirmDelete.path);
      onChanged();
      setConfirmDelete(undefined);
      setSelected(value => Math.max(0, value - 1));
      setMessage(`Removed "${confirmDelete.label}" from the manuscript. The file was not deleted from disk.`);
    } catch (error) {
      setConfirmDelete(undefined);
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function renameSelected(value: string) {
    if (!renameTarget) return;
    try {
      const nextPath = await renameContentItem(project, renameTarget.path, value);
      setRenameTarget(undefined);
      setRenameTitle('');
      setQuery('');
      onChanged();
      setMessage(`Renamed document to ${nextPath}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  useInput((input, key) => {
    if (confirmDelete) {
      if (input === 'y' || input === 'Y') void confirmAndDelete();
      else { setConfirmDelete(undefined); setMessage('Deletion cancelled.'); }
      return;
    }
    if (createMode) {
      if (key.escape) {
        setCreateMode(undefined);
        setTitle('');
      }
      return;
    }
    if (renameTarget) {
      if (key.escape) {
        setRenameTarget(undefined);
        setRenameTitle('');
      }
      return;
    }

    if (input === '?' && !key.ctrl && !key.meta) {
      setQuery('');
      onCommand('/help');
    } else if (key.escape) {
      setQuery('');
      setSelected(0);
    } else if (key.ctrl && input === 'q') onQuit();
    else if (key.ctrl && input === 'p') {
      setQuery('/');
      setSelected(0);
    } else if (key.ctrl && input === 'n') setCreateMode('chapter');
    else if (key.ctrl && input === 't') setCreateMode('section');
    else if (key.ctrl && input === 'o') {
      void ensureCover(project).then(onOpen).catch(error => setMessage(String(error)));
    } else if (key.ctrl && input === 'x') onCommand('/export');
    else if (key.ctrl && input === 'd') onQuit();   // Ctrl+D — quit (EOF convention)
    else if (key.ctrl && input === 'r') onCommand('/review');
    else if (key.ctrl && input === 'e') {
      const entry = results[selectedIndex];
      if (!entry || !('path' in entry) || entry.kind === 'cover' || commandMode) {
        setMessage('Select a manuscript document to rename.');
      } else {
        setRenameTarget(entry);
        setRenameTitle(entry.label.replace(/^\d+-/, '').replaceAll('-', ' '));
      }
    }
    else if (key.meta && key.upArrow) void moveSelected('up');
    else if (key.meta && key.downArrow) void moveSelected('down');
    else if ((key.ctrl && (key.delete || key.backspace)) || (key.ctrl && input === 'w')) {
      // Ctrl+Delete or Ctrl+Backspace: remove selected document entry
      const entry = results[selectedIndex];
      if (!entry || !('path' in entry)) { setMessage('No document selected.'); return; }
      if (entry.kind === 'cover') { setMessage('The cover cannot be removed this way.'); return; }
      if (commandMode) return;
      setConfirmDelete({path: entry.path, label: entry.label});
      setMessage(`Remove "${entry.label}" from the manuscript? Press Y to confirm, any other key to cancel.`);
    } else if (key.pageUp) setSelected(value => Math.max(0, value - visibleLimit));
    else if (key.pageDown) setSelected(value => Math.min(Math.max(0, results.length - 1), value + visibleLimit));
    else if (key.upArrow) setSelected(value => Math.max(0, value - 1));
    else if (key.downArrow) setSelected(value => Math.min(Math.max(0, results.length - 1), value + 1));
  }, {isActive: active});

  return (
    <Box width="100%" height={screenHeight} alignItems="center" justifyContent="center" flexDirection="column">
      <Box width={panelWidth} flexDirection="column">
        {!commandMode && (
          <Logo />
        )}

        <Box marginTop={commandMode ? 0 : 1} flexDirection="column" paddingX={1}>
          <Box justifyContent="space-between">
            <Text dimColor>{commandMode ? 'Commands' : query ? 'Matching documents' : 'Manuscript'}</Text>
            {results.length > 0 && (
              <Text dimColor>
                {windowStart > 0 ? '↑ ' : ''}{windowStart + 1}–{windowEnd} of {results.length}{windowEnd < results.length ? ' ↓' : ''}
              </Text>
            )}
          </Box>
          {visibleResults.map((result, index) => {
            const resultIndex = windowStart + index;
            const isSelected = resultIndex === selectedIndex;
            const primary = 'value' in result ? result.value : result.label;
            const secondary = 'value' in result ? result.description : result.path;
            const marker = 'value' in result ? '›' : result.kind === 'cover' ? '◆' : '·';
            return (
              <Box key={'value' in result ? result.value : result.path}>
                <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>{isSelected ? marker : ' '} {primary}</Text>
                <Text dimColor>  {secondary}</Text>
              </Box>
            );
          })}
          {results.length === 0 && <Text dimColor>  No results</Text>}
        </Box>

        {!commandMode && (
          <Box justifyContent="center" marginTop={1}>
            <Text dimColor>
              {project.book.title} · {path.basename(project.root)} · {project.book.content.length} files · {project.book.language} · {project.book.output.mainFont || 'automatic font'}
            </Text>
          </Box>
        )}

        <Box marginTop={1} borderStyle="round" borderColor={commandMode ? 'cyan' : 'gray'} paddingX={1}>
          <Text color="cyan">{commandMode ? '› ' : '⌕ '}</Text>
          <TextInput
            value={query}
            onChange={value => {
              setQuery(value);
              setSelected(0);
            }}
            onSubmit={value => void submitLauncher(value)}
            placeholder="Search manuscript · / commands · ? shortcuts"
            focus={active && !createMode && !renameTarget}
          />
        </Box>

        {createMode && (
          <Box marginTop={1}>
            <Prompt
              label={createMode === 'chapter' ? 'Chapter title' : 'Section title'}
              value={title}
              onChange={setTitle}
              onSubmit={value => void create(value)}
            />
          </Box>
        )}

        {renameTarget && (
          <Box marginTop={1}>
            <Prompt label="Rename document" value={renameTitle} onChange={setRenameTitle} onSubmit={value => void renameSelected(value)} />
          </Box>
        )}

        <Box marginTop={1} justifyContent="center">
          <Text dimColor>? shortcuts · / commands · Ctrl+D/Q quit</Text>
        </Box>
        {message !== 'Ready' && (
          <Box justifyContent="center"><Text color="yellow">{message}</Text></Box>
        )}
      </Box>
    </Box>
  );
}
