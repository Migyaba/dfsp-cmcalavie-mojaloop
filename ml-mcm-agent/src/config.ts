import 'dotenv/config';
import envVar from 'env-var';
import { readFileSync, existsSync } from 'fs';

function getFileContent(path: string): Buffer {
  if (!existsSync(path)) {
    throw new Error(`File ${path} doesn't exist`);
  }
  return readFileSync(path);
}

const env = envVar.from(process.env, {
  asTextFileContent: (path: string) => getFileContent(path).toString().trim(),
});

// Determine Vault auth method
const k8sRole = env.get('VAULT_AUTH_K8S_ROLE').asString();
let vaultAuth;

if (k8sRole) {
  vaultAuth = {
    k8s: {
      token: env.get('VAULT_K8S_TOKEN_FILE').default('/var/run/secrets/kubernetes.io/serviceaccount/token').asTextFileContent(),
      role: k8sRole,
    },
  };
} else {
  // AppRole auth
  const roleIdPath = env.get('VAULT_AUTH_ROLE_ID_PATH').asString();
  const secretIdPath = env.get('VAULT_AUTH_SECRET_ID_PATH').asString();

  if (roleIdPath && secretIdPath) {
    vaultAuth = {
      appRole: {
        roleId: env.get('VAULT_AUTH_ROLE_ID_PATH').asTextFileContent(),
        roleSecretId: env.get('VAULT_AUTH_SECRET_ID_PATH').asTextFileContent(),
      },
    };
  }
}

export const config = {
  // Vault configuration path in KV store
  vaultConfigPath: env.get('VAULT_CONFIG_PATH').default('mcm-agent/default/config').asString(),

  // Server configuration
  server: {
    port: env.get('PORT').default('3000').asPortNumber(),
    host: env.get('HOST').default('0.0.0.0').asString(),
    logLevel: env.get('LOG_LEVEL').default('info').asString(),
  },

  // Vault infrastructure configuration
  vault: {
    endpoint: env.get('VAULT_ENDPOINT').default('http://vault:8200').asString(),
    kvMount: env.get('VAULT_KV_MOUNT').default('secret').asString(), // KV v2 for agent config (with versioning)
    stateMachineKvMount: env.get('VAULT_STATE_MACHINE_KV_MOUNT').default('secrets').asString(), // KV v1 for state machine state
    pkiMount: env.get('VAULT_PKI_MOUNT').default('pki').asString(),
    auth: vaultAuth,
    // PKI infrastructure settings (not customer-configurable)
    pkiServerRole: env.get('VAULT_PKI_SERVER_ROLE').default('mcm-server-role').asString(),
    pkiClientRole: env.get('VAULT_PKI_CLIENT_ROLE').default('mcm-client-role').asString(),
    signExpiryHours: env.get('VAULT_SIGN_EXPIRY_HOURS').default('8760').asString(),
    keyLength: env.get('VAULT_KEY_LENGTH').default('4096').asIntPositive(),
    keyAlgorithm: env.get('VAULT_KEY_ALGORITHM').default('rsa').asString(),
  },

  // State machine infrastructure configuration (not customer-configurable)
  stateMachine: {
    port: env.get('STATE_MACHINE_PORT').default(4004).asPortNumber(),
    reportStatesStatusIntervalSeconds: env.get('STATE_MACHINE_REPORT_INTERVAL').default(60).asIntPositive(),
    retryIntervalSeconds: env.get('STATE_MACHINE_RETRY_INTERVAL').default(60).asIntPositive(),
  },
} as const;

export type AppConfig = typeof config;
