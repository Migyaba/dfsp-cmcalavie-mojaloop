#!/usr/bin/env node
import React, { useState } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import { config } from '../config.js';
import type { Tab } from './types.js';
import { StatusTab } from './tabs/StatusTab.js';
import { ConfigurationTab } from './tabs/ConfigurationTab.js';
import { EditConfigurationTab } from './tabs/EditConfigurationTab.js';
import { ActionsTab } from './tabs/ActionsTab.js';
import { SYMBOLS } from './constants.js';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('status');
  const [isChildEditing, setIsChildEditing] = useState(false);
  const apiUrl = `http://${config.server.host}:${config.server.port}`;
  const { exit } = useApp();

  const tabs: Tab[] = ['status', 'configuration', 'edit', 'actions'];

  const switchTab = (tab: Tab) => {
    // Clear screen before switching tabs to prevent artifacts
    process.stdout.write('\x1Bc');
    setActiveTab(tab);
  };

  useInput((input, key) => {
    // Don't process navigation when child is editing
    if (isChildEditing) return;

    // Only exit on ESC from status tab, or q from status tab
    if ((key.escape || input === 'q') && activeTab === 'status') {
      exit();
    }

    // Tab navigation with left/right arrows
    if (key.leftArrow) {
      const currentIndex = tabs.indexOf(activeTab);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
      switchTab(tabs[prevIndex]);
    } else if (key.rightArrow) {
      const currentIndex = tabs.indexOf(activeTab);
      const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
      switchTab(tabs[nextIndex]);
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">MCM Agent</Text>
        <Text dimColor> | ←/→ tabs | q/ESC exit</Text>
      </Box>

      {/* Tabs */}
      <Box borderStyle="round" borderColor="gray" flexDirection="row">
        <Box paddingX={2} flexShrink={0}>
          <Text color={activeTab === 'status' ? 'cyan' : undefined} bold={activeTab === 'status'}>
            {activeTab === 'status' ? `${SYMBOLS.pointerSmall} ` : '  '}Status
          </Text>
        </Box>
        <Box paddingX={2} flexShrink={0}>
          <Text color={activeTab === 'configuration' ? 'cyan' : undefined} bold={activeTab === 'configuration'}>
            {activeTab === 'configuration' ? `${SYMBOLS.pointerSmall} ` : '  '}View Config
          </Text>
        </Box>
        <Box paddingX={2} flexShrink={0}>
          <Text color={activeTab === 'edit' ? 'cyan' : undefined} bold={activeTab === 'edit'}>
            {activeTab === 'edit' ? `${SYMBOLS.pointerSmall} ` : '  '}Edit Config
          </Text>
        </Box>
        <Box paddingX={2} flexShrink={0}>
          <Text color={activeTab === 'actions' ? 'cyan' : undefined} bold={activeTab === 'actions'}>
            {activeTab === 'actions' ? `${SYMBOLS.pointerSmall} ` : '  '}Actions
          </Text>
        </Box>
      </Box>

      {/* Content */}
      <Box flexDirection="column" flexGrow={1}>
        {activeTab === 'status' ? (
          <StatusTab apiUrl={apiUrl} isActive={activeTab === 'status' && !isChildEditing} />
        ) : activeTab === 'configuration' ? (
          <ConfigurationTab apiUrl={apiUrl} isActive={activeTab === 'configuration'} />
        ) : activeTab === 'edit' ? (
          <EditConfigurationTab apiUrl={apiUrl} onEditModeChange={setIsChildEditing} />
        ) : activeTab === 'actions' ? (
          <ActionsTab apiUrl={apiUrl} onEditModeChange={setIsChildEditing} />
        ) : null}
      </Box>
    </Box>
  );
}

// Clear screen before rendering
process.stdout.write('\x1Bc');

render(<App />, { exitOnCtrlC: true });
