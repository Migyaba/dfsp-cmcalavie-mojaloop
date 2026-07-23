import { z } from 'zod';

// Common settings
export const commonSchema = z.object({
  dfspId: z.string().optional(),
}).passthrough();

// MCM Server configuration
export const mcmSchema = z.object({
  serverEndpoint: z.string().url('Must be a valid URL').optional(),
  auth: z.object({
    enabled: z.boolean().default(true),
    creds: z.object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
    }).passthrough(),
    tokenRefreshMarginSeconds: z.number().default(30),
  }).passthrough().optional(),
  hubIamProviderUrl: z.string().optional(),
  certExpiryThresholdDays: z.number().default(30),
}).passthrough();

// SDK Scheme Adapter configuration (includes connector settings)
export const sdkSchema = z.object({
  fqdn: z.string().optional(),
  callbackUrl: z.string().optional(),
  whitelistIp: z.array(z.string()).default([]),
  fxpResponse: z.string().optional(),
  pm4mlEnabled: z.boolean().default(true),
  currencies: z.array(z.string()).default([]),
  autoAccept: z.object({
    quotes: z.boolean().default(false),
    party: z.boolean().default(true),
    r2pParty: z.boolean().default(false),
    r2pBusinessQuotes: z.boolean().default(false),
    r2pDeviceOtp: z.boolean().default(false),
    participantsPut: z.boolean().default(false),
  }).passthrough(),
  jws: z.object({
    sign: z.boolean().default(true),
    validateInbound: z.boolean().default(true),
  }).passthrough(),
  peerEndpoint: z.string().optional(),
  alsEndpoint: z.string().optional(),
  tls: z.object({
    outboundMutual: z.boolean().default(true),
    inboundMutual: z.boolean().default(true),
  }).passthrough(),
  oauth: z.object({
    tokenEndpoint: z.string().refine((val) => !val || z.string().url().safeParse(val).success, {
      message: 'Must be a valid URL or empty',
    }).optional(),
    clientKey: z.string().optional(),
    clientSecret: z.string().optional(),
  }).passthrough().optional(),
  reserveNotification: z.boolean().default(true),
}).passthrough();

// Vault configuration (DFSP-specific PKI parameters only)
// Infrastructure configs (endpoint, mounts, auth, roles, algorithms) are read from environment variables
export const vaultSchema = z.object({
  commonName: z.string().optional(),
}).passthrough();

// CSR subject schema (reusable)
const csrSubjectSchema = z.object({
  CN: z.string().optional(),
  C: z.string().optional(),
  ST: z.string().optional(),
  L: z.string().optional(),
  O: z.string().optional(),
  OU: z.string().optional(),
}).passthrough();

// DFSP CA CSR parameters
export const dfspCaCsrParametersSchema = z.object({
  subject: csrSubjectSchema.optional(),
}).passthrough().optional();

// DFSP Client CSR parameters
export const dfspClientCsrParametersSchema = z.object({
  subject: csrSubjectSchema.optional(),
}).passthrough().optional();

// DFSP Server CSR parameters
export const dfspServerCsrParametersSchema = z.object({
  subject: csrSubjectSchema.optional(),
  extensions: z.object({
    subjectAltName: z.object({
      dns: z.array(z.string()).default([]),
      ips: z.array(z.string()).default([]),
    }).passthrough().optional(),
  }).passthrough().optional(),
}).passthrough().optional();

// Full configuration schema
export const configSchema = z.object({
  common: commonSchema.optional(),
  mcm: mcmSchema.optional(),
  sdk: sdkSchema.optional(),
  vault: vaultSchema.optional(),
  dfspCaCsrParameters: dfspCaCsrParametersSchema,
  dfspClientCsrParameters: dfspClientCsrParametersSchema,
  dfspServerCsrParameters: dfspServerCsrParametersSchema,
}).passthrough();

export type Config = z.infer<typeof configSchema>;
export type CommonConfig = z.infer<typeof commonSchema>;
export type McmConfig = z.infer<typeof mcmSchema>;
export type SdkConfig = z.infer<typeof sdkSchema>;
export type VaultConfig = z.infer<typeof vaultSchema>;
