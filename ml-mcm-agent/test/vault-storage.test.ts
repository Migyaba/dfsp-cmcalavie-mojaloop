import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VaultConfigStorage } from '~/config/vault-storage.js';

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const mockVaultClient = {
  approleLogin: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  delete: vi.fn(),
  tokenLookupSelf: vi.fn(),
  token: null as string | null,
};

vi.mock('node-vault', () => ({
  default: () => mockVaultClient,
}));

describe('VaultConfigStorage', () => {
  let storage: VaultConfigStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockVaultClient.approleLogin.mockResolvedValue({
      auth: { client_token: 'test-token' },
    });

    storage = new VaultConfigStorage({
      logger: mockLogger as any,
      config: {
        endpoint: 'http://vault:8200',
        kvMount: 'secret',
        pkiMount: 'pki',
        auth: {
          appRole: {
            roleId: 'test-role-id',
            roleSecretId: 'test-secret-id',
          },
        },
      },
    });
  });

  afterEach(() => {
    storage.destroy();
    vi.useRealTimers();
  });

  describe('initialize()', () => {
    it('should authenticate with AppRole', async () => {
      await storage.initialize();

      expect(mockVaultClient.approleLogin).toHaveBeenCalledWith({
        role_id: 'test-role-id',
        secret_id: 'test-secret-id',
      });
      expect(mockVaultClient.token).toBe('test-token');
    });

    it('should throw if no auth configured', async () => {
      const noAuthStorage = new VaultConfigStorage({
        logger: mockLogger as any,
        config: {
          endpoint: 'http://vault:8200',
          kvMount: 'secret',
          pkiMount: 'pki',
        },
      });

      await expect(noAuthStorage.initialize()).rejects.toThrow('Vault auth configuration is required');
    });

    it('should throw if K8s auth requested (not implemented)', async () => {
      const k8sStorage = new VaultConfigStorage({
        logger: mockLogger as any,
        config: {
          endpoint: 'http://vault:8200',
          kvMount: 'secret',
          pkiMount: 'pki',
          auth: { k8s: { token: 'token', role: 'role' } },
        },
      });

      await expect(k8sStorage.initialize()).rejects.toThrow('K8s auth not yet supported');
    });
  });

  describe('load()', () => {
    it('should load config from Vault', async () => {
      await storage.initialize();

      mockVaultClient.read.mockResolvedValue({
        data: {
          data: { common: { dfspId: 'testdfsp' } },
        },
      });

      const config = await storage.load('mcm-agent/config');

      expect(mockVaultClient.read).toHaveBeenCalledWith('secret/data/mcm-agent/config');
      expect(config.common?.dfspId).toBe('testdfsp');
    });

    it('should throw if not initialized', async () => {
      await expect(storage.load('path')).rejects.toThrow('VaultConfigStorage not initialized');
    });

    it('should throw if config not found', async () => {
      await storage.initialize();
      mockVaultClient.read.mockResolvedValue({ data: null });

      await expect(storage.load('missing')).rejects.toThrow('Configuration not found');
    });
  });

  describe('save()', () => {
    it('should save config to Vault', async () => {
      await storage.initialize();

      const config = { common: { dfspId: 'testdfsp' } };
      await storage.save('mcm-agent/config', config);

      expect(mockVaultClient.write).toHaveBeenCalledWith(
        'secret/data/mcm-agent/config',
        { data: expect.objectContaining({ common: { dfspId: 'testdfsp' } }) }
      );
    });

    it('should throw if not initialized', async () => {
      await expect(storage.save('path', {})).rejects.toThrow('VaultConfigStorage not initialized');
    });
  });

  describe('exists()', () => {
    it('should return true if config exists', async () => {
      await storage.initialize();
      mockVaultClient.read.mockResolvedValue({ data: { data: {} } });

      const result = await storage.exists('path');
      expect(result).toBe(true);
    });

    it('should return false if config not found (404)', async () => {
      await storage.initialize();
      mockVaultClient.read.mockRejectedValue({ response: { statusCode: 404 } });

      const result = await storage.exists('path');
      expect(result).toBe(false);
    });

    it('should return false if not initialized', async () => {
      const result = await storage.exists('path');
      expect(result).toBe(false);
    });
  });

  describe('delete()', () => {
    it('should delete config from Vault', async () => {
      await storage.initialize();

      await storage.delete('mcm-agent/config');

      expect(mockVaultClient.delete).toHaveBeenCalledWith('secret/data/mcm-agent/config');
    });
  });

  describe('token renewal', () => {
    it('should renew token when TTL is low', async () => {
      await storage.initialize();

      mockVaultClient.tokenLookupSelf.mockResolvedValue({ data: { ttl: 100 } });
      mockVaultClient.approleLogin.mockResolvedValue({
        auth: { client_token: 'renewed-token' },
      });

      await vi.advanceTimersByTimeAsync(60000);

      expect(mockVaultClient.approleLogin).toHaveBeenCalledTimes(2);
    });
  });

  describe('getVaultUIUrl()', () => {
    it('should return correct Vault UI URL', () => {
      const url = storage.getVaultUIUrl('mcm-agent/config');
      expect(url).toBe('http://vault:8200/ui/vault/secrets/secret/show/mcm-agent/config');
    });
  });
});
