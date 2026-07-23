import { describe, it, expect } from 'vitest';
import {
  configSchema,
  commonSchema,
  mcmSchema,
  sdkSchema,
  vaultSchema,
  dfspCaCsrParametersSchema,
  dfspClientCsrParametersSchema,
  dfspServerCsrParametersSchema,
} from '~/config/schema.js';

describe('Schema Validation', () => {
  describe('commonSchema', () => {
    it('should accept valid common config', () => {
      const config = { dfspId: 'testdfsp' };
      const result = commonSchema.parse(config);
      expect(result.dfspId).toBe('testdfsp');
    });

    it('should accept config without optional dfspId', () => {
      const config = {};
      const result = commonSchema.parse(config);
      expect(result.dfspId).toBeUndefined();
    });

    it('should passthrough unknown fields', () => {
      const config = { dfspId: 'test', customField: 'value' };
      const result = commonSchema.parse(config);
      expect(result.customField).toBe('value');
    });
  });

  describe('mcmSchema', () => {
    it('should accept valid MCM config with URL', () => {
      const config = {
        serverEndpoint: 'https://mcm.example.com',
        hubIamProviderUrl: 'https://iam.example.com',
      };
      const result = mcmSchema.parse(config);
      expect(result.serverEndpoint).toBe('https://mcm.example.com');
    });

    it('should reject invalid URL for serverEndpoint', () => {
      const config = { serverEndpoint: 'not-a-url' };
      expect(() => mcmSchema.parse(config)).toThrow('Must be a valid URL');
    });

    it('should apply default for certExpiryThresholdDays', () => {
      const config = {};
      const result = mcmSchema.parse(config);
      expect(result.certExpiryThresholdDays).toBe(30);
    });

    it('should accept auth configuration', () => {
      const config = {
        auth: {
          enabled: true,
          creds: {
            clientId: 'test-client',
            clientSecret: 'test-secret',
          },
          tokenRefreshMarginSeconds: 60,
        },
      };
      const result = mcmSchema.parse(config);
      expect(result.auth?.enabled).toBe(true);
      expect(result.auth?.creds?.clientId).toBe('test-client');
    });

    it('should apply default for tokenRefreshMarginSeconds', () => {
      const config = {
        auth: {
          creds: { clientId: 'test' },
        },
      };
      const result = mcmSchema.parse(config);
      expect(result.auth?.tokenRefreshMarginSeconds).toBe(30);
    });
  });

  describe('sdkSchema', () => {
    it('should accept valid SDK config with required nested objects', () => {
      const config = {
        fqdn: 'sdk.example.com',
        callbackUrl: 'https://callback.example.com',
        currencies: ['USD', 'EUR'],
        autoAccept: {},
        jws: {},
        tls: {},
      };
      const result = sdkSchema.parse(config);
      expect(result.fqdn).toBe('sdk.example.com');
      expect(result.currencies).toEqual(['USD', 'EUR']);
    });

    it('should apply defaults for autoAccept fields', () => {
      const config = { autoAccept: {}, jws: {}, tls: {} };
      const result = sdkSchema.parse(config);
      expect(result.autoAccept.quotes).toBe(false);
      expect(result.autoAccept.party).toBe(true);
    });

    it('should apply defaults for jws fields', () => {
      const config = { autoAccept: {}, jws: {}, tls: {} };
      const result = sdkSchema.parse(config);
      expect(result.jws.sign).toBe(true);
      expect(result.jws.validateInbound).toBe(true);
    });

    it('should apply defaults for tls fields', () => {
      const config = { autoAccept: {}, jws: {}, tls: {} };
      const result = sdkSchema.parse(config);
      expect(result.tls.outboundMutual).toBe(true);
      expect(result.tls.inboundMutual).toBe(true);
    });

    it('should accept valid oauth tokenEndpoint URL', () => {
      const config = {
        autoAccept: {},
        jws: {},
        tls: {},
        oauth: {
          tokenEndpoint: 'https://oauth.example.com/token',
          clientKey: 'key',
          clientSecret: 'secret',
        },
      };
      const result = sdkSchema.parse(config);
      expect(result.oauth?.tokenEndpoint).toBe('https://oauth.example.com/token');
    });

    it('should accept empty oauth tokenEndpoint', () => {
      const config = {
        autoAccept: {},
        jws: {},
        tls: {},
        oauth: {
          tokenEndpoint: '',
          clientKey: 'key',
        },
      };
      const result = sdkSchema.parse(config);
      expect(result.oauth?.tokenEndpoint).toBe('');
    });

    it('should reject invalid oauth tokenEndpoint URL', () => {
      const config = {
        autoAccept: {},
        jws: {},
        tls: {},
        oauth: {
          tokenEndpoint: 'not-a-url',
        },
      };
      expect(() => sdkSchema.parse(config)).toThrow('Must be a valid URL or empty');
    });

    it('should apply defaults for whitelistIp and currencies', () => {
      const config = { autoAccept: {}, jws: {}, tls: {} };
      const result = sdkSchema.parse(config);
      expect(result.whitelistIp).toEqual([]);
      expect(result.currencies).toEqual([]);
    });
  });

  describe('vaultSchema', () => {
    it('should accept vault config with commonName', () => {
      const config = { commonName: 'test-cn' };
      const result = vaultSchema.parse(config);
      expect(result.commonName).toBe('test-cn');
    });

    it('should passthrough unknown fields', () => {
      const config = { commonName: 'test', extraField: 'value' };
      const result = vaultSchema.parse(config);
      expect(result.extraField).toBe('value');
    });
  });

  describe('CSR Parameters Schemas', () => {
    describe('dfspCaCsrParametersSchema', () => {
      it('should accept valid CA CSR parameters', () => {
        const config = {
          subject: {
            CN: 'Test CA',
            O: 'Test Org',
            C: 'US',
          },
        };
        const result = dfspCaCsrParametersSchema.parse(config);
        expect(result?.subject?.CN).toBe('Test CA');
      });

      it('should accept empty config', () => {
        const result = dfspCaCsrParametersSchema.parse({});
        expect(result).toEqual({});
      });

      it('should accept undefined', () => {
        const result = dfspCaCsrParametersSchema.parse(undefined);
        expect(result).toBeUndefined();
      });
    });

    describe('dfspClientCsrParametersSchema', () => {
      it('should accept valid client CSR parameters', () => {
        const config = {
          subject: {
            CN: 'Test Client',
            OU: 'Test Unit',
          },
        };
        const result = dfspClientCsrParametersSchema.parse(config);
        expect(result?.subject?.CN).toBe('Test Client');
      });
    });

    describe('dfspServerCsrParametersSchema', () => {
      it('should accept valid server CSR parameters with extensions', () => {
        const config = {
          subject: {
            CN: 'server.example.com',
          },
          extensions: {
            subjectAltName: {
              dns: ['server.example.com', 'alt.example.com'],
              ips: ['192.168.1.1'],
            },
          },
        };
        const result = dfspServerCsrParametersSchema.parse(config);
        expect(result?.subject?.CN).toBe('server.example.com');
        expect(result?.extensions?.subjectAltName?.dns).toEqual(['server.example.com', 'alt.example.com']);
        expect(result?.extensions?.subjectAltName?.ips).toEqual(['192.168.1.1']);
      });

      it('should apply defaults for subjectAltName arrays', () => {
        const config = {
          subject: { CN: 'test' },
          extensions: {
            subjectAltName: {},
          },
        };
        const result = dfspServerCsrParametersSchema.parse(config);
        expect(result?.extensions?.subjectAltName?.dns).toEqual([]);
        expect(result?.extensions?.subjectAltName?.ips).toEqual([]);
      });
    });
  });

  describe('configSchema (full config)', () => {
    it('should accept valid full config', () => {
      const config = {
        common: { dfspId: 'testdfsp' },
        mcm: {
          serverEndpoint: 'https://mcm.example.com',
          auth: {
            enabled: true,
            creds: { clientId: 'client', clientSecret: 'secret' },
          },
          hubIamProviderUrl: 'https://iam.example.com',
        },
        sdk: {
          fqdn: 'sdk.example.com',
          currencies: ['USD'],
          autoAccept: {},
          jws: {},
          tls: {},
        },
        vault: {
          commonName: 'test-cn',
        },
        dfspCaCsrParameters: {
          subject: { CN: 'Test CA' },
        },
      };

      const result = configSchema.parse(config);
      expect(result.common?.dfspId).toBe('testdfsp');
      expect(result.mcm?.serverEndpoint).toBe('https://mcm.example.com');
      expect(result.sdk?.fqdn).toBe('sdk.example.com');
    });

    it('should accept empty config', () => {
      const config = {};
      const result = configSchema.parse(config);
      expect(result).toBeDefined();
    });

    it('should passthrough unknown top-level fields', () => {
      const config = { customSection: { data: 'value' } };
      const result = configSchema.parse(config);
      expect(result.customSection).toEqual({ data: 'value' });
    });

    it('should reject config with invalid nested URL', () => {
      const config = {
        mcm: {
          serverEndpoint: 'invalid-url',
        },
      };
      expect(() => configSchema.parse(config)).toThrow();
    });
  });
});
