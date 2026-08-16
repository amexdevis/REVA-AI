/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemoryService } from './memory.service.js';
import { EmbeddingService } from './embedding.service.js';
import { ConsolidationReport, MemoryRecord } from '../types/voice.types.js';

export class MemoryConsolidationService {
  private static instance: MemoryConsolidationService | null = null;
  private memoryService: MemoryService;
  private embeddingService: EmbeddingService;

  private constructor() {
    this.memoryService = MemoryService.getInstance();
    this.embeddingService = EmbeddingService.getInstance();
  }

  public static getInstance(): MemoryConsolidationService {
    if (!MemoryConsolidationService.instance) {
      MemoryConsolidationService.instance = new MemoryConsolidationService();
    }
    return MemoryConsolidationService.instance;
  }

  /**
   * Run full consolidation cycle across all active memories:
   * 1. Merges duplicates / near-synonyms into single reinforced entries.
   * 2. Resolves contradictions (marks older contradicting memories as superseded).
   * 3. Syncs User Profile & Project memory stores.
   */
  public async consolidateMemories(): Promise<ConsolidationReport> {
    const report: ConsolidationReport = {
      mergedCount: 0,
      supersededCount: 0,
      reinforcedCount: 0,
      episodicCreatedCount: 0,
      timestamp: new Date().toISOString(),
    };

    const memories = this.memoryService.getAllMemories(true);
    if (memories.length <= 1) {
      await this.memoryService.syncUserProfile();
      return report;
    }

    // Embeddings for all active memories
    const memoryEmbeddings: Array<{ mem: MemoryRecord; vec: number[] }> = [];
    for (const mem of memories) {
      const vec = await this.embeddingService.getEmbedding(mem.content);
      memoryEmbeddings.push({ mem, vec });
    }

    const processedIds = new Set<string>();

    for (let i = 0; i < memoryEmbeddings.length; i++) {
      const itemA = memoryEmbeddings[i];
      if (processedIds.has(itemA.mem.id)) continue;

      for (let j = i + 1; j < memoryEmbeddings.length; j++) {
        const itemB = memoryEmbeddings[j];
        if (processedIds.has(itemB.mem.id)) continue;

        const similarity = this.embeddingService.cosineSimilarity(itemA.vec, itemB.vec);
        const contradiction = this.detectContradiction(itemA.mem.content, itemB.mem.content, itemA.mem.category, itemB.mem.category);

        if (contradiction) {
          // Identify which is newer
          const dateA = new Date(itemA.mem.updated_at).getTime();
          const dateB = new Date(itemB.mem.updated_at).getTime();
          const newer = dateA >= dateB ? itemA.mem : itemB.mem;
          const older = dateA >= dateB ? itemB.mem : itemA.mem;

          // Supersede older memory
          this.memoryService.updateMemory(older.id, {
            active: false,
          });
          this.memoryService.setSupersededBy(older.id, newer.id);

          // Reinforce newer memory
          this.memoryService.updateMemory(newer.id, {
            confidence: Math.min(1.0, newer.confidence + 0.05),
            importance: Math.max(newer.importance, older.importance),
          });

          processedIds.add(older.id);
          report.supersededCount++;
          console.log(`[REVA][CONSOLIDATION] Superseded contradiction: "${older.content}" -> "${newer.content}"`);
        } else if (similarity > 0.82) {
          // Merge similar or duplicate memories
          const dateA = new Date(itemA.mem.updated_at).getTime();
          const dateB = new Date(itemB.mem.updated_at).getTime();
          const primary = dateA >= dateB ? itemA.mem : itemB.mem;
          const secondary = dateA >= dateB ? itemB.mem : itemA.mem;

          // Choose most detailed content or blend
          const mergedContent = primary.content.length >= secondary.content.length ? primary.content : secondary.content;
          const mergedConfidence = Math.min(1.0, Math.max(primary.confidence, secondary.confidence) + 0.05);
          const mergedImportance = Math.min(1.0, Math.max(primary.importance, secondary.importance));

          this.memoryService.updateMemory(primary.id, {
            content: mergedContent,
            confidence: mergedConfidence,
            importance: mergedImportance,
          });

          this.memoryService.updateMemory(secondary.id, {
            active: false,
          });
          this.memoryService.setSupersededBy(secondary.id, primary.id);

          processedIds.add(secondary.id);
          report.mergedCount++;
          report.reinforcedCount++;
          console.log(`[REVA][CONSOLIDATION] Merged duplicate memories: "${secondary.content}" into "${primary.content}"`);
        }
      }
    }

    // Refresh structured User Profile from active semantic memories
    await this.memoryService.syncUserProfile();

    return report;
  }

  /**
   * Check if two statements directly contradict each other on a subject
   * e.g., "favorite color is blue" vs "prefers purple"
   */
  private detectContradiction(textA: string, textB: string, catA: string, catB: string): boolean {
    if (catA !== catB && (catA !== 'PREFERENCE' || catB !== 'PREFERENCE')) return false;

    const lowerA = textA.toLowerCase();
    const lowerB = textB.toLowerCase();

    // Color preferences
    const colors = ['blue', 'purple', 'violet', 'green', 'red', 'yellow', 'orange', 'pink', 'black', 'white', 'dark', 'light'];
    const colorsInA = colors.filter((c) => lowerA.includes(c));
    const colorsInB = colors.filter((c) => lowerB.includes(c));

    if (
      colorsInA.length > 0 &&
      colorsInB.length > 0 &&
      !colorsInA.some((c) => colorsInB.includes(c)) &&
      (lowerA.includes('theme') || lowerA.includes('color') || lowerA.includes('interface') || lowerA.includes('prefer') || lowerA.includes('favorite')) &&
      (lowerB.includes('theme') || lowerB.includes('color') || lowerB.includes('interface') || lowerB.includes('prefer') || lowerB.includes('favorite'))
    ) {
      return true;
    }

    // Tone / Mode preferences
    if (
      (lowerA.includes('be brief') || lowerA.includes('concise')) &&
      (lowerB.includes('be detailed') || lowerB.includes('elaborate'))
    ) {
      return true;
    }

    return false;
  }
}
