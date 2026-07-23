export type Tab = 'status' | 'configuration' | 'edit' | 'actions';

export interface State {
  status: 'pending' | 'inProgress' | 'completed' | 'inError';
  stateDescription: string;
  lastUpdated: string;
  errorDescription?: string;
}

export interface Status {
  states: Record<string, State>;
  health: string;
}

export interface Config {
  common?: { dfspId?: string };
  mcm?: {
    serverEndpoint?: string;
    auth?: { creds?: { clientId?: string; clientSecret?: string } };
    hubIamProviderUrl?: string;
    certExpiryThresholdDays?: number;
  };
  sdk?: {
    fqdn?: string;
    callbackUrl?: string;
    currencies?: string[];
    peerEndpoint?: string;
    alsEndpoint?: string;
    oauth?: { tokenEndpoint?: string; clientKey?: string; clientSecret?: string };
  };
  vault?: { commonName?: string };
}

export const STATE_NAMES: Record<string, string> = {
  DFSP_CA: 'DFSP Certificate Authority',
  HUB_CA: 'Hub Certificate Authority',
  DFSP_CLIENT_CERT: 'DFSP Client Certificate',
  DFSP_SERVER_CERT: 'DFSP Server Certificate',
  HUB_CERT: 'Hub Client Certificate',
  DFSP_JWS: 'DFSP JWS Keys',
  ENDPOINT_CONFIG: 'Endpoint Configuration',
  PEER_JWS: 'Peer JWS Keys',
};

export const STATE_DESCRIPTIONS: Record<string, string> = {
  'Service not initialized': 'Service not initialized',
  'FETCHING_HUB_CA': 'Fetching Hub CA from server',
  'HUB_CA_CHECKING_NEW': 'Checking for CA updates',
  'NEW_HUB_CA_FETCHED': 'Hub CA configured successfully',
  'FETCHING_PREBUILT_CA': 'Checking for existing CA',
  'CREATING_INT_CA': 'Creating internal CA',
  'CREATING_EXT_CA': 'Uploading external CA',
  'UPLOADING_TO_HUB': 'Uploading CA to Hub',
  'DFSP_CA_PROPAGATED': 'DFSP CA configured successfully',
  'RECREATE_DFSP_CLIENT_CERT': 'Recreating client certificate',
  'CREATING_DFSP_CSR': 'Creating certificate signing request',
  'UPLOADING_DFSP_CSR': 'Uploading CSR to Hub',
  'FETCHING_DFSP_CLIENT_CERT': 'Fetching signed certificate',
  'COMPLETING_DFSP_CLIENT_CERT': 'Finalizing client certificate',
  'DFSP_CLIENT_CERT_CONFIGURED': 'Client certificate configured',
  'REQUESTING_NEW_DFSP_SERVER_CERT': 'Requesting new server certificate',
  'RENEWING_MANAGED_DFSP_SERVER_CERT': 'Renewing server certificate',
  'CREATING_DFSP_SERVER_CERT': 'Creating server certificate',
  'UPLOADING_DFSP_SERVER_CERT_TO_HUB': 'Uploading server cert to Hub',
  'DFSP_SERVER_CERT_CONFIGURED': 'Server certificate configured',
  'RESETTING_HUB_CLIENT_CERTS': 'Resetting Hub client certificates',
  'FETCHING_HUB_CSR': 'Fetching Hub CSR',
  'UPDATING_HUB_CSR': 'Updating Hub CSR',
  'SIGNING_HUB_CSR': 'Signing Hub CSR',
  'UPLOADING_HUB_CERT': 'Uploading Hub certificate',
  'COMPLETING_HUB_CLIENT_CERT': 'Finalizing Hub certificate',
  'HUB_CLIENT_CERT_SIGNED': 'Hub certificate signed successfully',
  'FETCHING_PEER_JWS': 'Fetching peer JWS keys',
  'COMPARING_PEER_JWS': 'Comparing peer JWS keys',
  'NOTIFYING_PEER_JWS': 'Notifying peer JWS changes',
  'COMPLETING_PEER_JWS': 'Finalizing peer JWS update',
  'PEER_JWS_CONFIGURED': 'Peer JWS keys configured',
  'NO_PEER_JWS_CHANGES': 'No peer JWS changes detected',
  'CREATING_DFSP_JWS': 'Creating DFSP JWS keys',
  'UPLOADING_DFSP_JWS_TO_HUB': 'Uploading JWS keys to Hub',
  'DFSP_JWS_PROPAGATED': 'DFSP JWS keys configured',
  'ENDPOINT_CONFIG_PROPAGATED': 'Endpoint configuration complete',
  'COMPARING_UPLOAD_PEER_JWS': 'Comparing peer JWS keys',
  'UPLOADING_PEER_JWS': 'Uploading peer JWS keys',
  'UPLOAD_PEER_JWS_COMPLETED': 'Peer JWS upload complete',
};
