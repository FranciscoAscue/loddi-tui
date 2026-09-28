import React, {ReactNode} from 'react';
import {Box} from 'ink';

export function Overlay({children, width}: {children: ReactNode; width: number}) {
  const panelWidth = Math.max(20, Math.min(width - 2, Math.floor(width * 0.88)));
  return (
    <Box
      marginLeft={Math.max(1, Math.floor((width - panelWidth) / 2))}
      marginTop={1}
      width={panelWidth}
      borderStyle="double"
      borderColor="cyan"
      padding={1}
      flexDirection="column"
      backgroundColor="black"
    >
      {children}
    </Box>
  );
}
