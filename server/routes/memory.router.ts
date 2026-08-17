/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { MemoryService } from '../services/memory.service.js';
import { MemoryConsolidationService } from '../services/memory-consolidation.service.js';
import { WorkingMemoryService } from '../services/working-memory.service.js';
import { MemoryCategory } from '../types/voice.types.js';

export const memoryRouter = Router();
const memoryService = MemoryService.getInstance();
const consolidationService = MemoryConsolidationService.getInstance();
const workingMemoryService = WorkingMemoryService.getInstance();

// GET /api/memory - List all memories
memoryRouter.get('/', (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.all !== 'true';
    const memories = memoryService.getAllMemories(activeOnly);
    res.json({
      success: true,
      count: memories.length,
      memories,
    });
  } catch (err: any) {
    console.error('[REVA][API] Error fetching memories:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to retrieve memories' });
  }
});

// GET /api/memory/search - Hybrid Search
memoryRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 6;
    const category = req.query.category as MemoryCategory | undefined;
    const topic = req.query.topic as string | undefined;

    const results = await memoryService.searchMemories(query, { limit, category, topic });
    res.json({
      success: true,
      query,
      count: results.length,
      results,
      diagnostics: memoryService.getRetrievalDiagnostics(),
    });
  } catch (err: any) {
    console.error('[REVA][API] Error searching memories:', err);
    res.status(500).json({ success: false, error: err?.message || 'Search failed' });
  }
});

// GET /api/memory/diagnostics - Smart Memory Retrieval Diagnostics
memoryRouter.get('/diagnostics', (req: Request, res: Response) => {
  try {
    const diagnostics = memoryService.getRetrievalDiagnostics();
    res.json({
      success: true,
      diagnostics,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// POST /api/memory - Create or reinforce memory
memoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { category, content, importance, confidence, source, project_id } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Content is required.' });
    }

    const saved = await memoryService.saveMemory({
      category: category as MemoryCategory,
      content,
      importance: typeof importance === 'number' ? importance : 0.8,
      confidence: typeof confidence === 'number' ? confidence : 0.95,
      source: source || 'manual_entry',
      project_id,
    });

    res.status(201).json({ success: true, memory: saved });
  } catch (err: any) {
    console.error('[REVA][API] Error creating memory:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to save memory' });
  }
});

// POST /api/memory/consolidate - Run memory consolidation
memoryRouter.post('/consolidate', async (req: Request, res: Response) => {
  try {
    const report = await consolidationService.consolidateMemories();
    res.json({ success: true, report });
  } catch (err: any) {
    console.error('[REVA][API] Error consolidating memories:', err);
    res.status(500).json({ success: false, error: err?.message || 'Consolidation failed' });
  }
});

// POST /api/memory/command - Voice explicit command testing
memoryRouter.post('/command', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'Text command required' });

    const result = await memoryService.handleVoiceMemoryCommand(text);
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('[REVA][API] Error handling voice memory command:', err);
    res.status(500).json({ success: false, error: err?.message || 'Command handling failed' });
  }
});

// GET /api/memory/working - Working memory state
memoryRouter.get('/working', (req: Request, res: Response) => {
  try {
    const state = workingMemoryService.getState();
    res.json({ success: true, workingMemory: state });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET /api/memory/profile - User Profile
memoryRouter.get('/profile', (req: Request, res: Response) => {
  try {
    const profile = memoryService.getUserProfile();
    res.json({ success: true, profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET /api/memory/episodic - Episodic memories list
memoryRouter.get('/episodic', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const episodes = memoryService.getAllEpisodicMemories(limit);
    res.json({ success: true, count: episodes.length, episodes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// POST /api/memory/episodic - Create episodic summary
memoryRouter.post('/episodic', (req: Request, res: Response) => {
  try {
    const { summary, topic, importance, confidence, related_project, date } = req.body;
    if (!summary || !topic) {
      return res.status(400).json({ success: false, error: 'Summary and topic are required' });
    }
    const episode = memoryService.saveEpisodicMemory({
      summary,
      topic,
      importance,
      confidence,
      related_project,
      date,
    });
    res.status(201).json({ success: true, episode });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// DELETE /api/memory/episodic/:id - Delete episodic summary
memoryRouter.delete('/episodic/:id', (req: Request, res: Response) => {
  try {
    const deleted = memoryService.deleteEpisodicMemory(req.params.id);
    res.json({ success: true, deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// GET /api/memory/projects - Projects list
memoryRouter.get('/projects', (req: Request, res: Response) => {
  try {
    const projects = memoryService.getAllProjects();
    res.json({ success: true, count: projects.length, projects });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// POST /api/memory/projects - Save/update project
memoryRouter.post('/projects', (req: Request, res: Response) => {
  try {
    const { id, name, description, goals, decisions, status } = req.body;
    if (!name || !description) {
      return res.status(400).json({ success: false, error: 'Name and description are required' });
    }
    const proj = memoryService.saveProject({ id, name, description, goals, decisions, status });
    res.status(201).json({ success: true, project: proj });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// DELETE /api/memory/projects/:id - Delete project
memoryRouter.delete('/projects/:id', (req: Request, res: Response) => {
  try {
    const deleted = memoryService.deleteProject(req.params.id);
    res.json({ success: true, deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// PATCH /api/memory/:id - Update memory
memoryRouter.patch('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = memoryService.updateMemory(id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Memory not found' });
    }

    res.json({ success: true, memory: updated });
  } catch (err: any) {
    console.error('[REVA][API] Error updating memory:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to update memory' });
  }
});

// DELETE /api/memory/:id - Delete single memory
memoryRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = memoryService.deleteMemory(id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Memory not found' });
    }

    res.json({ success: true, deleted: true });
  } catch (err: any) {
    console.error('[REVA][API] Error deleting memory:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to delete memory' });
  }
});

// DELETE /api/memory - Clear all memories
memoryRouter.delete('/', (req: Request, res: Response) => {
  try {
    const { confirmed } = req.body || {};
    if (!confirmed) {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Pass { confirmed: true } to erase all memories.',
      });
    }

    const count = memoryService.clearAllMemories();
    res.json({ success: true, clearedCount: count, message: 'All memories have been permanently cleared.' });
  } catch (err: any) {
    console.error('[REVA][API] Error clearing memories:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to clear memories' });
  }
});
