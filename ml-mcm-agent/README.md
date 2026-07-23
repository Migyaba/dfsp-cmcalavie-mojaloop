# MCM Agent

Configuration management agent for Mojaloop Connection Manager (MCM) client with Terminal UI (TUI) and CLI.

## Overview

MCM Agent provides an administrator-friendly interface for configuring and managing the MCM client, which handles:

![TUI Demo](docs/tui-demo.gif)
- Certificate lifecycle management via MCM Server
- SDK scheme-adapter configuration
- Connection to Vault for PKI operations
- OIDC/JWT authentication

## Features

- **Terminal Interface**
  - Interactive Terminal UI (TUI) with Ink for console access
  - CLI commands for scripting and automation

- **Configuration Management**
  - Multi-group configuration forms
  - Environment variable management
  - Secret encryption at rest
  - Hot-reload without service restart

- **PKI Operations**
  - Certificate generation and renewal
  - CSR management (upload/download)
  - Integration with HashiCorp Vault

- **Real-time Monitoring**
  - State machine status tracking
  - Certificate expiry warnings
  - Live log streaming

## Requirements

- Node.js >= 22.0.0
- Access to:
  - MCM Server
  - HashiCorp Vault
  - SDK Scheme Adapter
  - OIDC provider (e.g., Keycloak)

## Installation

```bash
npm install
npm run build
```

## Usage

### 1. Start Daemon (Required)
```bash
npm start
```

### 2. Use CLI/TUI
```bash
# Launch interactive Terminal UI (default)
mcm-agent

# Or quick status check:
mcm-agent status
```

## Configuration

Configuration is stored in **HashiCorp Vault** and managed entirely through the TUI.

**Environment variables** for daemon setup (see `.env.example`):
- `VAULT_ENDPOINT` - Vault server address
- `VAULT_AUTH_*` - Authentication (AppRole or K8s)
- `PORT`, `HOST` - Server port and bind address

## Development

```bash
# Development mode with hot reload
npm run dev

# Run tests
npm test

# Run TUI in development
npm run tui
```

## License

Apache-2.0
