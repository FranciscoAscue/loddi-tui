import React, {useEffect, useMemo, useState} from 'react';
import {Box, Text, useInput, useStdout} from 'ink';
import TextInput from 'ink-text-input';
import {getListWindow} from '../domain/launcher.js';
import {listSystemFonts} from '../services/fonts.js';
import {BookProject, saveBook} from '../services/project.js';

interface FontChoice {
  label: string;
  value: string | undefined;
}

export function FontsScreen({
  project,
  onBack,
  onChanged,
}: {
  project: BookProject;
  onBack: () => void;
  onChanged: () => void;
}) {
  const {stdout} = useStdout();
  const [fonts, setFonts] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Reading fonts available to Typst…');
  const visibleLimit = Math.max(4, Math.min(8, (stdout.rows || 24) - 14));

  useEffect(() => {
    let active = true;
    void listSystemFonts()
      .then(result => {
        if (!active) return;
        setFonts(result);
        setMessage(`${result.length} font families detected.`);
      })
      .catch(error => {
        if (active) setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => { active = false; };
  }, []);

  const choices = useMemo<FontChoice[]>(() => {
    const needle = query.trim().toLocaleLowerCase();
    const automatic: FontChoice = {label: 'Automatic (Typst fallback)', value: undefined};
    const matches = fonts
      .filter(font => !needle || font.toLocaleLowerCase().includes(needle))
      .map(font => ({label: font, value: font}));
    return needle ? matches : [automatic, ...matches];
  }, [fonts, query]);
  const selectedIndex = Math.min(selected, Math.max(0, choices.length - 1));
  const {start, end} = getListWindow(choices.length, selectedIndex, visibleLimit);
  const visibleChoices = choices.slice(start, end);

  async function choose() {
    const choice = choices[selectedIndex];
    if (!choice) return;
    setBusy(true);
    try {
      if (choice.value) project.book.output.mainFont = choice.value;
      else delete project.book.output.mainFont;
      await saveBook(project);
      onChanged();
      setMessage(choice.value ? `PDF font set to ${choice.value}.` : 'Automatic font fallback enabled.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  useInput((_input, key) => {
    if (key.escape) onBack();
    else if (busy) return;
    else if (key.upArrow) setSelected(value => Math.max(0, value - 1));
    else if (key.downArrow) setSelected(value => Math.min(Math.max(0, choices.length - 1), value + 1));
    else if (key.pageUp) setSelected(value => Math.max(0, value - visibleLimit));
    else if (key.pageDown) setSelected(value => Math.min(Math.max(0, choices.length - 1), value + visibleLimit));
    else if (key.return) void choose();
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="white">Book typography</Text>
        <Text dimColor>Current: {project.book.output.mainFont || 'Automatic'}</Text>
      </Box>
      <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Text dimColor>⌕ </Text>
        <TextInput
          value={query}
          onChange={value => {
            setQuery(value);
            setSelected(0);
          }}
          placeholder="Filter installed fonts"
          focus={!busy}
        />
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Box justifyContent="space-between">
          <Text dimColor>Fonts available to the PDF engine</Text>
          {choices.length > 0 && <Text dimColor>{start > 0 ? '↑ ' : ''}{start + 1}–{end} of {choices.length}{end < choices.length ? ' ↓' : ''}</Text>}
        </Box>
        {visibleChoices.map((choice, index) => {
          const active = start + index === selectedIndex;
          return (
            <Text key={choice.value || 'automatic'} color={active ? 'white' : 'gray'} bold={active}>
              {active ? '›' : ' '} {choice.label}{choice.value === project.book.output.mainFont ? '  ✓' : ''}
            </Text>
          );
        })}
        {!busy && choices.length === 0 && <Text dimColor>No matching fonts.</Text>}
      </Box>
      <Text dimColor>↑↓ select · PgUp/PgDn scroll · Enter apply · Esc back</Text>
      <Text color={message.startsWith('PDF font set') ? 'green' : 'white'}>{busy ? '◌ ' : ''}{message}</Text>
    </Box>
  );
}
