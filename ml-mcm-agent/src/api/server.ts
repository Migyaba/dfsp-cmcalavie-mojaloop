import Fastify from 'fastify';
import type { Logger } from '../utils/logger';
import type { AppConfig } from '../config';
import type { VaultConfigStorage } from '../config/vault-storage';
import type { McmClientWrapper } from '../services/mcm-client-wrapper';
import { configRoutes } from './routes/config';
import { statusRoutes } from './routes/status';
import { actionsRoutes } from './routes/actions';

export interface ServerOptions {
  logger: Logger;
  config: AppConfig;
  configStorage: VaultConfigStorage;
  mcmClient: McmClientWrapper;
}

export async function createServer(options: ServerOptions) {
  const { logger, config, configStorage, mcmClient } = options;
  const { vaultConfigPath, server: serverConfig } = config;
  const { port, host } = serverConfig;

  const server = Fastify({
    logger: {
      level: serverConfig.logLevel,
    },
  });

  server.decorate('config', config);
  server.decorate('configStorage', configStorage);
  server.decorate('mcmClient', mcmClient);

  server.get('/health', async (request, reply) => {
    const status = mcmClient.getStatus();
    return reply.code(200).send({
      status: 'ok',
      mcmClient: {
        initialized: status.initialized,
        running: status.running,
      },
    });
  });

  await server.register(configRoutes, { prefix: '/api/config' });
  await server.register(statusRoutes, { prefix: '/api/status' });
  await server.register(actionsRoutes, { prefix: '/api/actions' });

  const address = await server.listen({ port, host });
  logger.info(`Server listening at ${address}`);

  return server;
}
