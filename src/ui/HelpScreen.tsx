import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';

type HelpTab = 'keys' | 'markdown';

export function HelpScreen({onBack}: {onBack: () => void}) {
  const [tab, setTab] = useState<HelpTab>('keys');

  useInput((input, key) => {
    if (key.escape || key.return) onBack();
    else if (input === '1') setTab('keys');
    else if (input === '2') setTab('markdown');
    else if (key.tab) setTab(current => current === 'keys' ? 'markdown' : 'keys');
  });

  // Ink Text does not accept marginTop — use Box wrappers for spacing.
  function Section({label, color = 'cyan'}: {label: string; color?: string}) {
    return (
      <Box marginTop={tab === 'markdown' ? 1 : 0}>
        <Text bold color={color as 'cyan' | 'white'}>{label}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Tab bar */}
      <Box marginBottom={1}>
        <Text bold color={tab === 'keys' ? 'cyan' : 'white'}>  1 Keyboard  </Text>
        <Text bold color={tab === 'markdown' ? 'cyan' : 'white'}>  2 Markdown  </Text>
        <Text dimColor>  Tab switch · Esc close</Text>
      </Box>

      {tab === 'keys' && (
        <Box flexDirection="column">
          <Section label="Launcher" />
          <Text dimColor>? shortcuts · / commands · ↑↓ select · Enter open</Text>
          <Text dimColor>Ctrl+N chapter · Ctrl+T section · Ctrl+O cover</Text>
          <Text dimColor>Ctrl+E rename · Ctrl+W remove · Alt+↑/↓ reorder</Text>
          <Text dimColor>Ctrl+X export · Ctrl+R review · Ctrl+D/Q quit</Text>
          <Text dimColor>/update checks releases · I installs a new version beside this one</Text>

          <Section label="Editor" />
          <Text dimColor>Ctrl+S save · Ctrl+P insert · Ctrl+F find · Ctrl+I cite</Text>
          <Text dimColor>Tab indent (2 spaces) · Ctrl+Del delete next word</Text>
          <Text dimColor>PgUp/PgDn page · mouse click/wheel · Ctrl+←/→ word</Text>
          <Text dimColor>Ctrl+D delete line · Ctrl+Q back</Text>
          <Text dimColor>Insert: A AI · H/B/L/C/D/M/I · E edit · X delete</Text>
          <Text dimColor>AI: sign in by device code if needed · Insert default · Tab Edit/Chat</Text>
          <Text dimColor>Citations: ↑↓ select · Tab collect · Ctrl+T citation form</Text>

          <Section label="References  (/references)" />
          <Text dimColor>↑↓ scroll · Enter details · Ctrl+I import · Ctrl+D delete</Text>
          <Text dimColor>Details: T title · A author · Y year · Esc back</Text>
        </Box>
      )}

      {tab === 'markdown' && (
        <Box flexDirection="column">
          <Text bold color="cyan">Supported Markdown (Pandoc)</Text>
          <Text dimColor>The editor shows Markdown source with syntax highlights.</Text>
          <Text dimColor>Fenced code uses the named language for keyword/string/comment colors.</Text>
          <Text dimColor>Full rendering (headings, tables, math) is done by Pandoc at export time.</Text>

          <Section label="Inline" color="white" />
          <Box flexDirection="column" paddingLeft={2}>
            <Text>{'**bold**  _italic_  ~~strikethrough~~  `code`'}</Text>
            <Text>{'[@key]             parenthetical citation'}</Text>
            <Text>{'@key               narrative citation'}</Text>
            <Text>{'[@key1; @key2]     multiple citations'}</Text>
            <Text>{'[link text](url)   hyperlink'}</Text>
          </Box>

          <Section label="Block" color="white" />
          <Box flexDirection="column" paddingLeft={2}>
            <Text>{'# H1  ## H2  ### H3  (up to H6)'}</Text>
            <Text>{'- item  or  1. item  (lists)'}</Text>
            <Text>{'| Col | Col |  (tables — Pandoc pipe_tables)'}</Text>
            <Text>{'> blockquote'}</Text>
            <Text>{'``` lang  ...  ```  (fenced code — include language for export)'}</Text>
            <Text>{'![alt text](path)  (image — path relative to document)'}</Text>
          </Box>

          <Section label="Diagrams (Mermaid)" color="white" />
          <Box flexDirection="column" paddingLeft={2}>
            <Text>{'``` mermaid\ngraph LR\n  A --> B\n```'}</Text>
            <Text dimColor>The editor highlights this block. PDF/EPUB output</Text>
            <Text dimColor>renders the code block as text unless a Mermaid pre-</Text>
            <Text dimColor>processor (e.g. mermaid-filter or mmdc) is configured.</Text>
            <Text dimColor>Run /check to see a warning for each Mermaid block.</Text>
          </Box>

          <Section label="Images in PDF/EPUB" color="white" />
          <Box flexDirection="column" paddingLeft={2}>
            <Text dimColor>Store images in  assets/images/  and reference them as:</Text>
            <Text>{'  ![Alt](../assets/images/figure.png)'}</Text>
            <Text dimColor>Paths are relative to the document file. SVG, PNG, and</Text>
            <Text dimColor>JPEG are supported by both Pandoc PDF (Typst) and EPUB.</Text>
          </Box>

          <Section label="Editor display limits" color="white" />
          <Box flexDirection="column" paddingLeft={2}>
            <Text dimColor>Images, Mermaid and math are shown as highlighted source.</Text>
            <Text dimColor>Final rendering is delegated to Pandoc at export time.</Text>
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>1/2 switch tab · Tab switch · Esc close</Text>
      </Box>
    </Box>
  );
}
