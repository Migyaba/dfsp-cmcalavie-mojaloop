import {
  ConnectionStateMachine,
  Vault,
  DFSPEndpointModel,
  DFSPCertificateModel,
  HubEndpointModel,
  HubCertificateModel,
  ConnectorModel,
  ControlServer,
  AuthModel,
} from '@mojaloop/mcm-client';
import type { Config } from '../config/schema';
import type { AppConfig } from '../config';
import type { Logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface McmClientStatus {
  initialized: boolean;
  running: boolean;
  retrying: boolean;
  retryAttempt?: number;
  nextRetryIn?: number;
  currentState?: string;
  states?: Record<string, {
    status: string;
    stateDescription?: string;
    lastUpdated?: string;
    errorDescription?: string;
  }>;
  certificateExpiry?: {
    dfspClient?: Date;
    dfspServer?: Date;
    hubClient?: Date;
  };
  lastError?: string;
}

export interface McmClientWrapperOptions {
  config: Config;
  appConfig: AppConfig;
  logger: Logger;
}

export class McmClientWrapper extends EventEmitter {
  private config: Config;
  private appConfig: AppConfig;
  private logger: Logger;
  private vault?: Vault;
  private stateMachine?: any;
  private authModel?: any;
  private status: McmClientStatus = {
    initialized: false,
    running: false,
    retrying: false,
  };

  constructor(options: McmClientWrapperOptions) {
    super();
    this.config = options.config;
    this.appConfig = options.appConfig;
    this.logger = options.logger;
  }

  private async startAuthWithRetry(): Promise<void> {
    const RETRY_DELAY_MS = 5000;
    let attempt = 0;
    let shouldRelogin = false;

    this.on('auth-config-updated', () => {
      this.logger.info('Auth config updated - will re-authenticate');
      shouldRelogin = true;
    });

    while (true) {
      try {
        attempt++;
        this.logger.info(`Attempting auth login (attempt ${attempt})`);
        await this.authModel.login();
        this.logger.info('Auth login successful');
        attempt = 0;
        shouldRelogin = false;

        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (shouldRelogin) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 1000);
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Auth login failed (attempt ${attempt}): ${errorMessage}`);
        this.logger.info(`Retrying auth login in ${RETRY_DELAY_MS}ms...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing MCM client wrapper');

      if (!this.appConfig.vault.auth) {
        throw new Error('Vault auth configuration is required');
      }

      this.vault = new Vault({
        endpoint: this.appConfig.vault.endpoint,
        mounts: {
          pki: this.appConfig.vault.pkiMount,
          kv: this.appConfig.vault.stateMachineKvMount, // Use KV v1 for state machine state
        },
        pkiServerRole: this.appConfig.vault.pkiServerRole,
        pkiClientRole: this.appConfig.vault.pkiClientRole,
        auth: this.appConfig.vault.auth,
        signExpiryHours: this.appConfig.vault.signExpiryHours,
        keyLength: this.appConfig.vault.keyLength,
        keyAlgorithm: this.appConfig.vault.keyAlgorithm,
        logger: this.logger,
        commonName: this.config.vault?.commonName || 'default',
      });

      await this.vault.connect();

      this.authModel = new AuthModel({
        logger: this.logger,
        auth: this.config.mcm.auth,
        hubIamProviderUrl: this.config.mcm.hubIamProviderUrl,
      });

      this.startAuthWithRetry().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Unexpected error in auth retry loop: ${errorMessage}`);
      });

      const opts = {
        dfspId: this.config.common.dfspId,
        hubEndpoint: this.config.mcm.serverEndpoint,
        logger: this.logger,
        retries: Infinity, // Retry indefinitely
      };

      const dfspCertificateModel = new DFSPCertificateModel(opts);
      const dfspEndpointModel = new DFSPEndpointModel(opts);
      const hubCertificateModel = new HubCertificateModel(opts);
      const hubEndpointModel = new HubEndpointModel(opts);

      // Prepare SDK config with MCM OAuth fallbacks
      this.logger.info('Raw config.sdk.whitelistIp:', this.config.sdk?.whitelistIp);

      const sdkConfig = {
        ...this.config.sdk,
        oauth: {
          tokenEndpoint: this.config.sdk?.oauth?.tokenEndpoint ||
            (this.config.mcm?.hubIamProviderUrl ?
              `${this.config.mcm.hubIamProviderUrl}/realms/hub-operators/protocol/openid-connect/token` :
              undefined),
          clientKey: this.config.sdk?.oauth?.clientKey || this.config.mcm?.auth?.creds?.clientId,
          clientSecret: this.config.sdk?.oauth?.clientSecret || this.config.mcm?.auth?.creds?.clientSecret,
        },
      };

      // Prepare dfspServerCsrParameters with FQDN fallback
      const dfspServerCsrParameters = this.config.dfspServerCsrParameters?.subject?.CN
        ? this.config.dfspServerCsrParameters
        : {
            subject: {
              CN: this.config.sdk?.fqdn || '',
              OU: '',
              O: '',
              L: '',
              ST: '',
              C: '',
            },
            extensions: {
              subjectAltName: {
                dns: [],
                ips: [],
              },
            },
          };

      const machineConfig = {
        logger: this.logger,
        vault: this.vault,
        refreshIntervalSeconds: this.appConfig.stateMachine.retryIntervalSeconds,
        certExpiryThresholdDays: this.config.mcm.certExpiryThresholdDays,
        dfspCertificateModel,
        dfspEndpointModel,
        hubCertificateModel,
        hubEndpointModel,
        ControlServer,
        port: this.appConfig.stateMachine.port,
        config: {
          ...this.config,
          sdk: sdkConfig,
          dfspServerCsrParameters,
          // Flatten sdk.callbackUrl and sdk.whitelistIp for state machine compatibility
          callbackURL: this.config.sdk?.callbackUrl || `https://${this.config.sdk?.fqdn || ''}`,
          whitelistIP: this.config.sdk?.whitelistIp || [],
        },
        reportStatesStatusIntervalSeconds: this.appConfig.stateMachine.reportStatesStatusIntervalSeconds,
      };

      this.logger.info('State machine config values:', {
        port: machineConfig.port,
        reportStatesStatusIntervalSeconds: machineConfig.reportStatesStatusIntervalSeconds,
        refreshIntervalSeconds: machineConfig.refreshIntervalSeconds,
        certExpiryThresholdDays: machineConfig.certExpiryThresholdDays,
        whitelistIP: machineConfig.config.whitelistIP,
        'sdk.whitelistIp': machineConfig.config.sdk?.whitelistIp,
        callbackURL: machineConfig.config.callbackURL,
      });

      this.stateMachine = new ConnectionStateMachine(machineConfig);

      this.status.initialized = true;
      this.logger.info('MCM client wrapper initialized successfully');
      this.emit('initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to initialize MCM client wrapper: ${errorMessage}`);
      this.status.lastError = errorMessage;
      this.emit('error', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      this.logger.info('Starting MCM client wrapper');

      // Initialize and start the state machine
      // The state machine will handle connection retries internally
      await this.initialize();

      this.logger.info('Starting MCM client state machine');
      await this.stateMachine.start();

      this.status.running = true;
      this.status.retrying = false;
      this.status.retryAttempt = undefined;
      this.status.nextRetryIn = undefined;
      this.emit('started');
      this.logger.info('MCM client state machine started successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to start MCM client: ${errorMessage}`);
      this.status.lastError = errorMessage;
      this.status.running = false;
      this.emit('error', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.stateMachine) {
      return;
    }

    try {
      this.logger.info('Stopping MCM client state machine');
      await this.stateMachine.stop();
      this.vault?.disconnect();
      this.status.running = false;
      this.emit('stopped');
      this.logger.info('MCM client state machine stopped');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to stop MCM client state machine: ${errorMessage}`);
      this.status.lastError = errorMessage;
      this.emit('error', error);
      throw error;
    }
  }

  async reload(newConfig: Config): Promise<void> {
    this.logger.info('Reloading MCM client configuration');
    const wasRunning = this.status.running;

    // Stop the current state machine if running
    if (this.stateMachine) {
      this.logger.info('Stopping state machine for configuration reload');
      await this.stop();
    }

    // Update configuration
    this.config = newConfig;

    // Reset JWT singleton to pick up new hubIamProviderUrl
    const jwtModule = await import('@mojaloop/mcm-client/dist/lib/requests/jwt.js');
    const JWTSingleton = jwtModule.JWTSingleton;
    JWTSingleton.instance = null;
    this.logger.info('JWT singleton reset for configuration reload');

    // Reset initialization flag to force re-initialization
    this.status.initialized = false;

    // Always restart to reinitialize with new configuration
    this.logger.info('Reinitializing with new configuration');
    await this.start();

    this.emit('reloaded');
    this.logger.info('Configuration reloaded successfully');
  }

  getStatus(): McmClientStatus {
    const status = { ...this.status };

    if (this.stateMachine) {
      try {
        const state = this.stateMachine.getState(true);
        status.currentState = JSON.stringify(state);
        status.states = state; // Add parsed states object
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.debug(`Failed to get state machine state: ${errorMessage}`);
      }
    }

    return status;
  }

  getVault(): Vault | undefined {
    return this.vault;
  }

  getStateMachine(): any {
    return this.stateMachine;
  }
}
