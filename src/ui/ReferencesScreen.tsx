import React, {useMemo, useState} from 'react';
import {readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Box, Text, useInput, useStdout} from 'ink';
import TextInput from 'ink-text-input';
import {getListWindow} from '../domain/launcher.js';
import {
  appendMissingBibtex,
  deleteEntryByKey,
  getBibtexField,
  parseBibtex,
  updateBibtexField,
  type EditableBibField,
} from '../services/bibliography.js';
import {BookProject, readDocument, saveDocument} from '../services/project.js';
import {Prompt} from './Prompt.js';

type Mode = 'list' | 'import' | 'detail' | 'edit' | 'confirmDelete';

export function ReferencesScreen({project, onBack, onBibChanged}: {project: BookProject; onBack: () => void; onBibChanged?: () => void}) {
  const {stdout} = useStdout();
  const [source, setSource] = useState<string>();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('list');
  const [importPath, setImportPath] = useState('');
  const [editingField, setEditingField] = useState<EditableBibField>('title');
  const [editingValue, setEditingValue] = useState('');
  const [message, setMessage] = useState('Loading bibliography…');
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState(0);
  const visibleLimit = Math.max(4, Math.min(10, (stdout.rows || 24) - 14));
  const bibliography = useMemo(() => parseBibtex(source ?? ''), [source]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return bibliography.filter(entry =>
      !needle || entry.key.toLocaleLowerCase().includes(needle)
      || entry.title.toLocaleLowerCase().includes(needle)
      || entry.type.toLocaleLowerCase().includes(needle),
    );
  }, [bibliography, query]);
  const selectedIndex = Math.min(selected, Math.max(0, filtered.length - 1));
  const {start, end} = getListWindow(filtered.length, selectedIndex, visibleLimit);
  const selectedEntry = filtered[selectedIndex];

  React.useEffect(() => {
    let active = true;
    void readDocument(project, project.book.bibliography)
      .catch(() => '')
      .then(contents => {
        if (!active) return;
        setSource(contents);
        setMessage(`${parseBibtex(contents).length} references · ${project.book.bibliography}`);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => { active = false; };
  }, [project]);

  async function importLibrary(fileName: string) {
    const input = fileName.trim();
    if (!input) return;
    setBusy(true);
    try {
      const expanded = input === '~' ? os.homedir() : input.startsWith(`~${path.sep}`)
        ? path.join(os.homedir(), input.slice(2))
        : input;
      const resolved = path.resolve(expanded);
      if (path.resolve(project.root, project.book.bibliography) === resolved) {
        throw new Error('Choose a BibTeX export file. This is already the project library.');
      }
      const imported = await readFile(resolved, 'utf8');
      const result = appendMissingBibtex(source ?? '', imported);
      if (result.added === 0 && result.skipped === 0) throw new Error('No BibTeX entries were found in that file.');
      await saveDocument(project, project.book.bibliography, result.contents);
      setSource(result.contents);
      setMode('list');
      setSelected(0);
      onBibChanged?.();
      setMessage(`Imported ${result.added} references; skipped ${result.skipped} duplicate keys.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setMode('list');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!selectedEntry) return;
    setBusy(true);
    try {
      const updated = deleteEntryByKey(source ?? '', selectedEntry.key);
      await saveDocument(project, project.book.bibliography, updated);
      setSource(updated);
      setSelected(value => Math.max(0, value - 1));
      onBibChanged?.();
      setMessage(`Deleted reference: ${selectedEntry.key}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      setMode('list');
    }
  }

  function beginEdit(field: EditableBibField) {
    if (!selectedEntry) return;
    setEditingField(field);
    setEditingValue(getBibtexField(selectedEntry.raw, field));
    setMode('edit');
  }

  async function saveField(value: string) {
    if (!selectedEntry) return;
    setBusy(true);
    try {
      const updated = updateBibtexField(source ?? '', selectedEntry.key, editingField, value);
      await saveDocument(project, project.book.bibliography, updated);
      setSource(updated);
      setQuery('');
      setSelected(0);
      onBibChanged?.();
      setMessage(`Updated ${editingField} for ${selectedEntry.key}.`);
      setMode('list');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  useInput((input, key) => {
    if (mode === 'import') {
      if (key.escape) setMode('list');
      return;
    }
    if (mode === 'edit') {
      if (key.escape) setMode('detail');
      return;
    }
    if (mode === 'confirmDelete') {
      if (input === 'y' || input === 'Y') void deleteSelected();
      else setMode('list');
      return;
    }
    if (mode === 'detail') {
      if (input.toLowerCase() === 't') beginEdit('title');
      else if (input.toLowerCase() === 'a') beginEdit('author');
      else if (input.toLowerCase() === 'y') beginEdit('year');
      else if (key.escape || key.return) setMode('list');
      return;
    }
    // list mode
    if (key.escape) { onBack(); return; }
    if (busy) return;
    if (key.ctrl && input === 'i') {
      setImportPath('');
      setMode('import');
      setMessage('Enter a .bib file path exported from Zotero or another reference manager.');
    } else if (key.ctrl && input === 'd') {
      if (selectedEntry) setMode('confirmDelete');
      else setMessage('No entry selected.');
    } else if (key.return || input === ' ') {
      if (selectedEntry) setMode('detail');
    } else if (key.upArrow) setSelected(value => Math.max(0, value - 1));
    else if (key.downArrow) setSelected(value => Math.min(Math.max(0, filtered.length - 1), value + 1));
    else if (key.pageUp) setSelected(value => Math.max(0, value - visibleLimit));
    else if (key.pageDown) setSelected(value => Math.min(Math.max(0, filtered.length - 1), value + visibleLimit));
    else if (key.ctrl && input === 'q') onBack();
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="white">References</Text>
        <Text dimColor>{bibliography.length} entries</Text>
      </Box>
      <Text dimColor>{project.book.bibliography} · BibTeX · export a library from Zotero as BibTeX to import it</Text>

      <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Text dimColor>⌕ </Text>
        <TextInput
          value={query}
          onChange={value => {
            setQuery(value);
            setSelected(0);
          }}
          placeholder="Filter citation key, title, or type"
          focus={mode === 'list' && !busy}
        />
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Box justifyContent="space-between">
          <Text dimColor>Project bibliography</Text>
          {filtered.length > 0 && <Text dimColor>{start > 0 ? '↑ ' : ''}{start + 1}–{end} of {filtered.length}{end < filtered.length ? ' ↓' : ''}</Text>}
        </Box>
        {filtered.slice(start, end).map((entry, index) => (
          <Box key={`${entry.key}-${index}`}>
            <Text color={start + index === selectedIndex ? 'white' : 'gray'} bold={start + index === selectedIndex}>
              {start + index === selectedIndex ? '›' : ' '} {entry.key.padEnd(24)}
            </Text>
            <Text dimColor>{entry.title || entry.type}</Text>
          </Box>
        ))}
        {filtered.length === 0 && <Text dimColor>{bibliography.length ? 'No matching references.' : 'No citations yet. Import a BibTeX library with Ctrl+I.'}</Text>}
      </Box>

      {mode === 'import' && (
        <Box marginTop={1}>
          <Prompt label="Zotero / BibTeX file" value={importPath} onChange={setImportPath} onSubmit={value => void importLibrary(value)} />
        </Box>
      )}

      {mode === 'confirmDelete' && selectedEntry && (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">Delete reference <Text bold>{selectedEntry.key}</Text>?  Press Y to confirm, any other key to cancel.</Text>
        </Box>
      )}

      {mode === 'detail' && selectedEntry && (
        <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
          <Text bold color="white">{selectedEntry.key}</Text>
          <Text dimColor>Type: {selectedEntry.type}</Text>
          <Text dimColor>Title: {getBibtexField(selectedEntry.raw, 'title') || '—'}</Text>
          <Text dimColor>Author: {getBibtexField(selectedEntry.raw, 'author') || '—'}</Text>
          <Text dimColor>Year: {getBibtexField(selectedEntry.raw, 'year') || '—'}</Text>
          <Text dimColor>T title · A author · Y year · Esc back</Text>
        </Box>
      )}

      {mode === 'edit' && selectedEntry && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Editing {editingField} for {selectedEntry.key}</Text>
          <Prompt label={editingField} value={editingValue} onChange={setEditingValue} onSubmit={value => void saveField(value)} />
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>↑↓/PgUp/PgDn scroll · Enter details/edit · Ctrl+I import · Ctrl+D delete · Esc back</Text>
      </Box>
      <Text color={message.startsWith('Imported') || message.startsWith('Deleted') ? 'green' : 'white'}>{busy ? '◌ ' : ''}{message}</Text>
    </Box>
  );
}
