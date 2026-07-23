import type { FastifyPluginAsync } from 'fastify';

export const actionsRoutes: FastifyPluginAsync = async (server) => {
  server.post('/create-int-ca', async (request, reply) => {
    try {
      const { subject } = request.body as any;

      if (!subject || !subject.CN) {
        return reply.code(400).send({ success: false, error: 'Missing required field: subject.CN' });
      }

      const stateMachine = server.mcmClient.getStateMachine();
      if (!stateMachine) {
        return reply.code(500).send({ success: false, error: 'State machine not initialized' });
      }

      // Save CA subject to config for future use as defaults
      const configStorage = server.configStorage;
      const config = await configStorage.load(server.config.vaultConfigPath);
      if (!config.dfspCaCsrParameters) {
        config.dfspCaCsrParameters = { subject: {} };
      }
      config.dfspCaCsrParameters.subject = subject;
      await configStorage.save(server.config.vaultConfigPath, config);
      server.log.info('Saved CA subject to config');

      server.log.info({ subject }, 'Creating internal DFSP CA');
      stateMachine.sendEvent({ type: 'CREATE_INT_CA', subject });

      return reply.code(200).send({ success: true, message: 'Internal CA creation initiated' });
    } catch (error) {
      server.log.error({ error }, 'Failed to create internal CA');
      return reply.code(500).send({ success: false, error: 'Internal CA creation failed' });
    }
  });

  server.post('/create-ext-ca', async (request, reply) => {
    try {
      const { rootCert, intermediateChain, privateKey } = request.body as any;

      if (!rootCert || !intermediateChain || !privateKey) {
        return reply.code(400).send({ success: false, error: 'Missing required fields: rootCert, intermediateChain, privateKey' });
      }

      const stateMachine = server.mcmClient.getStateMachine();
      if (!stateMachine) {
        return reply.code(500).send({ success: false, error: 'State machine not initialized' });
      }

      server.log.info('Creating external DFSP CA');
      stateMachine.sendEvent({ type: 'CREATE_EXT_CA', rootCert, intermediateChain, privateKey });

      return reply.code(200).send({ success: true, message: 'External CA upload initiated' });
    } catch (error) {
      server.log.error({ error }, 'Failed to upload external CA');
      return reply.code(500).send({ success: false, error: 'External CA upload failed' });
    }
  });

  server.post('/create-server-cert', async (request, reply) => {
    try {
      const stateMachine = server.mcmClient.getStateMachine();
      if (!stateMachine) {
        return reply.code(500).send({ success: false, error: 'State machine not initialized' });
      }

      const configStorage = server.configStorage;
      const config = await configStorage.load(server.config.vaultConfigPath);
      const body = request.body as any;

      // Parse CSR parameters from request or use config defaults
      let csr;
      if (body?.subject?.CN) {
        csr = {
          subject: {
            CN: body.subject.CN,
            OU: body.subject.OU || '',
            O: body.subject.O || '',
            L: body.subject.L || '',
            ST: body.subject.ST || '',
            C: body.subject.C || '',
          },
          extensions: {
            subjectAltName: {
              dns: body.extensions?.subjectAltName?.dns || [],
              ips: body.extensions?.subjectAltName?.ips || [],
            },
          },
        };

        // Save CSR parameters to config for future use as defaults
        config.dfspServerCsrParameters = csr;
        await configStorage.save(server.config.vaultConfigPath, config);
        server.log.info('Saved CSR parameters to config');
      } else {
        // Fallback to config defaults
        csr = config.dfspServerCsrParameters;

        // If no CSR parameters exist, return error
        if (!csr || !csr.subject) {
          return reply.code(400).send({ success: false, error: 'No CSR parameters provided and no defaults found in configuration' });
        }
      }

      server.log.info({ csr }, 'Creating DFSP server certificate');
      stateMachine.sendEvent({ type: 'CREATE_DFSP_SERVER_CERT', csr });

      return reply.code(200).send({ success: true, message: 'Server certificate creation initiated' });
    } catch (error) {
      server.log.error({ error }, 'Failed to create server certificate');
      return reply.code(500).send({ success: false, error: 'Server certificate creation failed' });
    }
  });

  server.post('/create-client-csr', async (request, reply) => {
    try {
      const stateMachine = server.mcmClient.getStateMachine();
      if (!stateMachine) {
        return reply.code(500).send({ success: false, error: 'State machine not initialized' });
      }

      const body = request.body as any;
      const configStorage = server.configStorage;
      const config = await configStorage.load(server.config.vaultConfigPath);

      // Parse CSR parameters from request or use config defaults
      let csrParameters;
      if (body?.subject?.CN) {
        csrParameters = {
          subject: {
            CN: body.subject.CN,
            C: body.subject.C || '',
            ST: body.subject.ST || '',
            L: body.subject.L || '',
            O: body.subject.O || '',
            OU: body.subject.OU || '',
          },
        };

        // Save CSR parameters to config for future use as defaults
        config.dfspClientCsrParameters = csrParameters;
        await configStorage.save(server.config.vaultConfigPath, config);
        server.log.info('Saved DFSP Client CSR parameters to config');
      } else {
        // Use defaults from config
        csrParameters = config.dfspClientCsrParameters;
      }

      server.log.info({ csrParameters }, 'Creating DFSP Client CSR');
      stateMachine.sendEvent({ type: 'CREATE_DFSP_CLIENT_CERT' });

      return reply.code(200).send({ success: true, message: 'DFSP Client CSR creation initiated' });
    } catch (error) {
      server.log.error({ error }, 'Failed to create DFSP Client CSR');
      return reply.code(500).send({ success: false, error: 'DFSP Client CSR creation failed' });
    }
  });

  server.post('/recreate-jws', async (request, reply) => {
    try {
      const stateMachine = server.mcmClient.getStateMachine();
      if (!stateMachine) {
        return reply.code(500).send({ success: false, error: 'State machine not initialized' });
      }

      server.log.info('Recreating JWS keys');
      stateMachine.sendEvent({ type: 'CREATE_JWS' });

      return reply.code(200).send({ success: true, message: 'JWS key recreation initiated' });
    } catch (error) {
      server.log.error({ error }, 'Failed to recreate JWS keys');
      return reply.code(500).send({ success: false, error: 'JWS key recreation failed' });
    }
  });
};
