/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HealthResponse, ConfigStatusResponse } from '../types/index.js';

export class ApiClient {
  /**
   * Fetches backend health status from /api/health.
   */
  public static async getHealth(): Promise<HealthResponse> {
    const response = await fetch('/api/health', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Health check failed with status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Fetches Gemini configuration status from /api/config/status.
   */
  public static async getConfigStatus(): Promise<ConfigStatusResponse> {
    const response = await fetch('/api/config/status', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Config status check failed with status: ${response.status}`);
    }

    return response.json();
  }
}
