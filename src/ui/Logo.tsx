import React from 'react';
import {Box, Text} from 'ink';

const WORDMARK = [
  '██      ████  █████  █████   ██',
  '██     ██  ██ ██  ██ ██  ██  ██',
  '██     ██  ██ ██  ██ ██  ██  ██',
  '██     ██  ██ ██  ██ ██  ██  ██',
  '█████   ████  █████  █████   ██',
].join('\n');

export function Logo() {
  return (
    <Box width="100%" alignItems="center" flexDirection="column">
      <Text color="white" bold>{WORDMARK}</Text>
      <Text color="gray">(Mirabilis)</Text>
    </Box>
  );
}
