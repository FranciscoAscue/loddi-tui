import React, {useMemo, useState} from 'react';
import {Box, useApp, useStdout} from 'ink';
import {BookProject} from '../services/project.js';
import {Dashboard} from './Dashboard.js';
import {Editor} from './Editor.js';
import {Dependencies} from './Dependencies.js';
import {ExportScreen} from './ExportScreen.js';
import {Overlay} from './Overlay.js';
import type {SlashCommand} from './commands.js';
import {ReviewScreen} from './ReviewScreen.js';
import {HelpScreen} from './HelpScreen.js';
import {FontsScreen} from './FontsScreen.js';
import {ReferencesScreen} from './ReferencesScreen.js';

type Modal =
  | {kind: 'dependencies'; install?: 'pandoc' | 'typst'}
  | {kind: 'export'; format?: 'epub' | 'pdf'}
  | {kind: 'review'}
  | {kind: 'fonts'}
  | {kind: 'references'}
  | {kind: 'help'};

export function App({project}: {project: BookProject}) {
  const {exit} = useApp();
  const {stdout} = useStdout();
  const [openDocument, setOpenDocument] = useState<string>();
  const [modal, setModal] = useState<Modal>();
  const [, setRevision] = useState(0);
  // Bumped whenever the bibliography file is saved from /references so the
  // editor's citation picker reloads without requiring a full page refresh.
  const [bibRevision, setBibRevision] = useState(0);
  const commands = useMemo<SlashCommand[]>(() => [
    {value: '/export', description: 'Open export options'},
    {value: '/export pdf', description: 'Export PDF now'},
    {value: '/export epub', description: 'Export EPUB now'},
    {value: '/install pandoc', description: 'Install or update Pandoc'},
    {value: '/install typst', description: 'Install or update Typst'},
    {value: '/dependencies', description: 'Inspect publishing tools'},
    {value: '/fonts', description: 'Choose an installed PDF font'},
    {value: '/references', description: 'Browse or import a BibTeX library'},
    {value: '/review', description: 'Review manuscript documents'},
    {value: '/check', description: 'Review manuscript diagnostics'},
    {value: '/help', description: 'Show shortcuts and commands'},
    {value: '/quit', description: 'Exit Loddi'},
  ], []);

  if (openDocument) {
    return (
      <Editor
        project={project}
        relativePath={openDocument}
        bibRevision={bibRevision}
        onClose={() => setOpenDocument(undefined)}
      />
    );
  }

  function executeCommand(command: string) {
    if (command === '/export') setModal({kind: 'export'});
    else if (command === '/export pdf') setModal({kind: 'export', format: 'pdf'});
    else if (command === '/export epub') setModal({kind: 'export', format: 'epub'});
    else if (command === '/install pandoc') setModal({kind: 'dependencies', install: 'pandoc'});
    else if (command === '/install typst') setModal({kind: 'dependencies', install: 'typst'});
    else if (command === '/dependencies') setModal({kind: 'dependencies'});
    else if (command === '/fonts') setModal({kind: 'fonts'});
    else if (command === '/references') setModal({kind: 'references'});
    else if (command === '/review' || command === '/check') setModal({kind: 'review'});
    else if (command === '/help') setModal({kind: 'help'});
    else if (command === '/quit') exit();
  }

  const width = stdout.columns || 80;
  return (
    <Box flexDirection="column">
      {!modal && (
        <Dashboard
          project={project}
          commands={commands}
          active
          onOpen={setOpenDocument}
          onChanged={() => setRevision(value => value + 1)}
          onCommand={executeCommand}
          onQuit={() => exit()}
        />
      )}
      {modal?.kind === 'dependencies' && (
        <Overlay width={width}>
          <Dependencies {...(modal.install ? {initialInstall: modal.install} : {})} onBack={() => setModal(undefined)} />
        </Overlay>
      )}
      {modal?.kind === 'export' && (
        <Overlay width={width}>
          <ExportScreen
            project={project}
            {...(modal.format ? {initialFormat: modal.format} : {})}
            onBack={() => setModal(undefined)}
            onDependencies={() => setModal({kind: 'dependencies'})}
          />
        </Overlay>
      )}
      {modal?.kind === 'review' && (
        <Overlay width={width}>
          <ReviewScreen
            project={project}
            onBack={() => setModal(undefined)}
            onOpen={relativePath => {
              setModal(undefined);
              setOpenDocument(relativePath);
            }}
          />
        </Overlay>
      )}
      {modal?.kind === 'fonts' && (
        <Overlay width={width}>
          <FontsScreen
            project={project}
            onBack={() => setModal(undefined)}
            onChanged={() => setRevision(value => value + 1)}
          />
        </Overlay>
      )}
      {modal?.kind === 'references' && (
        <Overlay width={width}>
          <ReferencesScreen
            project={project}
            onBack={() => setModal(undefined)}
            onBibChanged={() => setBibRevision(value => value + 1)}
          />
        </Overlay>
      )}
      {modal?.kind === 'help' && (
        <Overlay width={width}>
          <HelpScreen onBack={() => setModal(undefined)} />
        </Overlay>
      )}
    </Box>
  );
}

export function StandaloneEditor({project, relativePath}: {project: BookProject; relativePath: string}) {
  const {exit} = useApp();
  return <Editor project={project} relativePath={relativePath} onClose={exit} />;
}
