/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Service to verify and manage Gemini API configuration safely on the server.
 * Note: Never log, expose, or return the actual API key to the client.
 */
export class GeminiService {
  /**
   * Checks whether the GEMINI_API_KEY environment variable is configured.
   */
  public static isConfigured(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return typeof key === 'string' && key.trim().length > 0 && key !== 'MY_GEMINI_API_KEY';
  }

  /**
   * Safe status summary for telemetry and health monitoring.
   */
  public static getStatusSummary() {
    return {
      geminiConfigured: this.isConfigured(),
    };
  }
}
