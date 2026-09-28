import React, {useEffect, useState} from 'react';
import {Box, Text, useInput} from 'ink';
import {BookProject} from '../services/project.js';
import {DocumentReview, reviewManuscript} from '../services/review.js';

export function ReviewScreen({
  project,
  onBack,
  onOpen,
}: {
  project: BookProject;
  onBack: () => void;
  onOpen: (relativePath: string) => void;
}) {
  const [documents, setDocuments] = useState<DocumentReview[]>([]);
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState('Reviewing manuscript…');

  useEffect(() => {
    void reviewManuscript(project).then(result => {
      setDocuments(result);
      setMessage(`${result.length} separate manuscript documents`);
    }).catch(error => setMessage(error instanceof Error ? error.message : String(error)));
  }, [project]);

  useInput((input, key) => {
    if (key.upArrow || input === 'k') setSelected(value => Math.max(0, value - 1));
    else if (key.downArrow || input === 'j') setSelected(value => Math.min(documents.length - 1, value + 1));
    else if (key.return) {
      const document = documents[selected];
      if (document && !document.generated) onOpen(document.path);
      else setMessage('SUMMARY.md is generated and cannot be edited here.');
    } else if (key.escape || input === 'q') onBack();
  });

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Manuscript review</Text>
      <Text dimColor>Each row is stored and exported as a separate manuscript unit.</Text>
      <Box flexDirection="column" marginTop={1}>
        {documents.map((document, index) => (
          <Text key={document.path} color={index === selected ? 'cyan' : 'white'}>
            {index === selected ? '›' : ' '} {document.kind.padEnd(11)} {document.label.slice(0, 30).padEnd(31)} {String(document.words).padStart(5)} words  {document.issues ? `${document.issues} issue(s)` : '✓'}
          </Text>
        ))}
      </Box>
      <Text dimColor>{message}</Text>
      <Text>↑/↓ select · Enter open · Esc close</Text>
    </Box>
  );
}
