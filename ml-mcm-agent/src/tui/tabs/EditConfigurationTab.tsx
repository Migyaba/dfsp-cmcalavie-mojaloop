import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import axios from 'axios';
import { Config } from '../types.js';
import { SYMBOLS } from '../constants.js';

export function EditConfigurationTab({ apiUrl, onEditModeChange }: { apiUrl: string; onEditModeChange: (editing: boolean) => void }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const { stdout } = useStdout();

  // Calculate available space: terminal height - header (3) - tabs (3) - padding (2) - instructions (2) - save button (2) - footer (3) - status (2)
  const terminalHeight = stdout?.rows || 24;
  const maxVisibleFields = Math.max(5, terminalHeight - 17);

  // Editable form values
  const [formValues, setFormValues] = useState({
    dfspId: '',
    mcmEndpoint: '',
    mcmClientId: '',
    mcmClientSecret: '',
    mcmIamProvider: '',
    mcmAuthEnabled: false,
    sdkFqdn: '',
    sdkCallbackUrl: '',
    sdkCurrencies: '',
    sdkWhitelistIp: '',
    sdkFxpResponse: '',
    sdkPeerEndpoint: '',
    sdkAlsEndpoint: '',
    sdkAutoAcceptQuotes: false,
    sdkAutoAcceptParty: false,
    sdkAutoAcceptR2pParty: false,
    sdkJwsSign: false,
    sdkJwsValidateInbound: false,
    sdkTlsOutboundMutual: false,
    sdkTlsInboundMutual: false,
    vaultCommonName: '',
  });

  const fields = [
    { key: 'dfspId', label: 'DFSP ID', value: formValues.dfspId, type: 'text' as const },
    { key: 'mcmEndpoint', label: 'MCM Server Endpoint', value: formValues.mcmEndpoint, type: 'text' as const },
    { key: 'mcmClientId', label: 'MCM Client ID', value: formValues.mcmClientId, type: 'text' as const },
    { key: 'mcmClientSecret', label: 'MCM Client Secret', value: formValues.mcmClientSecret, secret: true, type: 'text' as const },
    { key: 'mcmIamProvider', label: 'MCM IAM Provider', value: formValues.mcmIamProvider, type: 'text' as const },
    { key: 'mcmAuthEnabled', label: 'MCM Auth Enabled', value: formValues.mcmAuthEnabled, type: 'checkbox' as const },
    { key: 'sdkFqdn', label: 'SDK FQDN', value: formValues.sdkFqdn, type: 'text' as const },
    { key: 'sdkCallbackUrl', label: 'SDK Callback URL', value: formValues.sdkCallbackUrl, type: 'text' as const },
    { key: 'sdkCurrencies', label: 'SDK Currencies (comma-separated)', value: formValues.sdkCurrencies, type: 'text' as const },
    { key: 'sdkWhitelistIp', label: 'SDK Whitelist IPs (comma-separated)', value: formValues.sdkWhitelistIp, type: 'text' as const },
    { key: 'sdkFxpResponse', label: 'SDK FXP Response', value: formValues.sdkFxpResponse, type: 'text' as const },
    { key: 'sdkPeerEndpoint', label: 'SDK Peer Endpoint', value: formValues.sdkPeerEndpoint, type: 'text' as const },
    { key: 'sdkAlsEndpoint', label: 'SDK ALS Endpoint', value: formValues.sdkAlsEndpoint, type: 'text' as const },
    { key: 'sdkAutoAcceptQuotes', label: 'SDK Auto Accept Quotes', value: formValues.sdkAutoAcceptQuotes, type: 'checkbox' as const },
    { key: 'sdkAutoAcceptParty', label: 'SDK Auto Accept Party', value: formValues.sdkAutoAcceptParty, type: 'checkbox' as const },
    { key: 'sdkAutoAcceptR2pParty', label: 'SDK Auto Accept R2P Party', value: formValues.sdkAutoAcceptR2pParty, type: 'checkbox' as const },
    { key: 'sdkJwsSign', label: 'SDK JWS Sign', value: formValues.sdkJwsSign, type: 'checkbox' as const },
    { key: 'sdkJwsValidateInbound', label: 'SDK JWS Validate Inbound', value: formValues.sdkJwsValidateInbound, type: 'checkbox' as const },
    { key: 'sdkTlsOutboundMutual', label: 'SDK TLS Outbound Mutual', value: formValues.sdkTlsOutboundMutual, type: 'checkbox' as const },
    { key: 'sdkTlsInboundMutual', label: 'SDK TLS Inbound Mutual', value: formValues.sdkTlsInboundMutual, type: 'checkbox' as const },
    { key: 'vaultCommonName', label: 'Vault Common Name', value: formValues.vaultCommonName, type: 'text' as const },
  ];

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/config`);
        const cfg = response.data;
        setConfig(cfg);

        // Populate form values
        setFormValues({
          dfspId: cfg.common?.dfspId || '',
          mcmEndpoint: cfg.mcm?.serverEndpoint || '',
          mcmClientId: cfg.mcm?.auth?.creds?.clientId || '',
          mcmClientSecret: cfg.mcm?.auth?.creds?.clientSecret || '',
          mcmIamProvider: cfg.mcm?.hubIamProviderUrl || '',
          mcmAuthEnabled: cfg.mcm?.auth?.enabled ?? true,
          sdkFqdn: cfg.sdk?.fqdn || '',
          sdkCallbackUrl: cfg.sdk?.callbackUrl || '',
          sdkCurrencies: cfg.sdk?.currencies?.join(', ') || '',
          sdkWhitelistIp: cfg.sdk?.whitelistIp?.join(', ') || '',
          sdkFxpResponse: cfg.sdk?.fxpResponse || '',
          sdkPeerEndpoint: cfg.sdk?.peerEndpoint || '',
          sdkAlsEndpoint: cfg.sdk?.alsEndpoint || '',
          sdkAutoAcceptQuotes: cfg.sdk?.autoAccept?.quotes ?? false,
          sdkAutoAcceptParty: cfg.sdk?.autoAccept?.party ?? false,
          sdkAutoAcceptR2pParty: cfg.sdk?.autoAccept?.r2pParty ?? false,
          sdkJwsSign: cfg.sdk?.jws?.sign ?? true,
          sdkJwsValidateInbound: cfg.sdk?.jws?.validateInbound ?? true,
          sdkTlsOutboundMutual: cfg.sdk?.tls?.outboundMutual ?? true,
          sdkTlsInboundMutual: cfg.sdk?.tls?.inboundMutual ?? true,
          vaultCommonName: cfg.vault?.commonName || '',
        });

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch configuration');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [apiUrl]);

  useInput((input, key) => {
    if (saving) return;

    if (editMode) {
      // In edit mode, Esc exits edit mode
      if (key.escape) {
        setEditMode(false);
        onEditModeChange(false);
      }
      return; // TextInput handles other keys
    }

    // Navigation mode
    if (key.upArrow) {
      setSelectedField((prev) => {
        const newField = Math.max(0, prev - 1);
        // Auto-scroll to keep selected field visible
        if (newField < scrollOffset) {
          setScrollOffset(newField);
        }
        return newField;
      });
      setSaveResult(null);
    } else if (key.downArrow) {
      setSelectedField((prev) => {
        const newField = Math.min(fields.length, prev + 1);
        // Auto-scroll to keep selected field visible
        if (newField >= scrollOffset + maxVisibleFields) {
          setScrollOffset(Math.max(0, newField - maxVisibleFields + 1));
        }
        return newField;
      });
      setSaveResult(null);
    } else if (input === ' ') {
      // Space bar toggles checkbox fields
      if (selectedField < fields.length) {
        const field = fields[selectedField];
        if (field.type === 'checkbox') {
          setFormValues((prev) => ({ ...prev, [field.key]: !prev[field.key] }));
          setSaveResult(null);
        }
      }
    } else if (key.return) {
      if (selectedField === fields.length) {
        // Save button selected
        handleSave();
      } else {
        const field = fields[selectedField];
        if (field.type === 'checkbox') {
          // Space or Enter toggles checkbox
          setFormValues((prev) => ({ ...prev, [field.key]: !prev[field.key] }));
          setSaveResult(null);
        } else if (field.type === 'text') {
          // Enter edit mode for text fields
          setEditMode(true);
          onEditModeChange(true);
        }
      }
    }
  });

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);

    try {
      const updatedConfig = {
        ...config,
        common: {
          ...config.common,
          dfspId: formValues.dfspId,
        },
        mcm: {
          ...config.mcm,
          serverEndpoint: formValues.mcmEndpoint,
          auth: {
            ...config.mcm?.auth,
            enabled: formValues.mcmAuthEnabled,
            creds: {
              clientId: formValues.mcmClientId,
              clientSecret: formValues.mcmClientSecret,
            },
          },
          hubIamProviderUrl: formValues.mcmIamProvider,
        },
        sdk: {
          ...config.sdk,
          fqdn: formValues.sdkFqdn,
          callbackUrl: formValues.sdkCallbackUrl,
          currencies: formValues.sdkCurrencies.split(',').map((c) => c.trim()).filter(Boolean),
          whitelistIp: formValues.sdkWhitelistIp.split(',').map((ip) => ip.trim()).filter(Boolean),
          fxpResponse: formValues.sdkFxpResponse,
          peerEndpoint: formValues.sdkPeerEndpoint,
          alsEndpoint: formValues.sdkAlsEndpoint,
          autoAccept: {
            ...config.sdk?.autoAccept,
            quotes: formValues.sdkAutoAcceptQuotes,
            party: formValues.sdkAutoAcceptParty,
            r2pParty: formValues.sdkAutoAcceptR2pParty,
          },
          jws: {
            ...config.sdk?.jws,
            sign: formValues.sdkJwsSign,
            validateInbound: formValues.sdkJwsValidateInbound,
          },
          tls: {
            ...config.sdk?.tls,
            outboundMutual: formValues.sdkTlsOutboundMutual,
            inboundMutual: formValues.sdkTlsInboundMutual,
          },
        },
        vault: {
          ...config.vault,
          commonName: formValues.vaultCommonName,
        },
      };

      await axios.post(`${apiUrl}/api/config`, updatedConfig, {
        headers: { 'Content-Type': 'application/json' },
      });

      setSaveResult(`${SYMBOLS.completed} Configuration saved successfully!`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save configuration';
      setSaveResult(`${SYMBOLS.error} Error: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

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

  const totalItems = fields.length + 1; // +1 for save button
  const visibleFields = fields.slice(scrollOffset, scrollOffset + maxVisibleFields);
  const showScrollUp = scrollOffset > 0;
  const showScrollDown = scrollOffset + maxVisibleFields < totalItems;

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor marginBottom={1}>
          {editMode ? 'Editing: Press Enter to confirm, ESC to cancel' : 'Navigate: ↑/↓ arrows | Enter/Space: edit/toggle | ESC: back'}
        </Text>

        {showScrollUp && (
          <Text dimColor>{SYMBOLS.arrowUp} Scroll up (↑) for more</Text>
        )}

        {visibleFields.map((field, visibleIndex) => {
          const actualIndex = scrollOffset + visibleIndex;
          const isSelected = selectedField === actualIndex && !editMode;
          const labelText = `${isSelected ? `${SYMBOLS.pointer} ` : '  '}${field.label}:`;
          const paddedLabel = labelText.padEnd(45, ' ');

          return (
            <Box key={field.key}>
              {field.type === 'checkbox' ? (
                <Text>
                  <Text color={isSelected ? 'cyan' : undefined}>{paddedLabel}</Text>
                  <Text color={field.value ? 'green' : 'gray'}>
                    {field.value ? SYMBOLS.checkboxOn : SYMBOLS.checkboxOff} {field.value ? 'Yes' : 'No'}
                  </Text>
                </Text>
              ) : field.type === 'text' && editMode && selectedField === actualIndex ? (
                <Box flexDirection="row">
                  <Text color="cyan">{paddedLabel}</Text>
                  <TextInput
                    value={field.value as string}
                    onChange={(value) =>
                      setFormValues((prev) => ({ ...prev, [field.key]: value }))
                    }
                    onSubmit={() => {
                      setEditMode(false);
                      onEditModeChange(false);
                    }}
                    mask={field.secret ? '*' : undefined}
                  />
                </Box>
              ) : field.type === 'text' ? (
                <Text>
                  <Text color={isSelected ? 'cyan' : undefined}>{paddedLabel}</Text>
                  <Text color="green">
                    {field.secret && field.value ? '*'.repeat((field.value as string).length) : String(field.value || 'N/A')}
                  </Text>
                </Text>
              ) : null}
            </Box>
          );
        })}

        {selectedField === fields.length && selectedField >= scrollOffset && selectedField < scrollOffset + maxVisibleFields && (
          <Box marginTop={1}>
            <Text
              color="cyan"
              bold
            >
              {SYMBOLS.pointer} [Save Configuration]
            </Text>
          </Box>
        )}

        {selectedField !== fields.length && scrollOffset + maxVisibleFields > fields.length && (
          <Box marginTop={1}>
            <Text color="yellow">
              {'  '}[Save Configuration]
            </Text>
          </Box>
        )}

        {showScrollDown && (
          <Text dimColor>{SYMBOLS.arrowDown} Scroll down (↓) for more</Text>
        )}
      </Box>

      {saving && (
        <Box marginTop={1}>
          <Text color="yellow">Saving configuration...</Text>
        </Box>
      )}

      {saveResult && (
        <Box marginTop={1}>
          <Text color={saveResult.startsWith(SYMBOLS.completed) ? 'green' : 'red'}>{saveResult}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Changes will reload the state machine automatically</Text>
      </Box>
    </Box>
  );
}
