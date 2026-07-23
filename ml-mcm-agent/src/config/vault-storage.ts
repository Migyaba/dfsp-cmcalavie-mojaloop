import nodeVault from 'node-vault';
import { parse, stringify } from 'yaml';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import http from 'http';
import https from 'https';
import type { Config } from './schema';
import { configSchema } from './schema';
import type { Logger } from '../utils/logger';

export interface VaultConfig {
  endpoint: string;
  kvMount: string;
  pkiMount: string;
  auth?: {
    k8s?: {
      token: string;
      role: string;
    };
    appRole?: {
      roleId: string;
      roleSecretId: string;
    };
  };
}

export interface VaultStorageOptions {
  logger: Logger;
  config: VaultConfig;
}

export class VaultConfigStorage {
  private vault: any;
  private logger: Logger;
  private config: VaultConfig;
  private initialized = false;
  private tokenRenewalThresholdSeconds = 300; // Renew if token expires in less than 5 minutes
  private tokenCheckIntervalMs = 60000; // Check token every minute
  private renewalTimer?: NodeJS.Timeout;

  constructor(options: VaultStorageOptions) {
    this.logger = options.logger;
    this.config = options.config;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Vault configuration storage');

    const { endpoint, auth } = this.config;

    // Create HTTP agent with unlimited connections to prevent blocking
    const httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: Infinity,
      maxFreeSockets: 256,
    });
    const httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: Infinity,
      maxFreeSockets: 256,
    });

    const vaultOptions: any = {
      endpoint,
      apiVersion: 'v1',
      rpDefaults: {
        agent: endpoint.startsWith('https') ? httpsAgent : httpAgent,
      },
    };

    if (!auth) {
      throw new Error('Vault auth configuration is required');
    }

    // Determine auth method
    if (auth.k8s) {
      // K8s auth not implemented yet
      throw new Error('K8s auth not yet supported');
    } else if (auth.appRole) {
      // AppRole auth
      this.vault = nodeVault(vaultOptions);

      const result = await this.vault.approleLogin({
        role_id: auth.appRole.roleId,
        secret_id: auth.appRole.roleSecretId,
      });

      this.vault.token = result.auth.client_token;
      this.logger.debug('Vault authenticated via AppRole');
    } else {
      throw new Error('No valid Vault auth method configured');
    }

    this.initialized = true;

    // Start background token renewal
    this.startTokenRenewal();
  }

  private startTokenRenewal(): void {
    this.renewalTimer = setInterval(async () => {
      try {
        await this.checkAndRenewToken();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Token renewal check failed: ${errorMessage}`);
      }
    }, this.tokenCheckIntervalMs);
  }

  private async checkAndRenewToken(): Promise<void> {
    try {
      const tokenInfo = await this.vault.tokenLookupSelf();
      const ttl = tokenInfo.data.ttl;

      if (ttl < this.tokenRenewalThresholdSeconds) {
        this.logger.info(`Vault token expiring soon (TTL: ${ttl}s), renewing...`);
        await this.renewToken();
      }
    } catch (error: any) {
      if (error?.response?.statusCode === 403) {
        this.logger.warn('Vault token is invalid or expired, re-authenticating...');
        await this.renewToken();
      } else {
        throw error;
      }
    }
  }

  private async renewToken(): Promise<void> {
    const { auth } = this.config;

    if (!auth) {
      throw new Error('Vault auth configuration is required');
    }

    if (auth.appRole) {
      const result = await this.vault.approleLogin({
        role_id: auth.appRole.roleId,
        secret_id: auth.appRole.roleSecretId,
      });

      this.vault.token = result.auth.client_token;
      this.logger.info('Vault token renewed via AppRole');
    } else if (auth.k8s) {
      throw new Error('K8s auth not yet supported');
    } else {
      throw new Error('No valid Vault auth method configured');
    }
  }

  destroy(): void {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
      this.renewalTimer = undefined;
    }
  }

  async load(configPath: string): Promise<Config> {
    const startTime = Date.now();
    this.logger.debug(`[VAULT-DEBUG] load() started at ${startTime}`);

    if (!this.initialized) {
      throw new Error('VaultConfigStorage not initialized');
    }

    const path = `${this.config.kvMount}/data/${configPath}`;
    this.logger.debug(`[VAULT-DEBUG] About to read from Vault at ${Date.now() - startTime}ms, path: ${path}`);

    try {
      const response = await this.vault.read(path);
      this.logger.debug(`[VAULT-DEBUG] vault.read() completed at ${Date.now() - startTime}ms`);

      if (!response || !response.data || !response.data.data) {
        throw new Error(`Configuration not found at ${path}`);
      }

      this.logger.debug(`[VAULT-DEBUG] About to parse/validate at ${Date.now() - startTime}ms`);
      const validated = configSchema.strip().parse(response.data.data);
      this.logger.debug(`[VAULT-DEBUG] Parse/validate completed at ${Date.now() - startTime}ms`);
      this.logger.info('Configuration loaded from Vault');

      return validated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to load configuration from Vault at ${path}: ${errorMessage}`);
      throw error;
    }
  }

  async save(configPath: string, config: Config): Promise<void> {
    if (!this.initialized) {
      throw new Error('VaultConfigStorage not initialized');
    }

    const validated = configSchema.parse(config);
    const path = `${this.config.kvMount}/data/${configPath}`;

    this.logger.debug(`Saving configuration to Vault at ${path}`);

    try {
      await this.vault.write(path, { data: validated });
      this.logger.info('Configuration saved to Vault');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save configuration to Vault at ${path}: ${errorMessage}`);
      throw error;
    }
  }

  async exists(configPath: string): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    const path = `${this.config.kvMount}/data/${configPath}`;

    try {
      await this.vault.read(path);
      return true;
    } catch (error: any) {
      if (error?.response?.statusCode === 404) {
        return false;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Configuration does not exist in Vault at ${path}: ${errorMessage}`);
      return false;
    }
  }

  async getVersions(configPath: string): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('VaultConfigStorage not initialized');
    }

    const path = `${this.config.kvMount}/metadata/${configPath}`;

    try {
      const response = await this.vault.read(path);
      return response?.data?.versions || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get configuration versions at ${path}: ${errorMessage}`);
      return [];
    }
  }

  async getVersion(configPath: string, version: number): Promise<Config> {
    if (!this.initialized) {
      throw new Error('VaultConfigStorage not initialized');
    }

    const path = `${this.config.kvMount}/data/${configPath}?version=${version}`;

    try {
      const response = await this.vault.read(path);

      if (!response || !response.data || !response.data.data) {
        throw new Error(`Configuration version ${version} not found`);
      }

      return configSchema.parse(response.data.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get configuration version ${version} at ${path}: ${errorMessage}`);
      throw error;
    }
  }

  async exportToYaml(configPath: string, filepath: string): Promise<void> {
    const config = await this.load(configPath);
    const yamlContent = stringify(config, {
      lineWidth: 0,
      defaultStringType: 'QUOTE_DOUBLE',
    });

    await writeFile(filepath, yamlContent, 'utf-8');
    this.logger.info(`Configuration exported to YAML at ${filepath}`);
  }

  async importFromYaml(configPath: string, filepath: string): Promise<void> {
    if (!existsSync(filepath)) {
      throw new Error(`YAML file not found: ${filepath}`);
    }

    const content = await readFile(filepath, 'utf-8');
    const config = parse(content);
    const validated = configSchema.parse(config);

    await this.save(configPath, validated);
    this.logger.info(`Configuration imported from YAML at ${filepath}`);
  }

  async delete(configPath: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('VaultConfigStorage not initialized');
    }

    const path = `${this.config.kvMount}/data/${configPath}`;

    try {
      await this.vault.delete(path);
      this.logger.info(`Configuration deleted from Vault at ${path}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete configuration at ${path}: ${errorMessage}`);
      throw error;
    }
  }

  getVaultUIUrl(configPath: string): string {
    return `${this.config.endpoint}/ui/vault/secrets/${this.config.kvMount}/show/${configPath}`;
  }
}
