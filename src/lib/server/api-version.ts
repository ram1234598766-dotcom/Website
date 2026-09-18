/**
 * VantaOS API Version Information
 *
 * Centralized version metadata for the VantaOS Cloud IDE API.
 */

export const API_CURRENT_VERSION = '2.0.0';

export const API_SUPPORTED_VERSIONS: string[] = ['2.0.0', '1.5.0', '1.4.0'];

export const API_MINIMUM_CLIENT_VERSION = '1.4.0';

export interface DeprecationNotice {
  version: string;
  deprecatedIn: string;
  removalTarget: string;
  message: string;
  alternative?: string;
}

export const API_DEPRECATION_NOTICES: DeprecationNotice[] = [
  {
    version: '1.5.0',
    deprecatedIn: '2.0.0',
    removalTarget: '3.0.0',
    message: 'The /api/model-proxy endpoint is deprecated and will be removed in v3.0.0. Use /api/ai/generate instead.',
    alternative: '/api/ai/generate',
  },
];

export interface VersionInfo {
  current: string;
  supported: string[];
  minimumClient: string;
  deprecations: DeprecationNotice[];
}

export const apiVersion: VersionInfo = {
  current: API_CURRENT_VERSION,
  supported: API_SUPPORTED_VERSIONS,
  minimumClient: API_MINIMUM_CLIENT_VERSION,
  deprecations: API_DEPRECATION_NOTICES,
};
