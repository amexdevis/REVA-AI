/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { SystemControlService } from './system-control.service.js';
import {
  WebSearchResultItem,
  WebSearchResponse,
  WebOpenSearchResult,
  ToolExecutionResult,
} from '../types/tools.types.js';

export interface WebSearchOptions {
  query: string;
  limit?: number;
  purpose?: 'latest_news' | 'fact_check' | 'official_site' | 'documentation' | 'general';
  preferredDomain?: string;
  contextHint?: string;
}

export class WebIntelligenceService {
  private static instance: WebIntelligenceService | null = null;
  private ai: GoogleGenAI | null = null;

  private constructor() {
    this.initGeminiClient();
  }

  public static getInstance(): WebIntelligenceService {
    if (!WebIntelligenceService.instance) {
      WebIntelligenceService.instance = new WebIntelligenceService();
    }
    return WebIntelligenceService.instance;
  }

  private initGeminiClient(): void {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'MY_GEMINI_API_KEY') {
      try {
        this.ai = new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
      } catch (err) {
        console.warn('[REVA][WEB] Failed to initialize Gemini GenAI client for Google Search grounding:', err);
      }
    }
  }

  /**
   * Diagnostic summary for developers and health checks
   */
  public getDiagnosticStatus(): {
    configured: boolean;
    provider: string;
    hasApiKey: boolean;
    groundingReady: boolean;
    instructions?: string;
  } {
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');

    return {
      configured: hasGeminiKey,
      provider: 'gemini_google_search_grounding',
      hasApiKey: hasGeminiKey,
      groundingReady: hasGeminiKey,
      instructions: !hasGeminiKey
        ? 'Google Search Grounding requires GEMINI_API_KEY to be configured in your environment or Settings > Secrets.'
        : undefined,
    };
  }

  /**
   * Native Gemini Google Search Grounding:
   * Uses Gemini's built-in googleSearch tool for real-time web information.
   * Extracts source citations, verified URLs, and generates spoken conversational summaries.
   */
  public async searchWeb(options: WebSearchOptions): Promise<{
    success: boolean;
    data?: WebSearchResponse;
    error?: string;
  }> {
    const rawQuery = (options.query || '').trim();
    if (!rawQuery) {
      return {
        success: false,
        error: 'Please specify a search query or topic.',
      };
    }

    if (!this.ai) {
      this.initGeminiClient();
    }

    if (!this.ai || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      return {
        success: false,
        error: 'Gemini API key is not configured. Google Search Grounding requires GEMINI_API_KEY.',
      };
    }

    // Refine query with context if provided
    let refinedQuery = rawQuery;
    if (options.contextHint && !rawQuery.toLowerCase().includes(options.contextHint.toLowerCase())) {
      refinedQuery = `${rawQuery} ${options.contextHint}`.trim();
    }

    try {
      const isOfficialRequested =
        /\b(official|website of|home page|documentation|docs)\b/i.test(refinedQuery) ||
        options.purpose === 'official_site' ||
        options.purpose === 'documentation';

      const prompt = `You are REVA's web intelligence engine. Perform a live Google Search to answer: "${refinedQuery}".
Guidelines:
1. Provide a direct, up-to-date, factual answer grounded in real web sources.
2. If this asks for current events, latest news, today's scores, stock prices, or current status, use the most recent information.
3. If this asks for an official website or documentation, clearly identify the primary official URL.
4. Keep the factual answer clear and concise for speech synthesis. Do not make up facts.`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const responseText = response.text || '';
      const candidate = response.candidates?.[0] as any;
      const metadata = candidate?.groundingMetadata;
      const chunks = metadata?.groundingChunks || [];
      const searchQueries = metadata?.webSearchQueries || [];

      const webResults: WebSearchResultItem[] = [];

      // 1. Extract sources from grounding chunks
      for (const chunk of chunks) {
        if (chunk.web?.uri) {
          const uri = chunk.web.uri;
          const title = chunk.web.title || this.extractDomain(uri);
          const domain = this.extractDomain(uri);

          if (!webResults.some((r) => r.url === uri)) {
            webResults.push({
              title,
              url: uri,
              source: domain,
              snippet: title,
              isOfficial: isOfficialRequested && this.isLikelyOfficialDomain(domain, refinedQuery),
            });
          }
        }
      }

      // 2. Extract URLs from response text if chunks were empty
      if (webResults.length === 0) {
        const urlRegex = /https?:\/\/[^\s)"]+/g;
        const matches = responseText.match(urlRegex) || [];
        for (const uri of matches.slice(0, 5)) {
          const domain = this.extractDomain(uri);
          webResults.push({
            title: domain,
            url: uri,
            source: domain,
            snippet: `Source: ${domain}`,
            isOfficial: isOfficialRequested && this.isLikelyOfficialDomain(domain, refinedQuery),
          });
        }
      }

      // 3. Fallback entry if grounded text was generated without separate URL chunks
      if (webResults.length === 0 && responseText.trim().length > 0) {
        webResults.push({
          title: `Google Search: ${refinedQuery}`,
          url: `https://www.google.com/search?q=${encodeURIComponent(refinedQuery)}`,
          source: 'google.com',
          snippet: responseText.slice(0, 180),
          isOfficial: false,
        });
      }

      if (webResults.length === 0 && !responseText.trim()) {
        return {
          success: false,
          error: `No grounded search results found for "${refinedQuery}".`,
        };
      }

      // Sort official sources first if official requested
      if (isOfficialRequested) {
        webResults.sort((a, b) => (b.isOfficial ? 1 : 0) - (a.isOfficial ? 1 : 0));
      }

      const topSource = webResults[0] || {
        title: 'Google Grounded Search',
        url: 'https://www.google.com',
        source: 'Google Search',
        snippet: responseText,
      };

      const spokenSummary = this.createSpokenSummary(refinedQuery, responseText || topSource.snippet, topSource);

      return {
        success: true,
        data: {
          query: refinedQuery,
          provider: 'gemini_google_search_grounding',
          count: webResults.length,
          results: webResults.slice(0, options.limit || 5),
          topSource,
          spokenSummary,
          executedAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      console.error('[REVA][WEB] Gemini Google Search Grounding error:', err?.message || err);
      return {
        success: false,
        error: `Google Search grounding failed: ${err?.message || 'Unknown API error'}. Please check your GEMINI_API_KEY.`,
      };
    }
  }

  /**
   * Search and Open Website workflow:
   * 1. Grounded Search via Gemini Google Search
   * 2. Identify top official or verified result
   * 3. Validate URL safety (only http/https)
   * 4. Open via system browser launcher
   */
  public async searchAndOpenWebsite(
    query: string,
    preferredDomain?: string
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const cleanQuery = (query || '').trim();

    if (!cleanQuery) {
      return {
        success: false,
        tool: 'search_and_open_website',
        error: 'Please specify what website you would like me to find and open.',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // Perform Google Search Grounding
    const searchRes = await this.searchWeb({
      query: cleanQuery,
      purpose: 'official_site',
      preferredDomain,
      limit: 5,
    });

    if (!searchRes.success || !searchRes.data || searchRes.data.results.length === 0) {
      return {
        success: false,
        tool: 'search_and_open_website',
        error: searchRes.error || `I couldn't find a matching website for "${cleanQuery}".`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // Find the best official or top result
    const results = searchRes.data.results;
    let targetResult = results.find((r) => r.isOfficial) || results[0];

    if (preferredDomain) {
      const preferred = results.find((r) => r.source.includes(preferredDomain.toLowerCase()));
      if (preferred) {
        targetResult = preferred;
      }
    }

    const targetUrl = targetResult.url;

    // Validate URL scheme safety
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          success: false,
          tool: 'search_and_open_website',
          error: `Refusing to open unsafe URL scheme "${parsed.protocol}".`,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          permissionLevel: 'REVERSIBLE',
        };
      }
    } catch {
      return {
        success: false,
        tool: 'search_and_open_website',
        error: `Invalid URL found: ${targetUrl}`,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permissionLevel: 'REVERSIBLE',
      };
    }

    // Open via SystemControlService
    const sysControl = SystemControlService.getInstance();
    const openRes = await sysControl.openWebsite(targetUrl);

    const spokenSummary = openRes.success
      ? `Found ${targetResult.title} on ${targetResult.source} and opened it in your browser.`
      : `Found ${targetResult.title} (${targetUrl}), but couldn't launch the browser.`;

    const openDetails: WebOpenSearchResult = {
      success: openRes.success,
      query: cleanQuery,
      targetUrl,
      title: targetResult.title,
      source: targetResult.source,
      isOfficial: Boolean(targetResult.isOfficial),
      action: 'opened_website',
      spokenSummary,
      error: openRes.error,
    };

    return {
      success: openRes.success,
      tool: 'search_and_open_website',
      result: openDetails,
      error: openRes.error,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      permissionLevel: 'REVERSIBLE',
    };
  }

  // ==========================================
  // HELPER UTILITIES
  // ==========================================

  private extractDomain(urlStr: string): string {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return 'web';
    }
  }

  private isLikelyOfficialDomain(domain: string, query: string): boolean {
    const cleanQ = query.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanD = domain.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Common official domains
    if (cleanQ.includes('react') && domain.includes('react.dev')) return true;
    if (cleanQ.includes('google') && domain.includes('google.')) return true;
    if (cleanQ.includes('github') && domain.includes('github.com')) return true;
    if (cleanQ.includes('youtube') && domain.includes('youtube.com')) return true;
    if (cleanQ.includes('python') && domain.includes('python.org')) return true;
    if (cleanQ.includes('microsoft') && domain.includes('microsoft.com')) return true;
    if (cleanQ.includes('apple') && domain.includes('apple.com')) return true;

    return cleanD.includes(cleanQ) || cleanQ.includes(cleanD.split('.')[0]);
  }

  private createSpokenSummary(query: string, content: string, topSource: WebSearchResultItem): string {
    if (!content) {
      return `Found information from ${topSource.source}.`;
    }

    // Clean citations and long URLs from spoken summary
    const cleanContent = content
      .replace(/\[\d+\]/g, '')
      .replace(/https?:\/\/[^\s)]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const sentences = cleanContent.split(/(?<=[.?!])\s+/).filter((s) => s.length > 10);

    let summary = '';
    if (sentences.length > 0) {
      summary = sentences.slice(0, 2).join(' ');
    } else {
      summary = cleanContent.slice(0, 180);
    }

    // Add concise attribution if not already present
    if (topSource.source && !summary.toLowerCase().includes(topSource.source.toLowerCase())) {
      summary = `${summary} (Source: ${topSource.source})`;
    }

    return summary;
  }
}
