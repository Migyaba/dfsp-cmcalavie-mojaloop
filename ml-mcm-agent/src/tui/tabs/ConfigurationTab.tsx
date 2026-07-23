import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import axios from 'axios';
import { Config } from '../types.js';
import { SYMBOLS } from '../constants.js';

export function ConfigurationTab({ apiUrl, isActive }: { apiUrl: string; isActive: boolean }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const { stdout } = useStdout();

  // Calculate available space: terminal height - header (3) - tabs (3) - padding (2) - footer (2) - scroll hints (2)
  const terminalHeight = stdout?.rows || 24;
  const maxVisibleLines = Math.max(5, terminalHeight - 12);

  useEffect(() => {
    if (!isActive) return;

    const fetchConfig = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/config`);
        setConfig(response.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch configuration');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [apiUrl, isActive]);

  const configLines = config
    ? [
        { type: 'section', text: 'Common Settings' },
        { type: 'item', text: `DFSP ID: ${config.common?.dfspId || 'N/A'}` },
        { type: 'section', text: 'MCM Server' },
        { type: 'item', text: `Endpoint: ${config.mcm?.serverEndpoint || 'N/A'}` },
        { type: 'item', text: `Client ID: ${config.mcm?.auth?.creds?.clientId || 'N/A'}` },
        { type: 'item', text: `Auth Enabled: ${config.mcm?.auth?.enabled ? 'Yes' : 'No'}` },
        { type: 'item', text: `IAM Provider: ${config.mcm?.hubIamProviderUrl || 'N/A'}` },
        { type: 'item', text: `Cert Expiry Threshold: ${config.mcm?.certExpiryThresholdDays || 'N/A'} days` },
        { type: 'section', text: 'SDK Scheme Adapter' },
        { type: 'item', text: `FQDN: ${config.sdk?.fqdn || 'N/A'}` },
        { type: 'item', text: `Callback URL: ${config.sdk?.callbackUrl || 'N/A'}` },
        { type: 'item', text: `Currencies: ${config.sdk?.currencies?.join(', ') || 'N/A'}` },
        { type: 'item', text: `Whitelist IPs: ${config.sdk?.whitelistIp?.join(', ') || 'N/A'}` },
        { type: 'item', text: `FXP Response: ${config.sdk?.fxpResponse || 'N/A'}` },
        { type: 'item', text: `Peer Endpoint: ${config.sdk?.peerEndpoint || 'N/A'}` },
        { type: 'item', text: `ALS Endpoint: ${config.sdk?.alsEndpoint || 'N/A'}` },
        { type: 'section', text: 'SDK Auto Accept' },
        { type: 'item', text: `Quotes: ${config.sdk?.autoAccept?.quotes ? 'Yes' : 'No'}` },
        { type: 'item', text: `Party: ${config.sdk?.autoAccept?.party ? 'Yes' : 'No'}` },
        { type: 'item', text: `R2P Party: ${config.sdk?.autoAccept?.r2pParty ? 'Yes' : 'No'}` },
        { type: 'section', text: 'SDK JWS' },
        { type: 'item', text: `Sign: ${config.sdk?.jws?.sign ? 'Yes' : 'No'}` },
        { type: 'item', text: `Validate Inbound: ${config.sdk?.jws?.validateInbound ? 'Yes' : 'No'}` },
        { type: 'section', text: 'SDK TLS' },
        { type: 'item', text: `Outbound Mutual: ${config.sdk?.tls?.outboundMutual ? 'Yes' : 'No'}` },
        { type: 'item', text: `Inbound Mutual: ${config.sdk?.tls?.inboundMutual ? 'Yes' : 'No'}` },
        { type: 'section', text: 'Vault' },
        { type: 'item', text: `Common Name: ${config.vault?.commonName || 'N/A'}` },
      ]
    : [];

  useInput(
    (input, key) => {
      const totalLines = configLines.length;

      if (key.upArrow) {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setScrollOffset((prev) => Math.min(Math.max(0, totalLines - maxVisibleLines), prev + 1));
      }
    },
    { isActive }
  );

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">Loading configuration...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  if (!config) return null;

  const visibleLines = configLines.slice(scrollOffset, scrollOffset + maxVisibleLines);
  const showScrollUp = scrollOffset > 0;
  const showScrollDown = scrollOffset + maxVisibleLines < configLines.length;

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column">
        {showScrollUp && (
          <Text dimColor>{SYMBOLS.arrowUp} Scroll up (↑) for more</Text>
        )}

        {visibleLines.map((line, index) => (
          <Box key={index} marginLeft={line.type === 'item' ? 2 : 0}>
            {line.type === 'section' ? (
              <Text bold underline color="magenta">
                {line.text}
              </Text>
            ) : (
              <Text>
                {line.text.split(':')[0]}:<Text color="green"> {line.text.split(':').slice(1).join(':')}</Text>
              </Text>
            )}
          </Box>
        ))}

        {showScrollDown && (
          <Text dimColor>{SYMBOLS.arrowDown} Scroll down (↓) for more</Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Navigate to Edit Config tab to edit</Text>
      </Box>
    </Box>
  );
}
