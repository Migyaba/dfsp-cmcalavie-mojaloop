import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SYMBOLS } from '../constants.js';

export function ScrollableContent({
  children,
  maxHeight = 20,
  isActive = true,
}: {
  children: React.ReactNode[];
  maxHeight?: number;
  isActive?: boolean;
}) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const contentArray = React.Children.toArray(children);
  const totalLines = contentArray.length;

  useInput(
    (input, key) => {
      if (key.upArrow) {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setScrollOffset((prev) => Math.min(Math.max(0, totalLines - maxHeight), prev + 1));
      } else if (key.pageUp) {
        setScrollOffset((prev) => Math.max(0, prev - maxHeight));
      } else if (key.pageDown) {
        setScrollOffset((prev) => Math.min(Math.max(0, totalLines - maxHeight), prev + maxHeight));
      }
    },
    { isActive }
  );

  const visibleContent = contentArray.slice(scrollOffset, scrollOffset + maxHeight);
  const showScrollUp = scrollOffset > 0;
  const showScrollDown = scrollOffset + maxHeight < totalLines;

  return (
    <Box flexDirection="column">
      {showScrollUp && (
        <Text dimColor>{SYMBOLS.arrowUp} Scroll up for more</Text>
      )}
      {visibleContent}
      {showScrollDown && (
        <Text dimColor>{SYMBOLS.arrowDown} Scroll down for more</Text>
      )}
    </Box>
  );
}
