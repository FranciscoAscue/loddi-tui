import React, {useEffect, useRef, useState} from 'react';
import {Box, Text, useInput} from 'ink';
import {ToolStatus, inspectTools, installPandoc, installTypst, platformLabel} from '../services/tools.js';

export function Dependencies({onBack, initialInstall}: {onBack: () => void; initialInstall?: 'pandoc' | 'typst'}) {
  const [tools, setTools] = useState<ToolStatus[]>([]);
  const [message, setMessage] = useState('Checking tools…');
  const [confirmInstall, setConfirmInstall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const autoStarted = useRef(false);

  async function refresh() {
    setMessage('Checking tools…');
    const result = await inspectTools();
    setTools(result);
    setMessage('Ready');
  }

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    if (!initialInstall || autoStarted.current) return;
    autoStarted.current = true;
    setBusy(true);
    const installer = initialInstall === 'pandoc' ? installPandoc : installTypst;
    void installer(setMessage)
      .then(refresh)
      .catch(error => setMessage(error instanceof Error ? error.message : String(error)))
      .finally(() => setBusy(false));
  }, [initialInstall]);

  async function install() {
    setConfirmInstall(false);
    setBusy(true);
    try {
      const tool = tools[selected];
      if (!tool) throw new Error('No dependency is selected.');
      if (tool.name === 'pandoc') await installPandoc(setMessage);
      else await installTypst(setMessage);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  useInput((input, key) => {
    if (busy) return;
    if (confirmInstall) {
      if (input.toLowerCase() === 'y') void install();
      else if (input.toLowerCase() === 'n' || key.escape) setConfirmInstall(false);
      return;
    }
    if (key.upArrow || input.toLowerCase() === 'k') setSelected(value => Math.max(0, value - 1));
    else if (key.downArrow || input.toLowerCase() === 'j') setSelected(value => Math.min(tools.length - 1, value + 1));
    else if (input.toLowerCase() === 'i' && tools[selected]?.canInstall) setConfirmInstall(true);
    else if (input.toLowerCase() === 'r') void refresh();
    else if (key.escape || input.toLowerCase() === 'q') onBack();
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} justifyContent="space-between">
        <Text bold color="cyan">Dependencies</Text>
        <Text>{platformLabel()}</Text>
      </Box>
      <Box flexDirection="column" borderStyle="round" marginTop={1} paddingX={1}>
        {tools.map((tool, index) => (
          <Box key={tool.name} flexDirection="column" marginBottom={1}>
            <Text>
              <Text color={index === selected ? 'cyan' : 'white'}>{index === selected ? '›' : ' '}</Text>
              {' '}
              <Text color={tool.installed ? 'green' : 'yellow'}>{tool.installed ? '✓' : '!'}</Text>
              {' '}<Text bold>{tool.label}</Text> — {tool.requiredFor}
            </Text>
            <Text dimColor>
              {tool.installed
                ? `${tool.version}${tool.managed ? ' · managed by Loddi' : ' · system installation'}`
                : tool.installHint}
            </Text>
          </Box>
        ))}
      </Box>
      <Text>↑/↓ select · I install/update · R refresh · Esc back</Text>
      <Text dimColor>{message}</Text>
      {confirmInstall && (
        <Box borderStyle="round" borderColor="yellow" paddingX={1} marginTop={1}>
          <Text>Download and install the official {tools[selected]?.label || 'tool'} binary for this user? [Y/n]</Text>
        </Box>
      )}
    </Box>
  );
}
