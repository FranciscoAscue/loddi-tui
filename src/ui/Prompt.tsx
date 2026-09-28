import React from 'react';
import {Box, Text} from 'ink';
import TextInput from 'ink-text-input';

export function Prompt({
  label,
  value,
  onChange,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}) {
  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold>{label}: </Text>
      <TextInput value={value} onChange={onChange} onSubmit={onSubmit} focus />
    </Box>
  );
}
