/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { MemoryService } from '../services/memory.service.js';

export const sheetsMemoryRouter = Router();
const memoryService = MemoryService.getInstance();

const SHEET_TITLE = 'REVA Long-Term Memory Ledger';

/**
 * Helper to ensure the memory sheet exists and has headers.
 */
async function findOrCreateMemorySheet(accessToken: string): Promise<string> {
  // 1. Search Google Drive for existing memory sheet
  const query = encodeURIComponent(
    `name = '${SHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
  );
  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (driveRes.ok) {
    const data = await driveRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // 2. Create new Google Spreadsheet with structured tabs
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: SHEET_TITLE,
      },
      sheets: [
        { properties: { title: 'Semantic Facts' } },
        { properties: { title: 'Episodic Timeline' } },
        { properties: { title: 'Projects' } },
        { properties: { title: 'User Profile' } },
      ],
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json();
    throw new Error(errData?.error?.message || 'Failed to create Google Sheet for REVA memory.');
  }

  const created = await createRes.json();
  const spreadsheetId = created.spreadsheetId;

  // Initialize headers
  const headersData = [
    {
      range: 'Semantic Facts!A1:H1',
      values: [
        ['ID', 'Category', 'Memory Content', 'Importance', 'Confidence', 'Source', 'Created At', 'Last Accessed'],
      ],
    },
    {
      range: 'Episodic Timeline!A1:F1',
      values: [['ID', 'Date', 'Topic', 'Summary', 'Importance', 'Related Project']],
    },
    {
      range: 'Projects!A1:F1',
      values: [['ID', 'Project Name', 'Description', 'Status', 'Goals', 'Decisions']],
    },
    {
      range: 'User Profile!A1:C1',
      values: [['Section', 'Value', 'Updated At']],
    },
  ];

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: headersData,
    }),
  });

  return spreadsheetId;
}

// POST /api/memory/sheets/sync - Sync local SQLite memory to Google Sheets
sheetsMemoryRouter.post('/sync', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ success: false, error: 'Google OAuth authorization token required' });
  }

  try {
    const spreadsheetId = await findOrCreateMemorySheet(token);

    const memories = memoryService.getAllMemories(false);
    const episodic = memoryService.getAllEpisodicMemories(100);
    const projects = memoryService.getAllProjects();
    const profile = memoryService.getUserProfile();

    const semanticRows = memories.map((m) => [
      m.id,
      m.category,
      m.content,
      m.importance,
      m.confidence,
      m.source,
      m.created_at,
      m.last_accessed_at || '',
    ]);

    const episodicRows = episodic.map((e) => [
      e.id,
      e.date,
      e.topic,
      e.summary,
      e.importance,
      e.related_project || '',
    ]);

    const projectRows = projects.map((p) => [
      p.id,
      p.name,
      p.description,
      p.status,
      (p.goals || []).join('; '),
      (p.decisions || []).join('; '),
    ]);

    const profileRows = [
      ['Preferences', (profile?.preferences || []).join('; '), profile?.updated_at || ''],
      ['Interests', (profile?.interests || []).join('; '), profile?.updated_at || ''],
      ['Goals', (profile?.goals || []).join('; '), profile?.updated_at || ''],
      ['UI Preferences', (profile?.ui_preferences || []).join('; '), profile?.updated_at || ''],
      ['Communication Preferences', (profile?.communication_preferences || []).join('; '), profile?.updated_at || ''],
    ];

    const batchData = [
      {
        range: 'Semantic Facts!A1:H',
        values: [
          ['ID', 'Category', 'Memory Content', 'Importance', 'Confidence', 'Source', 'Created At', 'Last Accessed'],
          ...semanticRows,
        ],
      },
      {
        range: 'Episodic Timeline!A1:F',
        values: [
          ['ID', 'Date', 'Topic', 'Summary', 'Importance', 'Related Project'],
          ...episodicRows,
        ],
      },
      {
        range: 'Projects!A1:F',
        values: [
          ['ID', 'Project Name', 'Description', 'Status', 'Goals', 'Decisions'],
          ...projectRows,
        ],
      },
      {
        range: 'User Profile!A1:C',
        values: [
          ['Section', 'Value', 'Updated At'],
          ...profileRows,
        ],
      },
    ];

    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: batchData,
        }),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err?.error?.message || 'Failed to update Google Sheet memory.');
    }

    res.json({
      success: true,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      syncedCount: semanticRows.length + episodicRows.length + projectRows.length,
      lastSyncAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[REVA][SHEETS] Sync error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to sync with Google Sheets' });
  }
});

// POST /api/memory/sheets/restore - Restore/pull memories from Google Sheets into SQLite
sheetsMemoryRouter.post('/restore', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ success: false, error: 'Google OAuth authorization token required' });
  }

  try {
    const spreadsheetId = await findOrCreateMemorySheet(token);

    const sheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Semantic%20Facts!A2:H500`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!sheetRes.ok) {
      throw new Error('Failed to read memories from Google Sheets.');
    }

    const data = await sheetRes.json();
    const rows: string[][] = data.values || [];

    let importedCount = 0;
    for (const row of rows) {
      if (row.length >= 3 && row[2] && row[2].trim()) {
        await memoryService.saveMemory({
          category: (row[1] as any) || 'PREFERENCE',
          content: row[2].trim(),
          importance: row[3] ? parseFloat(row[3]) : 0.8,
          confidence: row[4] ? parseFloat(row[4]) : 0.95,
          source: 'google_sheets_sync',
        });
        importedCount++;
      }
    }

    res.json({
      success: true,
      spreadsheetId,
      importedCount,
      totalMemories: memoryService.getAllMemories(false).length,
    });
  } catch (err: any) {
    console.error('[REVA][SHEETS] Restore error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to restore memories from Google Sheets' });
  }
});
