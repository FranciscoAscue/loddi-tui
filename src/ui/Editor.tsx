import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text, useInput, useStdout} from 'ink';
import {
  EditorBuffer,
  backspace,
  createBuffer,
  deleteCurrentLine,
  deleteForward,
  deleteWordForward,
  findFrom,
  indentAtCursor,
  insertNewline,
  insertText,
  moveCursor,
  moveCursorByPage,
  serializeBuffer,
  visibleStart,
} from '../domain/editor-buffer.js';
import {cursorFromMouse, parseMouseInput} from '../domain/editor-mouse.js';
import {applyAiEdit, blockText, validateAiEdit} from '../domain/ai-edit.js';
import {askCodex, type AiMode} from '../services/codex.js';
import {getCodexAuthStatus, loginCodexWithDevice, type CodexAuthStatus} from '../services/codex-auth.js';
import {BookProject, readDocument, saveDocument} from '../services/project.js';
import {BibEntry, parseBibtex} from '../services/bibliography.js';
import {classifyMarkdownLines, fencedLanguagesForLines, findMarkdownBlock, focusMarkdownBlock, highlightMarkdownLine, insertTemplate, removeMarkdownBlock, type HighlightKind, type InsertTemplate, type MarkdownBlock} from '../domain/markdown-editing.js';
import {Prompt} from './Prompt.js';
import {Overlay} from './Overlay.js';

const insertOptions: Array<{key: string; template: InsertTemplate; label: string}> = [
  {key: 'H', template: 'heading', label: 'Heading'},
  {key: 'B', template: 'bold', label: 'Bold'},
  {key: 'L', template: 'list', label: 'List item'},
  {key: 'C', template: 'code', label: 'Code block'},
  {key: 'D', template: 'mermaid', label: 'Mermaid diagram'},
  {key: 'M', template: 'math', label: 'LaTeX math'},
  {key: 'I', template: 'image', label: 'Image'},
];
const menuOptions = [
  {key: 'A', label: 'AI assistant (insert / edit / chat)'},
  ...insertOptions.map(option => ({key: option.key, label: option.label, template: option.template as InsertTemplate})),
  {key: 'E', label: 'Edit block at cursor'},
  {key: 'X', label: 'Delete block at cursor'},
];

function HighlightedLine({line, kind, language, cursor}: {line: string; kind: HighlightKind; language?: string; cursor?: number}) {
  const fragments: React.ReactNode[] = [];
  let position = 0;
  let part = 0;
  function append(value: string, color?: string, bold?: boolean) {
    if (!value) return;
    const from = position;
    const to = from + value.length;
    const selected = cursor !== undefined && cursor >= from && cursor < to ? cursor - from : -1;
    const style = {...(color ? {color} : {}), ...(bold ? {bold} : {})};
    if (selected < 0) fragments.push(<Text key={part++} {...style}>{value}</Text>);
    else {
      if (selected > 0) fragments.push(<Text key={part++} {...style}>{value.slice(0, selected)}</Text>);
      fragments.push(<Text key={part++} inverse>{value[selected]}</Text>);
      if (selected + 1 < value.length) fragments.push(<Text key={part++} {...style}>{value.slice(selected + 1)}</Text>);
    }
    position = to;
  }
  for (const span of highlightMarkdownLine(line, kind, language)) append(span.text, span.color, span.bold);
  if (cursor === line.length) fragments.push(<Text key={part++} inverse> </Text>);
  return <Text>{fragments}</Text>;
}

