import { logger } from './utils/logger';
import { VaultConfigStorage } from './config/vault-storage';
import { McmClientWrapper } from './services/mcm-client-wrapper';
import { createServer } from './api/server';
import { config } from './config';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  try {
    logger.info('Starting MCM Agent');

    const configStorage = new VaultConfigStorage({ logger, config: config.vault });
    await configStorage.initialize();

    // Check if configuration exists in Vault, if not, load from default.json
    if (!(await configStorage.exists(config.vaultConfigPath))) {
      logger.info('Configuration not found in Vault, loading default configuration');

      const defaultConfigPath = join(__dirname, '../config/default.json');
      const defaultConfigContent = await readFile(defaultConfigPath, 'utf-8');
      const defaultConfig = JSON.parse(defaultConfigContent);

      await configStorage.save(config.vaultConfigPath, defaultConfig);
      logger.info(
        { vaultUIUrl: configStorage.getVaultUIUrl(config.vaultConfigPath) },
        'Default configuration saved to Vault'
      );
    }

    const dfspConfig = await configStorage.load(config.vaultConfigPath);
    logger.info(`Configuration loaded from Vault`);

    const mcmClient = new McmClientWrapper({
      config: dfspConfig,
      appConfig: config,
      logger,
    });

    mcmClient.on('initialized', () => {
      logger.info('MCM client initialized');
    });

    mcmClient.on('started', () => {
      logger.info('MCM client started');
    });

    mcmClient.on('error', (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`MCM client error: ${errorMessage}`);
    });

    mcmClient.on('state-change', (state) => {
      logger.debug(`State machine transition: ${state.value}`);
    });

    const server = await createServer({
      logger,
      config,
      configStorage,
      mcmClient,
    });

    mcmClient.start();

    const shutdown = async (signal: string) => {
      logger.info(`Shutting down on signal: ${signal}`);

      await server.close();
      await mcmClient.stop();

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    logger.info('MCM Agent started successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to start MCM Agent: ${errorMessage}`);
    process.exit(1);
  }
}

main();
