/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import {
  MemoryCategory,
  MemoryRecord,
  EpisodicMemoryRecord,
  ProjectMemoryRecord,
  UserProfile,
} from '../types/voice.types.js';
import { EmbeddingService } from './embedding.service.js';
import { WorkingMemoryService } from './working-memory.service.js';

export class MemoryService {
  private static instance: MemoryService | null = null;
  private db: Database.Database;
  private embeddingService: EmbeddingService;
  private workingMemory: WorkingMemoryService;
  private autoMemoryEnabled = true;

  private constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'reva-memory.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.embeddingService = EmbeddingService.getInstance();
    this.workingMemory = WorkingMemoryService.getInstance();

    this.initAndMigrateTables();
  }

  public static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  public getDb(): Database.Database {
    return this.db;
  }

  public isAutoMemoryEnabled(): boolean {
    return this.autoMemoryEnabled;
  }

  public setAutoMemoryEnabled(enabled: boolean): void {
    this.autoMemoryEnabled = enabled;
  }

  /**
   * Safe migration ensuring Step 4 databases upgrade seamlessly without data loss.
   */
  private initAndMigrateTables(): void {
    // 1. Semantic Memories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        importance REAL NOT NULL DEFAULT 0.5,
        confidence REAL NOT NULL DEFAULT 0.9,
        source TEXT NOT NULL DEFAULT 'conversation',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_accessed_at TEXT,
        access_count INTEGER NOT NULL DEFAULT 0,
        superseded_by TEXT,
        project_id TEXT,
        embedding_json TEXT
      );
    `);

    // Safely add any new columns to existing databases if missing
    const columns = this.db.pragma('table_info(memories)') as Array<{ name: string }>;
    const colNames = new Set(columns.map((c) => c.name));

    if (!colNames.has('last_accessed_at')) {
      this.db.exec('ALTER TABLE memories ADD COLUMN last_accessed_at TEXT;');
    }
    if (!colNames.has('access_count')) {
      this.db.exec('ALTER TABLE memories ADD COLUMN access_count INTEGER NOT NULL DEFAULT 0;');
    }
    if (!colNames.has('superseded_by')) {
      this.db.exec('ALTER TABLE memories ADD COLUMN superseded_by TEXT;');
    }
    if (!colNames.has('project_id')) {
      this.db.exec('ALTER TABLE memories ADD COLUMN project_id TEXT;');
    }
    if (!colNames.has('embedding_json')) {
      this.db.exec('ALTER TABLE memories ADD COLUMN embedding_json TEXT;');
    }

    // 2. Episodic Memories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodic_memories (
        id TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        topic TEXT NOT NULL,
        date TEXT NOT NULL,
        importance REAL NOT NULL DEFAULT 0.6,
        confidence REAL NOT NULL DEFAULT 0.9,
        related_project TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // 3. Projects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        goals_json TEXT NOT NULL DEFAULT '[]',
        decisions_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 4. User Profile table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id TEXT PRIMARY KEY,
        name TEXT,
        preferences_json TEXT NOT NULL DEFAULT '[]',
        interests_json TEXT NOT NULL DEFAULT '[]',
        projects_json TEXT NOT NULL DEFAULT '[]',
        goals_json TEXT NOT NULL DEFAULT '[]',
        communication_prefs_json TEXT NOT NULL DEFAULT '[]',
        ui_prefs_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );
    `);

    // 5. Setup FTS5 for ultra-fast full-text keyword ranking
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
          id UNINDEXED,
          category,
          content
        );
      `);

      // Re-index FTS if empty
      const ftsCount = (this.db.prepare('SELECT count(*) as count FROM memories_fts').get() as any)?.count || 0;
      const memCount = (this.db.prepare('SELECT count(*) as count FROM memories').get() as any)?.count || 0;
      if (ftsCount < memCount) {
        this.db.exec(`
          DELETE FROM memories_fts;
          INSERT INTO memories_fts (id, category, content)
          SELECT id, category, content FROM memories WHERE active = 1;
        `);
      }
    } catch (err) {
      console.warn('[REVA][MEMORY] FTS5 initialization note:', err);
    }

    // Indices
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
      CREATE INDEX IF NOT EXISTS idx_memories_active ON memories(active);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
      CREATE INDEX IF NOT EXISTS idx_episodic_date ON episodic_memories(date);
    `);
  }

  /**
   * Sanitizes text to prevent storing passwords, secret tokens, or API keys.
   */
  public sanitizeContent(text: string): string {
    return text
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
      .replace(/sk-[a-zA-Z0-9]{32,}/g, '[REDACTED_SECRET]')
      .replace(/bearer\s+[a-zA-Z0-9\-_.]+/gi, 'Bearer [REDACTED_TOKEN]')
      .replace(/password\s*[:=]\s*\S+/gi, 'password: [REDACTED]');
  }

  /**
   * Save or reinforce a semantic memory
   */
  public async saveMemory(params: {
    category?: MemoryCategory;
    content: string;
    importance?: number;
    confidence?: number;
    source?: string;
    project_id?: string;
  }): Promise<MemoryRecord> {
    const sanitized = this.sanitizeContent(params.content.trim());
    const category: MemoryCategory = params.category || 'PREFERENCE';
    const importance = Math.max(0.0, Math.min(1.0, params.importance ?? 0.8));
    const confidence = Math.max(0.0, Math.min(1.0, params.confidence ?? 0.9));
    const source = params.source || 'conversation';
    const now = new Date().toISOString();

    // Check for existing similar memory to reinforce instead of duplicating
    const similar = await this.findSimilarMemory(sanitized, category);

    if (similar) {
      // Reinforce existing
      const newConfidence = Math.min(1.0, similar.confidence + 0.05);
      const newImportance = Math.max(similar.importance, importance);
      const newAccessCount = (similar.access_count || 0) + 1;

      const updateStmt = this.db.prepare(`
        UPDATE memories
        SET content = ?, category = ?, importance = ?, confidence = ?, updated_at = ?, last_accessed_at = ?, access_count = ?, active = 1
        WHERE id = ?
      `);
      updateStmt.run(sanitized, category, newImportance, newConfidence, now, now, newAccessCount, similar.id);

      this.updateFts(similar.id, category, sanitized);
      this.workingMemory.addRecentPreference(sanitized);

      return {
        ...similar,
        content: sanitized,
        category,
        importance: newImportance,
        confidence: newConfidence,
        updated_at: now,
        last_accessed_at: now,
        access_count: newAccessCount,
        active: true,
      };
    }

    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const embedding = await this.embeddingService.getEmbedding(sanitized);
    const embeddingJson = JSON.stringify(embedding);

    const insertStmt = this.db.prepare(`
      INSERT INTO memories (id, category, content, importance, confidence, source, active, created_at, updated_at, last_accessed_at, access_count, project_id, embedding_json)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1, ?, ?)
    `);

    insertStmt.run(id, category, sanitized, importance, confidence, source, now, now, now, params.project_id || null, embeddingJson);

    this.insertFts(id, category, sanitized);
    this.workingMemory.addRecentPreference(sanitized);

    return {
      id,
      category,
      content: sanitized,
      importance,
      confidence,
      source,
      active: true,
      created_at: now,
      updated_at: now,
      last_accessed_at: now,
      access_count: 1,
      project_id: params.project_id || null,
    };
  }

  private insertFts(id: string, category: string, content: string): void {
    try {
      this.db.prepare('INSERT INTO memories_fts (id, category, content) VALUES (?, ?, ?)').run(id, category, content);
    } catch (_) {}
  }

  private updateFts(id: string, category: string, content: string): void {
    try {
      this.db.prepare('DELETE FROM memories_fts WHERE id = ?').run(id);
      this.db.prepare('INSERT INTO memories_fts (id, category, content) VALUES (?, ?, ?)').run(id, category, content);
    } catch (_) {}
  }

  /**
   * Find a memory that matches semantically
   */
  private async findSimilarMemory(content: string, category: MemoryCategory): Promise<MemoryRecord | null> {
    const memories = this.getAllMemories(true);
    if (memories.length === 0) return null;

    const targetVec = await this.embeddingService.getEmbedding(content);

    for (const mem of memories) {
      if (mem.category !== category && category !== 'PREFERENCE' && mem.category !== 'PREFERENCE') continue;
      const memVec = mem.embedding_json ? JSON.parse(mem.embedding_json) : await this.embeddingService.getEmbedding(mem.content);
      const similarity = this.embeddingService.cosineSimilarity(targetVec, memVec);
      if (similarity > 0.88) {
        return mem;
      }
    }
    return null;
  }

  public setSupersededBy(id: string, supersedingId: string): void {
    this.db.prepare('UPDATE memories SET superseded_by = ?, active = 0 WHERE id = ?').run(supersedingId, id);
    try {
      this.db.prepare('DELETE FROM memories_fts WHERE id = ?').run(id);
    } catch (_) {}
  }

  /**
   * Retrieve all memories with optional filters
   */
  public getAllMemories(activeOnly = true): (MemoryRecord & { embedding_json?: string })[] {
    const query = activeOnly
      ? 'SELECT * FROM memories WHERE active = 1 ORDER BY importance DESC, updated_at DESC'
      : 'SELECT * FROM memories ORDER BY updated_at DESC';

    const rows = this.db.prepare(query).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      category: r.category as MemoryCategory,
      content: r.content,
      importance: r.importance,
      confidence: r.confidence,
      source: r.source,
      active: r.active === 1,
      created_at: r.created_at,
      updated_at: r.updated_at,
      last_accessed_at: r.last_accessed_at,
      access_count: r.access_count,
      superseded_by: r.superseded_by,
      project_id: r.project_id,
      embedding_json: r.embedding_json,
    }));
  }

  private lastRetrievalDiagnostics: {
    lastSearchStatus: 'FOUND' | 'NOT_FOUND' | 'IDLE';
    memoriesRetrieved: number;
    topMemoryCategories: string[];
    lastSearchTopic?: string;
    timestamp?: string;
  } = {
    lastSearchStatus: 'IDLE',
    memoriesRetrieved: 0,
    topMemoryCategories: [],
  };

  public getRetrievalDiagnostics() {
    return { ...this.lastRetrievalDiagnostics };
  }

  /**
   * Smart Hybrid Memory Search:
   * Rank = (0.35 * semanticSim) + (0.25 * keywordScore) + (0.15 * importance) + (0.10 * recency) + (0.10 * confidence) + (0.05 * topicMatch)
   * Resolves contradictions by preferring newer, active, higher-confidence memories.
   * Returns top 3-8 relevant memories (default limit: 6).
   */
  public async searchMemories(
    query: string,
    options?: { limit?: number; minScore?: number; category?: MemoryCategory; topic?: string }
  ): Promise<MemoryRecord[]> {
    const limit = options?.limit || 6;
    const active = this.getAllMemories(true);
    if (active.length === 0) {
      this.lastRetrievalDiagnostics = {
        lastSearchStatus: 'NOT_FOUND',
        memoriesRetrieved: 0,
        topMemoryCategories: [],
        lastSearchTopic: options?.topic || query || 'none',
        timestamp: new Date().toISOString(),
      };
      return [];
    }

    if (!query || !query.trim()) {
      const defaultSlice = active.slice(0, Math.min(limit, 8));
      this.lastRetrievalDiagnostics = {
        lastSearchStatus: defaultSlice.length > 0 ? 'FOUND' : 'NOT_FOUND',
        memoriesRetrieved: defaultSlice.length,
        topMemoryCategories: Array.from(new Set(defaultSlice.map((m) => m.category))),
        lastSearchTopic: 'recent_general',
        timestamp: new Date().toISOString(),
      };
      return defaultSlice;
    }

    const trimmedQuery = query.trim();
    const queryVec = await this.embeddingService.getEmbedding(trimmedQuery);
    const queryKeywords = this.extractKeywords(trimmedQuery);

    // FTS Keyword matches
    const ftsMatchedIds = new Set<string>();
    if (queryKeywords.length > 0) {
      try {
        const ftsRows = this.db.prepare(`
          SELECT id, rank FROM memories_fts WHERE memories_fts MATCH ? ORDER BY rank LIMIT 25
        `).all(queryKeywords.join(' OR ')) as Array<{ id: string; rank: number }>;
        ftsRows.forEach((r) => ftsMatchedIds.add(r.id));
      } catch (_) {}
    }

    const now = Date.now();
    const currentTopic = (options?.topic || this.workingMemory.getState().currentTopic || '').toLowerCase();

    const scored = await Promise.all(
      active.map(async (mem) => {
        if (options?.category && mem.category !== options.category) {
          return { mem, score: -1, similarity: 0 };
        }

        // 1. Semantic vector similarity (0.0 to 1.0)
        let memVec: number[];
        if (mem.embedding_json) {
          try {
            memVec = JSON.parse(mem.embedding_json);
          } catch {
            memVec = await this.embeddingService.getEmbedding(mem.content);
          }
        } else {
          memVec = await this.embeddingService.getEmbedding(mem.content);
        }
        const semanticSim = this.embeddingService.cosineSimilarity(queryVec, memVec);

        // 2. Keyword relevance with exact substring & token overlap
        const memKeywords = this.extractKeywords(mem.content);
        const memContentLower = mem.content.toLowerCase();
        const matches = queryKeywords.filter((k) => memKeywords.includes(k) || memContentLower.includes(k)).length;
        
        let keywordScore = queryKeywords.length > 0 ? matches / queryKeywords.length : 0.0;
        if (ftsMatchedIds.has(mem.id)) {
          keywordScore = Math.min(1.0, keywordScore + 0.3);
        }
        // Direct phrase match bonus
        if (memContentLower.includes(trimmedQuery.toLowerCase())) {
          keywordScore = Math.min(1.0, keywordScore + 0.4);
        }

        // 3. Recency factor (1.0 for recent updates, decaying gracefully over 30 days)
        const updatedTime = new Date(mem.updated_at).getTime();
        const ageDays = Math.max(0, (now - updatedTime) / (1000 * 60 * 60 * 24));
        const recencyScore = Math.max(0.3, 1.0 - (ageDays / 30) * 0.5);

        // 4. Topic boost
        let topicMatch = 0.0;
        if (currentTopic && currentTopic !== 'general conversation' && currentTopic !== 'fresh session') {
          if (memContentLower.includes(currentTopic) || (mem.project_id && currentTopic.includes(mem.project_id.toLowerCase()))) {
            topicMatch = 1.0;
          }
        }

        // Hybrid Weighted Formula:
        // Rank = 0.35 * semanticSim + 0.25 * keywordScore + 0.15 * importance + 0.10 * recency + 0.10 * confidence + 0.05 * topicMatch
        const finalScore =
          0.35 * semanticSim +
          0.25 * keywordScore +
          0.15 * (mem.importance ?? 0.8) +
          0.10 * recencyScore +
          0.10 * (mem.confidence ?? 0.9) +
          0.05 * topicMatch;

        return { mem, score: finalScore, similarity: semanticSim };
      })
    );

    scored.sort((a, b) => b.score - a.score);

    // Keep top results with a reasonable relevance threshold
    const minScore = options?.minScore ?? 0.22;
    const topResults = scored.filter((s) => s.score >= minScore).slice(0, Math.min(limit, 8));

    // Update access statistics for retrieved memories
    const nowIso = new Date().toISOString();
    const updateAccessStmt = this.db.prepare(`
      UPDATE memories
      SET last_accessed_at = ?, access_count = access_count + 1
      WHERE id = ?
    `);

    for (const res of topResults) {
      try {
        updateAccessStmt.run(nowIso, res.mem.id);
      } catch (_) {}
      res.mem.last_accessed_at = nowIso;
      res.mem.access_count = (res.mem.access_count || 0) + 1;
      res.mem.score = +(res.score.toFixed(3));
      res.mem.similarity = +(res.similarity.toFixed(3));
    }

    const results = topResults.map((s) => s.mem);

    this.lastRetrievalDiagnostics = {
      lastSearchStatus: results.length > 0 ? 'FOUND' : 'NOT_FOUND',
      memoriesRetrieved: results.length,
      topMemoryCategories: Array.from(new Set(results.map((m) => m.category))),
      lastSearchTopic: options?.topic || query.substring(0, 30),
      timestamp: nowIso,
    };

    return results;
  }

  /**
   * Fast relevant memory retrieval for voice turn context (returns 3-8 memories)
   */
  public async getRelevantMemories(query: string, limit = 6): Promise<MemoryRecord[]> {
    return this.searchMemories(query, { limit: Math.min(Math.max(limit, 3), 8) });
  }

  public updateMemory(
    id: string,
    updates: Partial<Pick<MemoryRecord, 'content' | 'category' | 'importance' | 'confidence' | 'active'>>
  ): MemoryRecord | null {
    const existing = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as any;
    if (!existing) return null;

    const content = updates.content !== undefined ? this.sanitizeContent(updates.content.trim()) : existing.content;
    const category = updates.category !== undefined ? updates.category : existing.category;
    const importance = updates.importance !== undefined ? updates.importance : existing.importance;
    const confidence = updates.confidence !== undefined ? updates.confidence : existing.confidence;
    const active = updates.active !== undefined ? (updates.active ? 1 : 0) : existing.active;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE memories
      SET content = ?, category = ?, importance = ?, confidence = ?, active = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(content, category, importance, confidence, active, now, id);

    if (active === 1) {
      this.updateFts(id, category, content);
    } else {
      try {
        this.db.prepare('DELETE FROM memories_fts WHERE id = ?').run(id);
      } catch (_) {}
    }

    return {
      id,
      category,
      content,
      importance,
      confidence,
      source: existing.source,
      active: active === 1,
      created_at: existing.created_at,
      updated_at: now,
      last_accessed_at: existing.last_accessed_at,
      access_count: existing.access_count,
    };
  }

  public deleteMemory(id: string): boolean {
    const result = this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    try {
      this.db.prepare('DELETE FROM memories_fts WHERE id = ?').run(id);
    } catch (_) {}
    return result.changes > 0;
  }

  public clearAllMemories(): number {
    const result = this.db.prepare('DELETE FROM memories').run();
    try {
      this.db.prepare('DELETE FROM memories_fts').run();
    } catch (_) {}
    this.db.prepare('DELETE FROM episodic_memories').run();
    this.db.prepare('DELETE FROM user_profile').run();
    this.workingMemory.clear();
    return result.changes;
  }

  // --- Episodic Memories ---
  public saveEpisodicMemory(params: {
    summary: string;
    topic: string;
    importance?: number;
    confidence?: number;
    related_project?: string;
    date?: string;
  }): EpisodicMemoryRecord {
    const id = `epi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const date = params.date || new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    const importance = params.importance ?? 0.7;
    const confidence = params.confidence ?? 0.9;

    const stmt = this.db.prepare(`
      INSERT INTO episodic_memories (id, summary, topic, date, importance, confidence, related_project, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, params.summary.trim(), params.topic.trim(), date, importance, confidence, params.related_project || null, now);

    return {
      id,
      summary: params.summary.trim(),
      topic: params.topic.trim(),
      date,
      importance,
      confidence,
      related_project: params.related_project || null,
      created_at: now,
    };
  }

  public getAllEpisodicMemories(limit = 20): EpisodicMemoryRecord[] {
    const rows = this.db.prepare('SELECT * FROM episodic_memories ORDER BY date DESC, created_at DESC LIMIT ?').all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      summary: r.summary,
      topic: r.topic,
      date: r.date,
      importance: r.importance,
      confidence: r.confidence,
      related_project: r.related_project,
      created_at: r.created_at,
    }));
  }

  public deleteEpisodicMemory(id: string): boolean {
    const res = this.db.prepare('DELETE FROM episodic_memories WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // --- Project Memories ---
  public saveProject(params: {
    id?: string;
    name: string;
    description: string;
    goals?: string[];
    decisions?: string[];
    status?: 'active' | 'completed' | 'paused';
  }): ProjectMemoryRecord {
    const now = new Date().toISOString();
    const id = params.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const goalsJson = JSON.stringify(params.goals || []);
    const decisionsJson = JSON.stringify(params.decisions || []);
    const status = params.status || 'active';

    const existing = this.db.prepare('SELECT * FROM projects WHERE name = ? OR id = ?').get(params.name, id) as any;

    if (existing) {
      this.db.prepare(`
        UPDATE projects
        SET description = ?, goals_json = ?, decisions_json = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(params.description, goalsJson, decisionsJson, status, now, existing.id);

      return {
        id: existing.id,
        name: existing.name,
        description: params.description,
        goals: params.goals || [],
        decisions: params.decisions || [],
        status,
        created_at: existing.created_at,
        updated_at: now,
      };
    }

    this.db.prepare(`
      INSERT INTO projects (id, name, description, goals_json, decisions_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.name, params.description, goalsJson, decisionsJson, status, now, now);

    return {
      id,
      name: params.name,
      description: params.description,
      goals: params.goals || [],
      decisions: params.decisions || [],
      status,
      created_at: now,
      updated_at: now,
    };
  }

  public getAllProjects(): ProjectMemoryRecord[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      goals: JSON.parse(r.goals_json || '[]'),
      decisions: JSON.parse(r.decisions_json || '[]'),
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  public deleteProject(id: string): boolean {
    const res = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // --- User Profile ---
  public getUserProfile(): UserProfile {
    const row = this.db.prepare('SELECT * FROM user_profile WHERE id = ?').get('main') as any;
    if (!row) {
      return {
        preferences: [],
        interests: [],
        projects: [],
        goals: [],
        communication_preferences: [],
        ui_preferences: [],
        updated_at: new Date().toISOString(),
      };
    }

    return {
      name: row.name || undefined,
      preferences: JSON.parse(row.preferences_json || '[]'),
      interests: JSON.parse(row.interests_json || '[]'),
      projects: JSON.parse(row.projects_json || '[]'),
      goals: JSON.parse(row.goals_json || '[]'),
      communication_preferences: JSON.parse(row.communication_prefs_json || '[]'),
      ui_preferences: JSON.parse(row.ui_prefs_json || '[]'),
      updated_at: row.updated_at,
    };
  }

  public async syncUserProfile(): Promise<UserProfile> {
    const memories = this.getAllMemories(true);
    const prefs = new Set<string>();
    const interests = new Set<string>();
    const projects = new Set<string>();
    const goals = new Set<string>();
    const commPrefs = new Set<string>();
    const uiPrefs = new Set<string>();

    for (const mem of memories) {
      const lower = mem.content.toLowerCase();
      if (mem.category === 'PREFERENCE') {
        prefs.add(mem.content);
        if (lower.includes('interface') || lower.includes('color') || lower.includes('theme') || lower.includes('ui')) {
          uiPrefs.add(mem.content);
        }
        if (lower.includes('speak') || lower.includes('concise') || lower.includes('brief') || lower.includes('tone')) {
          commPrefs.add(mem.content);
        }
      } else if (mem.category === 'INTEREST') {
        interests.add(mem.content);
      } else if (mem.category === 'PROJECT') {
        projects.add(mem.content);
      } else if (mem.category === 'GOAL') {
        goals.add(mem.content);
      }
    }

    const profile: UserProfile = {
      preferences: Array.from(prefs),
      interests: Array.from(interests),
      projects: Array.from(projects),
      goals: Array.from(goals),
      communication_preferences: Array.from(commPrefs),
      ui_preferences: Array.from(uiPrefs),
      updated_at: new Date().toISOString(),
    };

    this.db.prepare(`
      INSERT INTO user_profile (id, preferences_json, interests_json, projects_json, goals_json, communication_prefs_json, ui_prefs_json, updated_at)
      VALUES ('main', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        preferences_json = excluded.preferences_json,
        interests_json = excluded.interests_json,
        projects_json = excluded.projects_json,
        goals_json = excluded.goals_json,
        communication_prefs_json = excluded.communication_prefs_json,
        ui_prefs_json = excluded.ui_prefs_json,
        updated_at = excluded.updated_at
    `).run(
      JSON.stringify(profile.preferences),
      JSON.stringify(profile.interests),
      JSON.stringify(profile.projects),
      JSON.stringify(profile.goals),
      JSON.stringify(profile.communication_preferences),
      JSON.stringify(profile.ui_preferences),
      profile.updated_at
    );

    return profile;
  }

  /**
   * Handle natural voice explicit memory commands:
   * "remember that I prefer purple interfaces"
   * "forget that"
   * "what do you remember about me?"
   * "forget everything"
   */
  public async handleVoiceMemoryCommand(
    text: string
  ): Promise<{ handled: boolean; responseText?: string; memory?: MemoryRecord }> {
    const lower = text.toLowerCase().trim();

    // 1. "Forget everything you remember about me" / "Clear all memories"
    if (
      lower.includes('forget everything') ||
      lower.includes('clear all memories') ||
      lower.includes('delete all memories')
    ) {
      this.clearAllMemories();
      return {
        handled: true,
        responseText: "I've cleared all stored memories. We're starting with a fresh slate.",
      };
    }

    // 2. "What do you remember about me?" / "What are my preferences?"
    if (
      lower.includes('what do you remember about me') ||
      lower.includes('what do you know about me') ||
      lower.includes('what memories do you have')
    ) {
      const active = this.getAllMemories(true);
      if (active.length === 0) {
        return {
          handled: true,
          responseText: "I don't have any saved memories about you yet. Feel free to tell me what you'd like me to remember!",
        };
      }
      const summary = active
        .slice(0, 4)
        .map((m) => m.content)
        .join(', and ');
      return {
        handled: true,
        responseText: `Here is what I remember: you mentioned ${summary}.`,
      };
    }

    // 3. "Forget that..." / "Forget my preference for..."
    if (lower.startsWith('forget that') || lower.startsWith('forget my') || lower.startsWith("don't remember")) {
      const targetQuery = lower.replace(/^(forget that|forget my|don't remember)\s*/i, '');
      const results = await this.searchMemories(targetQuery, { limit: 1 });
      if (results.length > 0) {
        this.deleteMemory(results[0].id);
        return {
          handled: true,
          responseText: `Got it, I've forgotten that: "${results[0].content}".`,
        };
      }
      return {
        handled: true,
        responseText: "I couldn't find a specific memory matching that to forget.",
      };
    }

    // 4. "Remember that..." / "Don't forget this / that..."
    if (
      lower.startsWith('remember that') ||
      lower.startsWith('remember ') ||
      lower.startsWith("don't forget that") ||
      lower.startsWith("don't forget ")
    ) {
      const fact = text.replace(/^(remember that|remember|don't forget that|don't forget)\s+/i, '').trim();
      if (fact.length > 2) {
        let category: MemoryCategory = 'PREFERENCE';
        if (fact.toLowerCase().includes('project') || fact.toLowerCase().includes('building') || fact.toLowerCase().includes('reva')) {
          category = 'PROJECT';
        } else if (fact.toLowerCase().includes('goal') || fact.toLowerCase().includes('aim')) {
          category = 'GOAL';
        } else if (fact.toLowerCase().includes('interest') || fact.toLowerCase().includes('like to')) {
          category = 'INTEREST';
        }

        const saved = await this.saveMemory({
          content: fact,
          category,
          importance: 0.95,
          confidence: 1.0,
          source: 'voice_command',
        });

        await this.syncUserProfile();

        return {
          handled: true,
          responseText: `I'll remember that: ${fact}.`,
          memory: saved,
        };
      }
    }

    return { handled: false };
  }

  /**
   * Builds high-signal contextual prompt for Gemini Live model with smart memory retrieval.
   * Retrieves approximately 3-8 most relevant memories without flooding tokens.
   */
  public async getMemoryContextPrompt(userQuery?: string, topic?: string): Promise<string> {
    const parts: string[] = [];

    // 1. Working Memory
    const wmPrompt = this.workingMemory.getSummaryForPrompt();
    if (wmPrompt) parts.push(wmPrompt);

    // 2. Top Relevant Semantic Memories (Top 3-8 scored by hybrid search)
    let memories: MemoryRecord[] = [];
    if (userQuery && userQuery.trim()) {
      memories = await this.searchMemories(userQuery, { limit: 6, topic });
    } else {
      memories = this.getAllMemories(true).slice(0, 6);
    }

    if (memories.length > 0) {
      const memItems = memories
        .map((m) => `- [${m.category}] ${m.content} (importance: ${m.importance.toFixed(2)}, confidence: ${(m.confidence * 100).toFixed(0)}%)`)
        .join('\n');
      parts.push(`RELEVANT ACTIVE MEMORIES:\n${memItems}\n`);
    }

    // 3. User Profile Summary if known
    const profile = this.getUserProfile();
    if (profile.preferences.length > 0 || profile.ui_preferences.length > 0 || profile.projects.length > 0) {
      const profileLines: string[] = [];
      if (profile.name) profileLines.push(`- User Name: ${profile.name}`);
      if (profile.ui_preferences.length > 0) profileLines.push(`- UI Preferences: ${profile.ui_preferences.join('; ')}`);
      if (profile.projects.length > 0) profileLines.push(`- Projects: ${profile.projects.join('; ')}`);
      if (profile.preferences.length > 0) profileLines.push(`- Key Preferences: ${profile.preferences.slice(0, 5).join('; ')}`);
      if (profileLines.length > 0) {
        parts.push(`STRUCTURED USER PROFILE:\n${profileLines.join('\n')}\n`);
      }
    }

    // 4. Recent Episodic Context (last 1-2 events)
    const episodic = this.getAllEpisodicMemories(2);
    if (episodic.length > 0) {
      const epItems = episodic.map((e) => `- (${e.date}) ${e.topic}: ${e.summary}`).join('\n');
      parts.push(`PAST CONVERSATION SUMMARIES:\n${epItems}\n`);
    }

    if (parts.length === 0) return '';
    return `\n${parts.join('\n')}\n`;
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['that', 'this', 'user', 'prefers', 'likes', 'remember', 'about', 'called', 'with', 'from'].includes(w));
  }
}