function SourceView({buffer, height}: {buffer: EditorBuffer; height: number}) {
  const start = visibleStart(buffer, height);
  const visible = buffer.lines.slice(start, start + height);
  const gutterWidth = String(buffer.lines.length).length;
  const kinds = classifyMarkdownLines(buffer.lines);
  const languages = fencedLanguagesForLines(buffer.lines);
  return (
    <Box flexDirection="column" overflow="hidden">
      {visible.map((line, offset) => {
        const row = start + offset;
        const active = row === buffer.cursor.row;
        return (
          <Text key={row} wrap="truncate-end">
            <Text dimColor>{String(row + 1).padStart(gutterWidth)} │ </Text>
            <HighlightedLine line={line} kind={kinds[row] ?? 'plain'} {...(languages[row] ? {language: languages[row]} : {})} {...(active ? {cursor: buffer.cursor.column} : {})} />
          </Text>
        );
      })}
    </Box>
  );
}

export function Editor({
  project,
  relativePath,
  bibRevision = 0,
  onClose,
}: {
  project: BookProject;
  relativePath: string;
  bibRevision?: number;
  onClose: () => void;
}) {
  const {stdout} = useStdout();
  const [buffer, setBuffer] = useState<EditorBuffer>(() => createBuffer(''));
  const [savedText, setSavedText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [insertMenu, setInsertMenu] = useState(false);
  const [menuSelection, setMenuSelection] = useState(0);
  const [confirmBlockDelete, setConfirmBlockDelete] = useState<MarkdownBlock>();
  const [status, setStatus] = useState('Loading…');
  const [search, setSearch] = useState<string>();
  const [citationSearch, setCitationSearch] = useState<string>();
  const [bibliography, setBibliography] = useState<BibEntry[]>([]);
  const [selectedCitation, setSelectedCitation] = useState(0);
  const [citationBasket, setCitationBasket] = useState<string[]>([]); // accumulated keys
  const [citationNarrative, setCitationNarrative] = useState(false);  // narrative vs parenthetical
  const [quitArmed, setQuitArmed] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>('insert');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiPreviewOffset, setAiPreviewOffset] = useState(0);
  const [aiResult, setAiResult] = useState<{text: string; mode: AiMode; block?: MarkdownBlock; source: string}>();
  const [aiHistory, setAiHistory] = useState<Array<{question: string; answer: string}>>([]);
  const [aiAuth, setAiAuth] = useState<CodexAuthStatus | {kind: 'checking' | 'signing-in'; detail: string}>({kind: 'checking', detail: ''});
  const [aiAuthOutput, setAiAuthOutput] = useState('');
  const aiAbort = useRef<AbortController | undefined>(undefined);
  const authAbort = useRef<AbortController | undefined>(undefined);
  const contents = serializeBuffer(buffer);
  const dirty = contents !== savedText;
  const height = Math.max(8, (stdout.rows || 24) - 6);
  const citationMatches = useMemo(() => {
    const needle = citationSearch?.trim().toLocaleLowerCase() ?? '';
    return bibliography.filter(entry =>
      !needle || entry.key.toLocaleLowerCase().includes(needle)
      || entry.title.toLocaleLowerCase().includes(needle),
    ).slice(0, 8);
  }, [bibliography, citationSearch]);

  useEffect(() => {
    if (!stdout.isTTY || insertMenu || aiOpen || confirmBlockDelete
      || search !== undefined || citationSearch !== undefined) return;
    stdout.write('\x1b[?1000h\x1b[?1006h');
    return () => { stdout.write('\x1b[?1000l\x1b[?1006l'); };
  }, [stdout, insertMenu, aiOpen, confirmBlockDelete, search, citationSearch]);

  useEffect(() => () => {
    aiAbort.current?.abort();
    authAbort.current?.abort();
  }, []);

  useEffect(() => {
    let active = true;
    void readDocument(project, relativePath)
      .then(text => {
        if (!active) return;
        setBuffer(createBuffer(text));
        setSavedText(text);
        setLoaded(true);
        setStatus('Ready');
      })
      .catch(error => setStatus(error instanceof Error ? error.message : String(error)));
    return () => { active = false; };
  }, [project, relativePath]);

  useEffect(() => {
    let active = true;
    void readDocument(project, project.book.bibliography)
      .then(text => {
        if (active) setBibliography(parseBibtex(text));
      })
      .catch(() => {
        if (active) setBibliography([]);
      });
    return () => { active = false; };
  }, [project, bibRevision]);

  async function save() {
    const text = serializeBuffer(buffer);
    try {
      await saveDocument(project, relativePath, text);
      setSavedText(text);
      setStatus('Saved');
      setQuitArmed(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function addTemplate(template: InsertTemplate) {
    setBuffer(value => insertTemplate(value, template));
    setStatus(`Inserted ${insertOptions.find(option => option.template === template)?.label ?? template}.`);
    setInsertMenu(false);
  }

  function chooseMenuOption(option: (typeof menuOptions)[number]) {
    setInsertMenu(false);
    if (option.key === 'A') {
      authAbort.current?.abort();
      setAiMode('insert');
      setAiPrompt('');
      setAiError('');
      setAiResult(undefined);
      setAiHistory([]);
      setAiOpen(true);
      refreshAiAuth();
      return;
    }
    if ('template' in option && option.template) {
      addTemplate(option.template);
      return;
    }
    const block = findMarkdownBlock(buffer);
    if (!block) {
      setStatus('No editable Markdown block at the cursor.');
      return;
    }
    if (option.key === 'E') {
      setBuffer(value => focusMarkdownBlock(value, block));
      setStatus(`Editing ${block.label}. Change its Markdown directly, then press Ctrl+S.`);
    } else if (option.key === 'X') {
      setConfirmBlockDelete(block);
    }
  }

  function refreshAiAuth() {
    authAbort.current?.abort();
    const controller = new AbortController();
    authAbort.current = controller;
    setAiAuth({kind: 'checking', detail: ''});
    void getCodexAuthStatus(controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setAiAuth(result);
      })
      .catch(error => {
        if (!controller.signal.aborted) setAiAuth({kind: 'error', detail: error instanceof Error ? error.message : String(error)});
      });
  }

  function startDeviceAuth() {
    authAbort.current?.abort();
    const controller = new AbortController();
    authAbort.current = controller;
    setAiAuthOutput('');
    setAiAuth({kind: 'signing-in', detail: ''});
    void loginCodexWithDevice(message => {
      if (!controller.signal.aborted) setAiAuthOutput(message);
    }, controller.signal)
      .then(() => { if (!controller.signal.aborted) refreshAiAuth(); })
      .catch(error => {
        if (!controller.signal.aborted) setAiAuth({kind: 'error', detail: error instanceof Error ? error.message : String(error)});
      });
  }

  function closeAi() {
    aiAbort.current?.abort();
    authAbort.current?.abort();
    aiAbort.current = undefined;
    authAbort.current = undefined;
    setAiOpen(false);
    setAiResult(undefined);
    setAiBusy(false);
  }

  async function submitAi(instruction: string) {
    if (!instruction.trim() || aiBusy || aiAuth.kind !== 'ready') return;
    const block = aiMode === 'edit' ? findMarkdownBlock(buffer) : undefined;
    if (aiMode === 'edit' && !block) {
      setAiError('Move the cursor into a Markdown block before choosing Edit.');
      return;
    }
    const contextBlock = block ?? findMarkdownBlock(buffer);
    const context = contextBlock ? blockText(buffer, contextBlock) : (buffer.lines[buffer.cursor.row] ?? '');
    const controller = new AbortController();
    aiAbort.current = controller;
    setAiError('');
    setAiBusy(true);
    try {
      const auth = await getCodexAuthStatus(controller.signal);
      if (auth.kind !== 'ready') {
        setAiAuth(auth);
        return;
      }
      const text = await askCodex({
        mode: aiMode,
        instruction: instruction.trim(),
        context,
        label: contextBlock?.label ?? 'current line',
        ...(aiMode === 'chat' ? {history: aiHistory.slice(-4)} : {}),
      }, controller.signal);
      if (controller.signal.aborted) return;
      const error = aiMode === 'edit' ? validateAiEdit(text, block) : aiMode === 'insert' ? validateAiEdit(text) : undefined;
      if (error) {
        setAiError(error);
        return;
      }
      if (aiMode === 'chat') setAiHistory(value => [...value, {question: instruction.trim(), answer: text}]);
      setAiResult({text, mode: aiMode, ...(block ? {block} : {}), source: serializeBuffer(buffer)});
      setAiPreviewOffset(0);
    } catch (error) {
      if (!controller.signal.aborted) setAiError(error instanceof Error ? error.message : String(error));
    } finally {
      if (aiAbort.current === controller) aiAbort.current = undefined;
      if (!controller.signal.aborted) setAiBusy(false);
    }
  }

  useInput((input, key) => {
    const mouse = parseMouseInput(input);
    if (mouse || input.startsWith('[<')) {
      if (mouse && !aiOpen && !insertMenu && !confirmBlockDelete && search === undefined && citationSearch === undefined) {
        if (mouse.kind === 'scroll') setBuffer(value => moveCursorByPage(value, mouse.direction, 4));
        else setBuffer(value => cursorFromMouse(value, mouse.x, mouse.y, height) ?? value);
      }
      return;
    }
    if (aiOpen) {
      if (key.escape || (key.ctrl && input === 'q')) closeAi();
      else if (aiAuth.kind !== 'ready') {
        if (key.return && aiAuth.kind === 'signed-out') startDeviceAuth();
        else if (input.toLowerCase() === 'r' && aiAuth.kind !== 'signing-in') refreshAiAuth();
      } else if (aiResult) {
        if (key.upArrow) setAiPreviewOffset(value => Math.max(0, value - 1));
        else if (key.downArrow) setAiPreviewOffset(value => value + 1);
        else if (key.pageUp) setAiPreviewOffset(value => Math.max(0, value - 8));
        else if (key.pageDown) setAiPreviewOffset(value => value + 8);
        else if (key.return) {
          if (aiResult.mode === 'chat') {
            setAiResult(undefined);
            setAiPrompt('');
          } else if (serializeBuffer(buffer) === aiResult.source) {
            setBuffer(value => applyAiEdit(value, aiResult.text, aiResult.block));
            setStatus('AI proposal inserted. Review it, then press Ctrl+S to save.');
            closeAi();
          } else setAiError('The document changed. Discard and ask Codex again.');
        }
      } else if (!aiBusy && key.tab) {
        setAiMode(value => value === 'insert' ? 'edit' : value === 'edit' ? 'chat' : 'insert');
        setAiError('');
      }
      return;
    }
    if (confirmBlockDelete) {
      if (input.toLowerCase() === 'y') {
        setBuffer(value => removeMarkdownBlock(value, confirmBlockDelete));
        setStatus(`Removed ${confirmBlockDelete.label}. Press Ctrl+S to save.`);
      } else setStatus('Block deletion cancelled.');
      setConfirmBlockDelete(undefined);
      return;
    }
    if (insertMenu) {
      if (key.escape || (key.ctrl && input === 'p')) setInsertMenu(false);
      else if (key.upArrow) setMenuSelection(value => (value - 1 + menuOptions.length) % menuOptions.length);
      else if (key.downArrow) setMenuSelection(value => (value + 1) % menuOptions.length);
      else if (key.return) chooseMenuOption(menuOptions[menuSelection]!);
      else {
        const option = menuOptions.find(item => item.key.toLowerCase() === input.toLowerCase());
        if (option) chooseMenuOption(option);
      }
      return;
    }
    if (citationSearch !== undefined) {
      if (key.escape) {
        setCitationSearch(undefined);
        setCitationBasket([]);
      } else if (key.tab) {
        // Tab: add currently selected entry to basket without inserting
        const entry = citationMatches[selectedCitation];
        if (entry && !citationBasket.includes(entry.key)) {
          setCitationBasket(prev => [...prev, entry.key]);
          setStatus(`Basket: ${[...citationBasket, entry.key].join(', ')} — press Enter to insert, Tab for more`);
        }
      } else if (key.ctrl && input === 't') {
        setCitationNarrative(prev => !prev);
      } else if (key.upArrow) setSelectedCitation(value => Math.max(0, value - 1));
      else if (key.downArrow) setSelectedCitation(value => Math.min(Math.max(0, citationMatches.length - 1), value + 1));
      else if (key.pageUp) setSelectedCitation(value => Math.max(0, value - 5));
      else if (key.pageDown) setSelectedCitation(value => Math.min(Math.max(0, citationMatches.length - 1), value + 5));
      return;
    }
    if (search !== undefined) {
      if (key.escape) setSearch(undefined);
      return;
    }
    if (!loaded) return;
    if (key.ctrl && input === 's') {
      void save();
      return;
    }
    if (key.ctrl && input === 'q') {
      if (dirty && !quitArmed) {
        setQuitArmed(true);
        setStatus('There are unsaved changes. Press Ctrl+Q again to discard them.');
      } else onClose();
      return;
    }
    if (key.ctrl && input === 'p') {
      setMenuSelection(0);
      setInsertMenu(true);
      return;
    }
    if (key.ctrl && input === 'f') {
      setSearch('');
      return;
    }
    if (key.ctrl && input === 'i') {
      setCitationSearch('');
      setSelectedCitation(0);
      setCitationBasket([]);
      setCitationNarrative(false);
      return;
    }
    setQuitArmed(false);
    if (key.leftArrow) setBuffer(value => moveCursor(value, key.ctrl ? 'wordLeft' : 'left'));
    else if (key.rightArrow) setBuffer(value => moveCursor(value, key.ctrl ? 'wordRight' : 'right'));
    else if (key.upArrow) setBuffer(value => moveCursor(value, 'up'));
    else if (key.downArrow) setBuffer(value => moveCursor(value, 'down'));
    else if (key.home) setBuffer(value => moveCursor(value, 'home'));
    else if (key.end) setBuffer(value => moveCursor(value, 'end'));
    else if (key.pageUp) setBuffer(value => moveCursorByPage(value, 'up', height));
    else if (key.pageDown) setBuffer(value => moveCursorByPage(value, 'down', height));
    else if (key.backspace) setBuffer(backspace);
    else if (key.delete) setBuffer(key.ctrl ? deleteWordForward : deleteForward);
    else if (key.tab) setBuffer(indentAtCursor);
    else if (key.return) setBuffer(insertNewline);
    else if (key.ctrl && input === 'd') setBuffer(deleteCurrentLine);
    else if (input && !key.ctrl && !key.meta) setBuffer(value => insertText(value, input));
  }, {isActive: true});

  const wordCount = useMemo(() => contents.trim() ? contents.trim().split(/\s+/u).length : 0, [contents]);

  function submitSearch(query: string) {
    const found = findFrom(buffer, query);
    if (found) {
      setBuffer(value => ({...value, cursor: found}));
      setStatus(`Found: ${query}`);
    } else {
      setStatus(`Not found: ${query}`);
    }
    setSearch(undefined);
  }

  function submitCitation(query: string) {
    const normalized = query.trim().toLocaleLowerCase();
    // Determine the primary entry: exact match > selected in list > first basket item
    const exact = normalized ? bibliography.find(entry => entry.key.toLocaleLowerCase() === normalized) : undefined;
    const listEntry = citationMatches[selectedCitation];
    const primaryEntry = exact ?? (normalized ? listEntry : undefined);

    // Build the full set of keys: basket + primary (if not already there)
    const keySet: string[] = [...citationBasket];
    if (primaryEntry && !keySet.includes(primaryEntry.key)) keySet.push(primaryEntry.key);
    // If basket was used but Enter pressed with empty query, just commit basket
    if (keySet.length === 0 && citationBasket.length > 0) keySet.push(...citationBasket);

    if (keySet.length === 0) {
      setStatus('No matching references. Import a .bib file with /references.');
      setCitationSearch(undefined);
      setCitationBasket([]);
      return;
    }

    // Compose the citation string
    let citation: string;
    if (citationNarrative) {
      // Narrative form: @key1 [and @key2; @key3]
      if (keySet.length === 1) {
        citation = `@${keySet[0]}`;
      } else {
        const [first, ...rest] = keySet;
        citation = `@${first} [and ${rest.map(k => `@${k}`).join('; ')}]`;
      }
    } else {
      // Parenthetical form: [@key1; @key2]
      citation = `[${keySet.map(k => `@${k}`).join('; ')}]`;
    }

    setBuffer(value => insertText(value, citation));
    setStatus(`Citation inserted: ${citation}`);
    setCitationSearch(undefined);
    setCitationBasket([]);
  }

  if (confirmBlockDelete) return (
    <Overlay width={stdout.columns || 80}>
      <Text bold color="yellow">Delete {confirmBlockDelete.label}?</Text>
      <Text dimColor>This removes the complete Markdown block from the buffer.</Text>
      <Text dimColor>Press Y to confirm · any other key to cancel · Ctrl+S saves later</Text>
    </Overlay>
  );

  if (insertMenu) return (
    <Overlay width={stdout.columns || 80}>
      <Text bold color="white">Insert Markdown</Text>
      <Text dimColor>↑↓ select · Enter apply · letter quick select · Esc cancel</Text>
      <Box flexDirection="column" marginTop={1}>
        {menuOptions.map((option, index) => (
          <Text key={option.key} color={index === menuSelection ? 'white' : 'gray'} bold={index === menuSelection}>
            {index === menuSelection ? '›' : ' '} <Text color="cyan">{option.key}</Text>  {option.label}
          </Text>
        ))}
      </Box>
    </Overlay>
  );

  if (aiOpen) {
    const previewLines = aiResult?.text.split('\n') ?? [];
    const previewHeight = Math.max(4, Math.min(12, (stdout.rows || 24) - 10));
    const previewStart = Math.min(aiPreviewOffset, Math.max(0, previewLines.length - previewHeight));
    return (
      <Overlay width={stdout.columns || 80}>
        <Text bold color="white">Codex assistant</Text>
        {aiAuth.kind === 'checking' && <Text dimColor>Checking Codex sign-in…</Text>}
        {aiAuth.kind === 'missing' && (
          <Box flexDirection="column">
            <Text color="yellow">Codex CLI is not installed.</Text>
            <Text>Install: npm install -g @openai/codex</Text>
            <Text dimColor>Then press R to check again · Esc close</Text>
          </Box>
        )}
        {aiAuth.kind === 'signed-out' && (
          <Box flexDirection="column">
            <Text color="yellow">Codex is not signed in.</Text>
            <Text>Press Enter to sign in with a browser code.</Text>
            <Text dimColor>R check again · Esc close · Loddi never asks for your password or API key</Text>
          </Box>
        )}
        {aiAuth.kind === 'signing-in' && (
          <Box flexDirection="column">
            <Text color="cyan">Sign in to Codex</Text>
            <Text dimColor>Open the URL below in your browser and enter the code. Do not share it.</Text>
            {aiAuthOutput.split('\n').slice(-10).map((line, index) => <Text key={index} wrap="truncate-end">{line || ' '}</Text>)}
            <Text dimColor>Waiting for sign-in… Esc cancels</Text>
          </Box>
        )}
        {aiAuth.kind === 'error' && (
          <Box flexDirection="column">
            <Text color="yellow">{aiAuth.detail}</Text>
            <Text dimColor>If device sign-in is unavailable, run codex login in another terminal.</Text>
            <Text dimColor>R check again · Esc close</Text>
          </Box>
        )}
        {aiAuth.kind === 'ready' && (
          <Box flexDirection="column">
            <Text color="green">{aiAuth.detail}</Text>
            <Text dimColor>Mode: {aiMode === 'insert' ? 'Insert at cursor' : aiMode === 'edit' ? 'Edit block at cursor' : 'Chat'} · Tab change mode · Esc close</Text>
            {!aiResult && !aiBusy && <Prompt label="Ask Codex" value={aiPrompt} onChange={setAiPrompt} onSubmit={value => { void submitAi(value); }} />}
            {aiBusy && <Text color="cyan">Codex is working… Esc cancels</Text>}
            {aiError && <Text color="yellow">{aiError}</Text>}
          </Box>
        )}
        {aiAuth.kind === 'ready' && aiResult && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>{aiResult.mode === 'chat' ? 'Answer' : 'Proposal — review before applying'} · {previewLines.length} lines</Text>
            <Box flexDirection="column" height={previewHeight} overflow="hidden">
              {previewLines.slice(previewStart, previewStart + previewHeight).map((line, index) => <Text key={previewStart + index} wrap="truncate-end">{line || ' '}</Text>)}
            </Box>
            <Text dimColor>↑↓/PgUp/PgDn scroll · {aiResult.mode === 'chat' ? 'Enter ask again' : 'Enter apply to unsaved buffer'} · Esc discard</Text>
          </Box>
        )}
        <Text dimColor>Codex owns the sign-in. Loddi sends only the current excerpt and applies nothing without review.</Text>
      </Overlay>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box paddingX={1} justifyContent="space-between">
        <Text bold color="cyan">{relativePath} <Text color={dirty ? 'yellow' : 'green'}>{dirty ? '●' : '✓'}</Text></Text>
        <Text dimColor>MARKDOWN</Text>
      </Box>
      <Box height={height + 3} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} overflow="hidden">
        <SourceView buffer={buffer} height={height} />
      </Box>
      <Box justifyContent="space-between" paddingX={1}>
        <Text dimColor>Ln {buffer.cursor.row + 1}, Col {buffer.cursor.column + 1} · {wordCount} words</Text>
        <Text dimColor>^S save · ^P insert · ^F find · ^I cite · ^Q back</Text>
      </Box>
      <Text dimColor>{status}</Text>
      {search !== undefined && (
        <Prompt label="Find" value={search} onChange={setSearch} onSubmit={submitSearch} />
      )}
      {citationSearch !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          <Box justifyContent="space-between">
            <Text dimColor>Insert citation from {project.book.bibliography}</Text>
            <Text dimColor>{citationNarrative ? 'Narrative (@key)' : 'Parenthetical ([@key])'} · ^T toggle</Text>
          </Box>
          {citationBasket.length > 0 && (
            <Text color="cyan">Basket: {citationBasket.map(k => `@${k}`).join('; ')} — Tab to add more, Enter to insert</Text>
          )}
          {citationMatches.slice(0, 5).map((entry, index) => (
            <Text key={entry.key} color={index === selectedCitation ? 'white' : 'gray'} bold={index === selectedCitation}>
              {index === selectedCitation ? '›' : ' '} @{entry.key}  <Text dimColor>{entry.title}</Text>
            </Text>
          ))}
          {citationMatches.length === 0 && <Text dimColor>No references found. Import a Zotero BibTeX export with /references.</Text>}
          <Prompt
            label="Citation key or search"
            value={citationSearch}
            onChange={value => {
              setCitationSearch(value);
              setSelectedCitation(0);
            }}
            onSubmit={submitCitation}
          />
          <Text dimColor>↑↓ select · Tab add to basket · Enter insert · ^T narrative/parenthetical · Esc cancel</Text>
        </Box>
      )}
    </Box>
  );
}
