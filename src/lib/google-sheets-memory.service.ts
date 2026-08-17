/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemoryRecord, EpisodicMemoryRecord, ProjectMemoryRecord, UserProfile } from '../types/voice.types.js';

export interface GoogleSheetsSyncStatus {
  connected: boolean;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  sheetName: string | null;
  lastSyncAt: string | null;
  syncedRecordCount: number;
}

const SHEET_TITLE = 'REVA Long-Term Memory Ledger';

/**
 * Service to synchronize REVA's SQLite memories with Google Sheets and Google Drive.
 */
export class GoogleSheetsMemoryService {
  private static instance: GoogleSheetsMemoryService | null = null;
  private spreadsheetId: string | null = null;
  private lastSyncAt: string | null = null;

  public static getInstance(): GoogleSheetsMemoryService {
    if (!GoogleSheetsMemoryService.instance) {
      GoogleSheetsMemoryService.instance = new GoogleSheetsMemoryService();
    }
    return GoogleSheetsMemoryService.instance;
  }

  /**
   * Finds or creates a dedicated Google Sheet for REVA's memories in the user's Drive.
   */
  public async findOrCreateMemorySheet(accessToken: string): Promise<string> {
    if (this.spreadsheetId) {
      try {
        // Verify it's accessible
        const checkRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}?fields=spreadsheetId,properties.title`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (checkRes.ok) {
          return this.spreadsheetId;
        }
      } catch (_) {
        this.spreadsheetId = null;
      }
    }

    // 1. Search Google Drive for existing memory sheet
    const query = encodeURIComponent(`name = '${SHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (driveRes.ok) {
      const data = await driveRes.json();
      if (data.files && data.files.length > 0) {
        this.spreadsheetId = data.files[0].id;
        return this.spreadsheetId!;
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
    this.spreadsheetId = created.spreadsheetId;

    // Initialize headers for each sheet tab
    await this.initializeHeaders(accessToken, this.spreadsheetId!);

    return this.spreadsheetId!;
  }

  private async initializeHeaders(accessToken: string, spreadsheetId: string): Promise<void> {
    const headersData = [
      {
        range: 'Semantic Facts!A1:H1',
        values: [['ID', 'Category', 'Memory Content', 'Importance', 'Confidence', 'Source', 'Created At', 'Last Accessed']],
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
  }

  /**
   * Syncs all local SQLite memories up to the Google Sheet.
   */
  public async syncAllToGoogleSheet(
    accessToken: string,
    data: {
      memories: MemoryRecord[];
      episodic: EpisodicMemoryRecord[];
      projects: ProjectMemoryRecord[];
      profile?: UserProfile | null;
    }
  ): Promise<{ spreadsheetId: string; url: string; count: number }> {
    const spreadsheetId = await this.findOrCreateMemorySheet(accessToken);

    // Prepare Semantic Facts rows
    const semanticRows = data.memories.map((m) => [
      m.id,
      m.category,
      m.content,
      m.importance,
      m.confidence,
      m.source,
      m.created_at,
      m.last_accessed_at || '',
    ]);

    // Prepare Episodic rows
    const episodicRows = data.episodic.map((e) => [
      e.id,
      e.date,
      e.topic,
      e.summary,
      e.importance,
      e.related_project || '',
    ]);

    // Prepare Projects rows
    const projectRows = data.projects.map((p) => [
      p.id,
      p.name,
      p.description,
      p.status,
      (p.goals || []).join('; '),
      (p.decisions || []).join('; '),
    ]);

    // Prepare Profile rows
    const profileRows = [
      ['Preferences', (data.profile?.preferences || []).join('; '), data.profile?.updated_at || ''],
      ['Interests', (data.profile?.interests || []).join('; '), data.profile?.updated_at || ''],
      ['Goals', (data.profile?.goals || []).join('; '), data.profile?.updated_at || ''],
      ['UI Preferences', (data.profile?.ui_preferences || []).join('; '), data.profile?.updated_at || ''],
      ['Communication Preferences', (data.profile?.communication_preferences || []).join('; '), data.profile?.updated_at || ''],
    ];

    // Clear existing data rows (keep headers) and write fresh dataset
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

    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: batchData,
        }),
      }
    );

    if (!writeRes.ok) {
      const err = await writeRes.json();
      throw new Error(err?.error?.message || 'Failed to update Google Sheet memory records.');
    }

    this.lastSyncAt = new Date().toISOString();

    return {
      spreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      count: semanticRows.length + episodicRows.length + projectRows.length,
    };
  }

  /**
   * Imports records from Google Sheets into local memory.
   */
  public async importFromGoogleSheet(
    accessToken: string
  ): Promise<{ importedMemories: Partial<MemoryRecord>[]; count: number }> {
    const spreadsheetId = await this.findOrCreateMemorySheet(accessToken);

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Semantic%20Facts!A2:H500`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      throw new Error('Failed to read memories from Google Sheets.');
    }

    const data = await res.json();
    const rows = data.values || [];

    const importedMemories: Partial<MemoryRecord>[] = rows
      .filter((r: any[]) => r.length >= 3 && r[2] && r[2].trim())
      .map((r: any[]) => ({
        id: r[0] || undefined,
        category: (r[1] as any) || 'PREFERENCE',
        content: r[2],
        importance: r[3] ? parseFloat(r[3]) : 0.8,
        confidence: r[4] ? parseFloat(r[4]) : 0.9,
        source: 'google_sheets_import',
      }));

    return {
      importedMemories,
      count: importedMemories.length,
    };
  }

  public getStatus(): GoogleSheetsSyncStatus {
    return {
      connected: !!this.spreadsheetId,
      spreadsheetId: this.spreadsheetId,
      spreadsheetUrl: this.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}` : null,
      sheetName: SHEET_TITLE,
      lastSyncAt: this.lastSyncAt,
      syncedRecordCount: 0,
    };
  }
}
