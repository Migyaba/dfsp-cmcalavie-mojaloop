/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Custom Backend Authentication Manager

 --------------
 ******/
'use strict';

const axios = require('axios');

/**
 * Manages OAuth/JWT authentication for backend requests
 * Handles token acquisition and automatic refresh
 */
class AuthManager {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger.push({ component: 'AuthManager' });
        
        this.authType = config.backendAuthType;
        this.loginUrl = config.backendAuthLoginUrl;
        this.username = config.backendAuthUsername;
        this.password = config.backendAuthPassword;
        this.tenant = config.backendAuthTenant;
        this.tokenRefreshInterval = config.backendAuthTokenRefreshInterval || 3600;
        
        // Static token for bearer/apikey auth
        this.staticToken = config.backendAuthToken;
        this.apiKeyHeader = config.backendAuthHeader;
        this.apiKeyValue = config.backendAuthValue;
        
        // OAuth token management
        this.currentToken = null;
        this.tokenExpiresAt = null;
        this.refreshTimer = null;
        
        // Initialize authentication if OAuth
        if (this.authType === 'oauth' && this.loginUrl) {
            this._initializeAuth();
        }
    }

    /**
     * Initialize OAuth authentication
     */
    async _initializeAuth() {
        try {
            await this.refreshToken();
            this.logger.info('Backend authentication initialized successfully');
        } catch (err) {
            this.logger.error('Failed to initialize backend authentication', { err });
        }
    }

    /**
     * Acquire a new token from the backend
     */
    async refreshToken() {
        if (this.authType !== 'oauth') {
            return;
        }

        try {
            this.logger.info('Acquiring new authentication token from backend');
            
            const response = await axios.post(this.loginUrl, {
                username: this.username,
                password: this.password,
                tenant: this.tenant
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            // Extract token from response
            // Support multiple token field names from different backends
            const token = response.data.access || response.data.token || response.data.access_token || response.data.accessToken;
            
            if (!token) {
                this.logger.error('No token found in authentication response. Response data:', response.data);
                throw new Error('No token found in authentication response');
            }

            this.currentToken = token;
            
            // Try to extract expiration from JWT token
            let expiresIn = this.tokenRefreshInterval;
            try {
                // Decode JWT to get expiration (format: header.payload.signature)
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                    if (payload.exp) {
                        // JWT exp is in seconds since epoch
                        const expiresAt = payload.exp * 1000; // Convert to milliseconds
                        const now = Date.now();
                        expiresIn = Math.floor((expiresAt - now) / 1000); // Convert to seconds
                        this.logger.info('Extracted expiration from JWT token', {
                            expiresAt: new Date(expiresAt).toISOString(),
                            expiresInSeconds: expiresIn
                        });
                    }
                }
            } catch (jwtErr) {
                this.logger.warn('Could not decode JWT token, using default refresh interval', {
                    error: jwtErr.message
                });
            }
            
            // Fallback to response fields if JWT decode failed
            if (!expiresIn || expiresIn <= 0) {
                expiresIn = response.data.expires_in || response.data.expiresIn || this.tokenRefreshInterval;
            }
            
            // Calculate expiry time
            this.tokenExpiresAt = Date.now() + (expiresIn * 1000);
            
            this.logger.info('Authentication token acquired successfully', {
                expiresIn: expiresIn,
                expiresAt: new Date(this.tokenExpiresAt).toISOString()
            });

            // Schedule token refresh (refresh 5 minutes before expiry)
            this._scheduleTokenRefresh(expiresIn - 300);

        } catch (err) {
            this.logger.error('Failed to acquire authentication token', {
                error: err.message,
                loginUrl: this.loginUrl,
                username: this.username
            });
            
            // Retry after 60 seconds on failure
            this._scheduleTokenRefresh(60);
            throw err;
        }
    }

    /**
     * Schedule automatic token refresh
     */
    _scheduleTokenRefresh(delaySeconds) {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        const delay = Math.max(delaySeconds, 10) * 1000; // Minimum 10 seconds
        
        this.refreshTimer = setTimeout(async () => {
            try {
                await this.refreshToken();
            } catch (err) {
                this.logger.error('Scheduled token refresh failed', { err });
            }
        }, delay);

        this.logger.debug(`Token refresh scheduled in ${delaySeconds} seconds`);
    }

    /**
     * Get current authentication token
     * Automatically refreshes if expired
     */
    async getToken() {
        if (this.authType === 'oauth') {
            // Check if token is expired or about to expire (within 1 minute)
            if (!this.currentToken || (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt - 60000)) {
                this.logger.warn('Token expired or missing, refreshing...');
                await this.refreshToken();
            }
            return this.currentToken;
        }
        
        // For static bearer token
        if (this.authType === 'bearer') {
            return this.staticToken;
        }
        
        return null;
    }

    /**
     * Build authentication headers for requests
     */
    async buildAuthHeaders() {
        const headers = {};

        try {
            if (this.authType === 'oauth' || this.authType === 'bearer') {
                const token = await this.getToken();
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                    this.logger.isDebugEnabled && this.logger.debug('Added Bearer token to headers');
                } else {
                    this.logger.isWarnEnabled && this.logger.warn('No token available for authentication');
                }
            } else if (this.authType === 'basic' && this.username && this.password) {
                const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
                headers['Authorization'] = `Basic ${credentials}`;
                this.logger.isDebugEnabled && this.logger.debug('Added Basic auth to headers');
            } else if (this.authType === 'apikey' && this.apiKeyHeader && this.apiKeyValue) {
                headers[this.apiKeyHeader] = this.apiKeyValue;
                this.logger.isDebugEnabled && this.logger.debug('Added API key to headers');
            } else if (this.authType === 'none' || !this.authType) {
                this.logger.isDebugEnabled && this.logger.debug('No authentication configured');
            } else {
                this.logger.isWarnEnabled && this.logger.push({ authType: this.authType }).warn('Unknown auth type');
            }
        } catch (err) {
            this.logger.isErrorEnabled && this.logger.push({ err }).error('Error building auth headers');
        }

        return headers;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
}

module.exports = AuthManager;
