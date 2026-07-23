#!/usr/bin/env node
import { parseArgs } from 'util';
import axios from 'axios';
import { config } from './config.js';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: {
      type: 'boolean',
      short: 'h',
    },
  },
  allowPositionals: true,
});

const command = positionals[0];
const apiUrl = `http://${config.server.host}:${config.server.port}`;

async function statusCommand() {
  try {
    const response = await axios.get(`${apiUrl}/api/status`);
    const status = response.data;

    console.log('MCM Agent Status');
    console.log('================\n');

    // Show key status info
    console.log('DFSP CA:', status.dfsp_ca?.state || 'UNKNOWN');
    console.log('Hub CA:', status.hub_ca?.state || 'UNKNOWN');
    console.log('Client Cert:', status.dfsp_client_cert?.state || 'UNKNOWN');
    console.log('Server Cert:', status.dfsp_server_cert?.state || 'UNKNOWN');
    console.log('JWS Keys:', status.dfsp_jws_certs?.state || 'UNKNOWN');
    console.log('Endpoints:', status.endpoints?.state || 'UNKNOWN');

    console.log('\nMCM Client:', status.initialized ? 'Running' : 'Not initialized');
  } catch (error) {
    if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
      console.error('Error: Cannot connect to MCM Agent daemon');
      console.error(`Daemon should be running at: ${apiUrl}`);
      console.error('Start it with: npm start');
      process.exit(1);
    }
    console.error('Failed to get status:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
MCM Agent - Configuration Management for Mojaloop MCM Client

Usage:
  mcm-agent [command] [options]

Commands:
  (no command)  Launch interactive Terminal UI (default)
  status        Show current state machine status

Options:
  -h, --help    Show this help message

Examples:
  mcm-agent         # Launch TUI
  mcm-agent status  # Quick status check

Note: Daemon must be running first (npm start)
  `);
}

async function main() {
  if (values.help) {
    showHelp();
    process.exit(0);
  }

  // No command? Launch TUI
  if (!command) {
    await import('./tui/index.js');
    return;
  }

  switch (command) {
    case 'status':
      await statusCommand();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main();
