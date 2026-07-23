import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import axios from 'axios';
import { Status, STATE_NAMES, STATE_DESCRIPTIONS } from '../types.js';
import { StatusIndicator } from '../components/StatusIndicator.js';
import { SYMBOLS } from '../constants.js';

export function StatusTab({ apiUrl, isActive }: { apiUrl: string; isActive: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const { stdout } = useStdout();

  // Calculate available space: terminal height - header (3) - tabs (3) - padding (2) - health (2) - table header (2) - footer (2) - scroll hints (2)
  const terminalHeight = stdout?.rows || 24;
  const maxVisibleItems = Math.max(5, terminalHeight - 14);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/status`);
        setStatus(response.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  useInput(
    (input, key) => {
      const states = status
        ? Object.entries(status.states).filter(([key]) => STATE_NAMES[key])
        : [];
      const totalItems = states.length;

      if (key.upArrow) {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setScrollOffset((prev) => Math.min(Math.max(0, totalItems - maxVisibleItems), prev + 1));
      }
    },
    { isActive }
  );

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">Loading status...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Make sure the MCM Agent is running on {apiUrl}</Text>
      </Box>
    );
  }

  if (!status) return null;

  const states = Object.entries(status.states)
    .filter(([key]) => STATE_NAMES[key])
    .sort((a, b) => STATE_NAMES[a[0]].localeCompare(STATE_NAMES[b[0]]));

  const visibleStates = states.slice(scrollOffset, scrollOffset + maxVisibleItems);
  const showScrollUp = scrollOffset > 0;
  const showScrollDown = scrollOffset + maxVisibleItems < states.length;

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Box marginBottom={1}>
          <Text>Health: <Text color={status.health === 'healthy' ? 'green' : 'red'}>{status.health}</Text></Text>
        </Box>
        <Box marginBottom={1}>
          <Text bold underline>
            State                              Status      Description
          </Text>
        </Box>

        {showScrollUp && (
          <Text dimColor>{SYMBOLS.arrowUp} Scroll up (↑) for more</Text>
        )}

        {visibleStates.map(([key, state]) => (
          <Box key={key} marginBottom={0}>
            <Box width={35}>
              <StatusIndicator status={state.status} />
              <Text> {STATE_NAMES[key]}</Text>
            </Box>
            <Box width={12}>
              <Text color={state.status === 'completed' ? 'green' : state.status === 'inError' ? 'red' : 'yellow'}>
                {state.status}
              </Text>
            </Box>
            <Box flexGrow={1}>
              {state.status === 'inError' && state.errorDescription ? (
                <Text color="red">{state.errorDescription.substring(0, 60)}...</Text>
              ) : (
                <Text dimColor>{STATE_DESCRIPTIONS[state.stateDescription] || state.stateDescription}</Text>
              )}
            </Box>
          </Box>
        ))}

        {showScrollDown && (
          <Text dimColor>{SYMBOLS.arrowDown} Scroll down (↓) for more</Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Auto-refreshing every 3 seconds</Text>
      </Box>
    </Box>
  );
}
