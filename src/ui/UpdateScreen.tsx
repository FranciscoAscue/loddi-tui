import React, {useEffect, useRef, useState} from 'react';
import {Box, Text, useInput} from 'ink';
import {AvailableUpdate, UpdateStatus, checkForUpdate, currentVersion, installPortableUpdate} from '../services/update.js';

export function UpdateScreen({onBack, promptOnAvailable = false}: {onBack: () => void; promptOnAvailable?: boolean}) {
  const [status, setStatus] = useState<UpdateStatus>();
  const [message, setMessage] = useState('Checking for releases…');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [installedPath, setInstalledPath] = useState<string>();
  const prompted = useRef(false);

  async function refresh() {
    setBusy(true);
    setMessage('Checking for releases…');
    try {
      const result = await checkForUpdate();
      setStatus(result);
      if (promptOnAvailable && !prompted.current && result.kind === 'available' && result.asset) {
        prompted.current = true;
        setConfirm(true);
      }
      setMessage(result.kind === 'none' ? 'No Loddi release has been published yet.'
        : result.kind === 'current' ? 'You have the latest published version.'
          : result.kind === 'ahead' ? 'This build is newer than the latest published version.'
            : result.asset ? `Loddi v${result.version} is ready to download.`
              : `Loddi v${result.version} exists, but no archive is available for this platform.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  }

  useEffect(() => { void refresh(); }, []);

  async function install(update: AvailableUpdate) {
    setConfirm(false);
    setBusy(true);
    try {
      const launcher = await installPortableUpdate(update, setMessage);
      setInstalledPath(launcher);
      setMessage('The new version is installed beside this one. Restart with the path below.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  }

  useInput((input, key) => {
    if (busy) return;
    if (confirm) {
      if (input.toLowerCase() === 'y' && status?.kind === 'available' && status.asset) void install(status);
      else if (input.toLowerCase() === 'n' || key.escape) {
        setConfirm(false);
        if (promptOnAvailable) onBack();
      }
      return;
    }
    if (input.toLowerCase() === 'r') void refresh();
    else if (input.toLowerCase() === 'i' && status?.kind === 'available' && status.asset) setConfirm(true);
    else if (key.escape || input.toLowerCase() === 'q') onBack();
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1}><Text bold color="cyan">Loddi update</Text></Box>
      <Text>Current version: v{currentVersion}</Text>
      {status?.kind === 'available' && <Text>Latest release: v{status.version}</Text>}
      <Text dimColor>{message}</Text>
      {installedPath && <Text color="green">Run: {installedPath}</Text>}
      {confirm && <Text color="yellow">Install this verified release beside the current version? [y/N]</Text>}
      <Box marginTop={1}><Text dimColor>R check again · I install beside current version · Esc back</Text></Box>
    </Box>
  );
}
