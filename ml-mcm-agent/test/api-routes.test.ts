import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { configRoutes } from '~/api/routes/config.js';
import { statusRoutes } from '~/api/routes/status.js';
import { actionsRoutes } from '~/api/routes/actions.js';

const mockConfigStorage = {
  load: vi.fn(),
  save: vi.fn(),
  getVersions: vi.fn(),
};

const mockMcmClient = {
  getStatus: vi.fn(),
  reload: vi.fn(),
  getStateMachine: vi.fn(),
};

const mockConfig = {
  vaultConfigPath: 'mcm-agent/config',
};

async function buildApp() {
  const app = Fastify({ logger: false });

  app.decorate('config', mockConfig);
  app.decorate('configStorage', mockConfigStorage);
  app.decorate('mcmClient', mockMcmClient);

  await app.register(configRoutes, { prefix: '/api/config' });
  await app.register(statusRoutes, { prefix: '/api/status' });
  await app.register(actionsRoutes, { prefix: '/api/actions' });

  return app;
}

describe('API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/status', () => {
    it('should return MCM client status', async () => {
      const app = await buildApp();
      mockMcmClient.getStatus.mockReturnValue({
        initialized: true,
        running: true,
        currentState: 'connected',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/status',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        initialized: true,
        running: true,
        currentState: 'connected',
      });
    });

    it('should return 500 on error', async () => {
      const app = await buildApp();
      mockMcmClient.getStatus.mockImplementation(() => {
        throw new Error('Status error');
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/status',
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('GET /api/config', () => {
    it('should return config from storage', async () => {
      const app = await buildApp();
      mockConfigStorage.load.mockResolvedValue({
        common: { dfspId: 'testdfsp' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/config',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).common.dfspId).toBe('testdfsp');
    });

    it('should return 500 on load error', async () => {
      const app = await buildApp();
      mockConfigStorage.load.mockRejectedValue(new Error('Load failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/config',
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('POST /api/config', () => {
    it('should save config and reload MCM client', async () => {
      const app = await buildApp();
      mockConfigStorage.save.mockResolvedValue(undefined);
      mockMcmClient.reload.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/api/config',
        payload: { common: { dfspId: 'newdfsp' } },
      });

      expect(response.statusCode).toBe(200);
      expect(mockConfigStorage.save).toHaveBeenCalled();
      expect(mockMcmClient.reload).toHaveBeenCalled();
    });

    it('should return 400 on invalid config', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/config',
        payload: { mcm: { serverEndpoint: 'invalid-url' } },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/config/validate', () => {
    it('should return valid: true for valid config', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/config/validate',
        payload: { common: { dfspId: 'test' } },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).valid).toBe(true);
    });

    it('should return valid: false for invalid config', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/config/validate',
        payload: { mcm: { serverEndpoint: 'not-a-url' } },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).valid).toBe(false);
    });
  });

  describe('GET /api/config/versions', () => {
    it('should return version history', async () => {
      const app = await buildApp();
      mockConfigStorage.getVersions.mockResolvedValue([{ version: 1 }, { version: 2 }]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/config/versions',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).versions).toHaveLength(2);
    });
  });

  describe('POST /api/actions/create-int-ca', () => {
    it('should require subject.CN', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/actions/create-int-ca',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toContain('subject.CN');
    });

    it('should return 500 if state machine not initialized', async () => {
      const app = await buildApp();
      mockMcmClient.getStateMachine.mockReturnValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/actions/create-int-ca',
        payload: { subject: { CN: 'Test CA' } },
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.payload).error).toContain('State machine not initialized');
    });

    it('should send CREATE_INT_CA event', async () => {
      const app = await buildApp();
      const mockStateMachine = { sendEvent: vi.fn() };
      mockMcmClient.getStateMachine.mockReturnValue(mockStateMachine);
      mockConfigStorage.load.mockResolvedValue({});
      mockConfigStorage.save.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/api/actions/create-int-ca',
        payload: { subject: { CN: 'Test CA', O: 'Test Org' } },
      });

      expect(response.statusCode).toBe(200);
      expect(mockStateMachine.sendEvent).toHaveBeenCalledWith({
        type: 'CREATE_INT_CA',
        subject: { CN: 'Test CA', O: 'Test Org' },
      });
    });
  });

  describe('POST /api/actions/create-ext-ca', () => {
    it('should require all certificate fields', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/actions/create-ext-ca',
        payload: { rootCert: 'cert' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should send CREATE_EXT_CA event', async () => {
      const app = await buildApp();
      const mockStateMachine = { sendEvent: vi.fn() };
      mockMcmClient.getStateMachine.mockReturnValue(mockStateMachine);

      const response = await app.inject({
        method: 'POST',
        url: '/api/actions/create-ext-ca',
        payload: {
          rootCert: 'root-cert',
          intermediateChain: 'chain',
          privateKey: 'key',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockStateMachine.sendEvent).toHaveBeenCalledWith({
        type: 'CREATE_EXT_CA',
        rootCert: 'root-cert',
        intermediateChain: 'chain',
        privateKey: 'key',
      });
    });
  });

  describe('POST /api/actions/recreate-jws', () => {
    it('should send CREATE_JWS event', async () => {
      const app = await buildApp();
      const mockStateMachine = { sendEvent: vi.fn() };
      mockMcmClient.getStateMachine.mockReturnValue(mockStateMachine);

      const response = await app.inject({
        method: 'POST',
        url: '/api/actions/recreate-jws',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(mockStateMachine.sendEvent).toHaveBeenCalledWith({ type: 'CREATE_JWS' });
    });
  });
});
