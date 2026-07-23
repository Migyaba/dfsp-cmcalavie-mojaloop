import React from 'react';
import { Text } from 'ink';
import { SYMBOLS, COLORS } from '../constants.js';

export function StatusIndicator({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    completed: COLORS.completed,
    inProgress: COLORS.inProgress,
    inError: COLORS.inError,
    pending: COLORS.pending,
  };

  const symbolMap: Record<string, string> = {
    completed: SYMBOLS.completed,
    inProgress: SYMBOLS.inProgress,
    inError: SYMBOLS.error,
    pending: SYMBOLS.pending,
  };

  return <Text color={colorMap[status] || 'white'}>{symbolMap[status] || '?'}</Text>;
}
