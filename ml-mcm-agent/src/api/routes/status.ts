import type { FastifyPluginAsync } from 'fastify';
import type { McmClientWrapper } from '../../services/mcm-client-wrapper';

export const statusRoutes: FastifyPluginAsync = async (server) => {
  server.get('/', async (request, reply) => {
    try {
      const status = server.mcmClient.getStatus();
      return reply.send(status);
    } catch (error) {
      server.log.error({ error }, 'Failed to get status');
      return reply.code(500).send({ error: 'Failed to get status' });
    }
  });
};
