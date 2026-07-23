import type { FastifyPluginAsync } from 'fastify';
import { configSchema } from '~/config/schema';
import type { AppConfig } from '~/config';
import type { VaultConfigStorage } from '~/config/vault-storage';
import type { McmClientWrapper } from '~/services/mcm-client-wrapper';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    configStorage: VaultConfigStorage;
    mcmClient: McmClientWrapper;
  }
}

export const configRoutes: FastifyPluginAsync = async (server) => {
  server.get('/', async (request, reply) => {
    const startTime = Date.now();
    server.log.debug(`[CONFIG-DEBUG] Request started at ${startTime}`);

    try {
      server.log.debug(`[CONFIG-DEBUG] About to call configStorage.load at ${Date.now() - startTime}ms`);
      const dfspConfig = await server.configStorage.load(server.config.vaultConfigPath);
      server.log.debug(`[CONFIG-DEBUG] configStorage.load completed at ${Date.now() - startTime}ms`);

      server.log.debug(`[CONFIG-DEBUG] About to send response at ${Date.now() - startTime}ms`);
      return reply.send(dfspConfig);
    } catch (error) {
      server.log.error({ error }, 'Failed to load configuration');
      return reply.code(500).send({ error: 'Failed to load configuration' });
    }
  });

  server.get('/versions', async (request, reply) => {
    try {
      const versions = await server.configStorage.getVersions(server.config.vaultConfigPath);
      return reply.send({ versions });
    } catch (error) {
      server.log.error({ error }, 'Failed to get configuration versions');
      return reply.code(500).send({ error: 'Failed to get configuration versions' });
    }
  });

  server.post('/', async (request, reply) => {
    try {
      const validated = configSchema.parse(request.body);
      await server.configStorage.save(server.config.vaultConfigPath, validated);

      // Reload the entire mcm-client to recreate models with new config
      await server.mcmClient.reload(validated);

      return reply.code(200).send({ success: true, message: 'Configuration saved successfully' });
    } catch (error) {
      server.log.error({ error }, 'Failed to save configuration');
      return reply.code(400).send({
        success: false,
        error: 'Invalid configuration',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  server.patch('/', async (request, reply) => {
    try {
      const currentConfig = await server.configStorage.load(server.config.vaultConfigPath);
      const updates = request.body as any;

      const mergedConfig = {
        ...currentConfig,
        ...updates,
      };

      const validated = configSchema.parse(mergedConfig);
      await server.configStorage.save(server.config.vaultConfigPath, validated);

      // Reload the entire mcm-client to recreate models with new config
      await server.mcmClient.reload(validated);

      return reply.code(200).send({ message: 'Configuration updated successfully' });
    } catch (error) {
      server.log.error({ error }, 'Failed to update configuration');
      return reply.code(400).send({
        error: 'Invalid configuration',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  server.post('/validate', async (request, reply) => {
    try {
      const validated = configSchema.parse(request.body);
      return reply.code(200).send({ valid: true });
    } catch (error) {
      server.log.debug({ error }, 'Configuration validation failed');
      return reply.code(400).send({
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
