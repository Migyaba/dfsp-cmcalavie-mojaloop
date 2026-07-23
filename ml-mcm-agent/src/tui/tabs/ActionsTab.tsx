import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import axios from 'axios';
import { SYMBOLS } from '../constants.js';

enum ActionType {
  CREATE_INTERNAL_CA = 'CREATE_INTERNAL_CA',
  UPLOAD_EXTERNAL_CA = 'UPLOAD_EXTERNAL_CA',
  CREATE_CLIENT_CSR = 'CREATE_CLIENT_CSR',
  CREATE_SERVER_CERT = 'CREATE_SERVER_CERT',
  RECREATE_JWS_KEYS = 'RECREATE_JWS_KEYS',
}

export function ActionsTab({ apiUrl, onEditModeChange }: { apiUrl: string; onEditModeChange: (editing: boolean) => void }) {
  const [selectedAction, setSelectedAction] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedField, setSelectedField] = useState(0);
  const [editMode, setEditMode] = useState(false);

  // Form values for different actions
  const [intCaForm, setIntCaForm] = useState({
    cn: '',
    c: '',
    st: '',
    l: '',
    o: '',
    ou: '',
  });
  const [extCaForm, setExtCaForm] = useState({ rootCert: '', intermediateChain: '', privateKey: '' });
  const [clientCsrForm, setClientCsrForm] = useState({
    cn: '',
    c: '',
    st: '',
    l: '',
    o: '',
    ou: '',
  });
  const [serverCertForm, setServerCertForm] = useState({
    cn: '',
    c: '',
    st: '',
    l: '',
    o: '',
    ou: '',
    dns: '',
    ips: '',
  });

  const actions = [
    { type: ActionType.CREATE_INTERNAL_CA, label: 'Create Internal DFSP CA', endpoint: '/api/actions/create-int-ca', method: 'POST', needsForm: true },
    { type: ActionType.UPLOAD_EXTERNAL_CA, label: 'Upload External DFSP CA', endpoint: '/api/actions/create-ext-ca', method: 'POST', needsForm: true },
    { type: ActionType.CREATE_CLIENT_CSR, label: 'Create Client CSR', endpoint: '/api/actions/create-client-csr', method: 'POST', needsForm: true },
    { type: ActionType.CREATE_SERVER_CERT, label: 'Create Server Certificate', endpoint: '/api/actions/create-server-cert', method: 'POST', needsForm: true },
    { type: ActionType.RECREATE_JWS_KEYS, label: 'Recreate JWS Keys', endpoint: '/api/actions/recreate-jws', method: 'POST', needsForm: false },
  ];

  // Load config and prepopulate CN from dfspId
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/config`);
        const config = response.data;
        const dfspId = config.common?.dfspId || '';

        // Prepopulate CN fields with dfspId
        if (dfspId) {
          setIntCaForm((prev) => ({ ...prev, cn: prev.cn || dfspId }));
          setClientCsrForm((prev) => ({ ...prev, cn: prev.cn || dfspId }));
          setServerCertForm((prev) => ({ ...prev, cn: prev.cn || config.sdk?.fqdn || dfspId }));
        }
      } catch (error) {
        // Silently fail - forms will just not be prepopulated
      }
    };
    loadConfig();
  }, [apiUrl]);

  const getCurrentFormFields = () => {
    const actionType = actions[selectedAction].type;
    switch (actionType) {
      case ActionType.CREATE_INTERNAL_CA:
        return [
          { key: 'cn', label: 'Common Name (CN)', value: intCaForm.cn },
          { key: 'c', label: 'Country (C)', value: intCaForm.c },
          { key: 'st', label: 'State/Province (ST)', value: intCaForm.st },
          { key: 'l', label: 'Locality (L)', value: intCaForm.l },
          { key: 'o', label: 'Organization (O)', value: intCaForm.o },
          { key: 'ou', label: 'Organizational Unit (OU)', value: intCaForm.ou },
        ];
      case ActionType.UPLOAD_EXTERNAL_CA:
        return [
          { key: 'rootCert', label: 'Root Certificate', value: extCaForm.rootCert, multiline: true },
          { key: 'intermediateChain', label: 'Intermediate Chain', value: extCaForm.intermediateChain, multiline: true },
          { key: 'privateKey', label: 'Private Key', value: extCaForm.privateKey, secret: true, multiline: true },
        ];
      case ActionType.CREATE_CLIENT_CSR:
        return [
          { key: 'cn', label: 'Common Name (CN)', value: clientCsrForm.cn },
          { key: 'c', label: 'Country (C)', value: clientCsrForm.c },
          { key: 'st', label: 'State/Province (ST)', value: clientCsrForm.st },
          { key: 'l', label: 'Locality (L)', value: clientCsrForm.l },
          { key: 'o', label: 'Organization (O)', value: clientCsrForm.o },
          { key: 'ou', label: 'Organizational Unit (OU)', value: clientCsrForm.ou },
        ];
      case ActionType.CREATE_SERVER_CERT:
        return [
          { key: 'cn', label: 'Common Name (CN)', value: serverCertForm.cn },
          { key: 'c', label: 'Country (C)', value: serverCertForm.c },
          { key: 'st', label: 'State/Province (ST)', value: serverCertForm.st },
          { key: 'l', label: 'Locality (L)', value: serverCertForm.l },
          { key: 'o', label: 'Organization (O)', value: serverCertForm.o },
          { key: 'ou', label: 'Organizational Unit (OU)', value: serverCertForm.ou },
          { key: 'dns', label: 'DNS Names (comma-separated)', value: serverCertForm.dns },
          { key: 'ips', label: 'IP Addresses (comma-separated)', value: serverCertForm.ips },
        ];
      default:
        return [];
    }
  };

  const fields = getCurrentFormFields();

  useInput((input, key) => {
    if (executing) return;

    if (showForm) {
      if (editMode) {
        if (key.escape) {
          setEditMode(false);
          onEditModeChange(false);
        }
        return;
      }

      // Form navigation
      if (key.escape) {
        setShowForm(false);
        setSelectedField(0);
        setResult(null);
      } else if (key.upArrow) {
        setSelectedField((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedField((prev) => Math.min(fields.length, prev + 1));
      } else if (key.return) {
        if (selectedField === fields.length) {
          // Submit button
          executeAction();
        } else {
          // Edit field
          setEditMode(true);
          onEditModeChange(true);
        }
      }
    } else {
      // Action list navigation
      if (key.upArrow) {
        setSelectedAction((prev) => Math.max(0, prev - 1));
        setResult(null);
      } else if (key.downArrow) {
        setSelectedAction((prev) => Math.min(actions.length - 1, prev + 1));
        setResult(null);
      } else if (key.return) {
        const action = actions[selectedAction];
        if (action.needsForm) {
          setShowForm(true);
          setSelectedField(0);
          setResult(null);
        } else {
          executeAction();
        }
      }
    }
  });

  const updateFormValue = (key: string, value: string) => {
    const actionType = actions[selectedAction].type;
    switch (actionType) {
      case ActionType.CREATE_INTERNAL_CA:
        setIntCaForm({ ...intCaForm, [key]: value });
        break;
      case ActionType.UPLOAD_EXTERNAL_CA:
        setExtCaForm({ ...extCaForm, [key]: value });
        break;
      case ActionType.CREATE_CLIENT_CSR:
        setClientCsrForm({ ...clientCsrForm, [key]: value });
        break;
      case ActionType.CREATE_SERVER_CERT:
        setServerCertForm({ ...serverCertForm, [key]: value });
        break;
    }
  };

  const executeAction = async () => {
    const action = actions[selectedAction];
    setExecuting(true);
    setResult(null);

    try {
      let body = {};

      switch (action.type) {
        case ActionType.CREATE_INTERNAL_CA:
          body = {
            subject: {
              CN: intCaForm.cn,
              C: intCaForm.c,
              ST: intCaForm.st,
              L: intCaForm.l,
              O: intCaForm.o,
              OU: intCaForm.ou,
            },
          };
          break;
        case ActionType.UPLOAD_EXTERNAL_CA:
          body = {
            rootCert: extCaForm.rootCert,
            intermediateChain: extCaForm.intermediateChain,
            privateKey: extCaForm.privateKey,
          };
          break;
        case ActionType.CREATE_CLIENT_CSR:
          body = {
            subject: {
              CN: clientCsrForm.cn,
              C: clientCsrForm.c,
              ST: clientCsrForm.st,
              L: clientCsrForm.l,
              O: clientCsrForm.o,
              OU: clientCsrForm.ou,
            },
          };
          break;
        case ActionType.CREATE_SERVER_CERT:
          body = {
            subject: {
              CN: serverCertForm.cn,
              C: serverCertForm.c,
              ST: serverCertForm.st,
              L: serverCertForm.l,
              O: serverCertForm.o,
              OU: serverCertForm.ou,
            },
            extensions: {
              subjectAltName: {
                dns: serverCertForm.dns,
                ips: serverCertForm.ips,
              },
            },
          };
          break;
      }

      await axios({
        method: action.method.toLowerCase(),
        url: `${apiUrl}${action.endpoint}`,
        data: body,
        headers: { 'Content-Type': 'application/json' },
      });

      setResult(`${SYMBOLS.completed} ${action.label} completed successfully`);
      setShowForm(false);
      setSelectedField(0);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Action failed';
      setResult(`${SYMBOLS.error} Error: ${errorMsg}`);
    } finally {
      setExecuting(false);
    }
  };

  if (showForm) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor marginBottom={1}>
            {editMode ? 'Editing: Press Enter to confirm, ESC to cancel' : 'Navigate: ↑/↓ arrows | Enter: edit field | ESC: back to actions'}
          </Text>

          {fields.map((field, index) => (
            <Box key={field.key} marginBottom={0} flexDirection="row">
              <Box width={40} flexShrink={0}>
                <Text color={selectedField === index && !editMode ? 'cyan' : undefined}>
                  {selectedField === index && !editMode ? `${SYMBOLS.pointer} ` : '  '}
                  {field.label}:
                </Text>
              </Box>
              <Box flexGrow={1} flexShrink={1}>
                {editMode && selectedField === index ? (
                  <TextInput
                    value={field.value}
                    onChange={(value) => updateFormValue(field.key, value)}
                    onSubmit={() => {
                      setEditMode(false);
                      onEditModeChange(false);
                    }}
                    mask={field.secret ? '*' : undefined}
                  />
                ) : (
                  <Text color="green" wrap="truncate-end">
                    {field.secret && field.value ? '*'.repeat(Math.min(field.value.length, 20)) : field.value || 'N/A'}
                  </Text>
                )}
              </Box>
            </Box>
          ))}

          <Box marginTop={1}>
            <Text
              color={selectedField === fields.length ? 'cyan' : 'yellow'}
              bold={selectedField === fields.length}
            >
              {selectedField === fields.length ? `${SYMBOLS.pointer} ` : '  '}
              [Submit]
            </Text>
          </Box>
        </Box>

        {executing && (
          <Box marginTop={1}>
            <Text color="yellow">Executing...</Text>
          </Box>
        )}

        {result && (
          <Box marginTop={1}>
            <Text color={result.startsWith(SYMBOLS.completed) ? 'green' : 'red'}>{result}</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor marginBottom={1}>
          Use ↑/↓ to navigate, Enter to {actions[selectedAction].needsForm ? 'open form' : 'execute'}
        </Text>

        {actions.map((action, index) => (
          <Box key={index}>
            <Text color={index === selectedAction ? 'cyan' : undefined} bold={index === selectedAction}>
              {index === selectedAction ? `${SYMBOLS.pointer} ` : '  '}
              {action.label}
            </Text>
          </Box>
        ))}
      </Box>

      {executing && (
        <Box marginTop={1}>
          <Text color="yellow">Executing...</Text>
        </Box>
      )}

      {result && (
        <Box marginTop={1}>
          <Text color={result.startsWith(SYMBOLS.completed) ? 'green' : 'red'}>{result}</Text>
        </Box>
      )}
    </Box>
  );
}
