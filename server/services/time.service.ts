/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export type PeriodOfDay = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

export interface UserTimeContext {
  localTimeFormatted: string; // e.g. "08:20 AM"
  localDateFormatted: string; // e.g. "Wednesday, Aug 19, 2026"
  periodOfDay: PeriodOfDay;
  isLateNight: boolean;
  hour: number;
  weekday: string;
  timeZone: string; // e.g. "America/New_York", "Asia/Kolkata", "Europe/London"
  timezoneOffset: string; // e.g. "GMT-4", "UTC+05:30"
}

export interface CurrentTimeToolData {
  iso: string;
  formattedTime: string;
  formattedDate: string;
  dayOfWeek: string;
  timeZone: string;
  periodOfDay: PeriodOfDay;
  spokenSummary: string;
}

export class TimeService {
  private static instance: TimeService | null = null;
  private userTimezone: string = 'UTC';
  private userOffsetMinutes: number | null = null;
  private db: Database.Database | null = null;

  private constructor() {
    this.initDatabase();
    this.loadSavedTimezone();
  }

  public static getInstance(): TimeService {
    if (!TimeService.instance) {
      TimeService.instance = new TimeService();
    }
    return TimeService.instance;
  }

  private initDatabase(): void {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const dbPath = path.join(dataDir, 'reva-memory.db');
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_timezone_config (
          id TEXT PRIMARY KEY,
          timezone TEXT NOT NULL,
          offset_minutes INTEGER,
          updated_at TEXT NOT NULL
        );
      `);
    } catch (err) {
      console.warn('[REVA][TIME] SQLite init warning:', err);
    }
  }

  private loadSavedTimezone(): void {
    if (!this.db) return;
    try {
      const row = this.db.prepare('SELECT timezone, offset_minutes FROM user_timezone_config WHERE id = ?').get('global') as any;
      if (row && row.timezone && this.isValidTimezone(row.timezone)) {
        this.userTimezone = row.timezone;
        this.userOffsetMinutes = typeof row.offset_minutes === 'number' ? row.offset_minutes : null;
        console.log(`[REVA][TIME] Loaded persistent user timezone from SQLite: ${this.userTimezone}`);
      }
    } catch (err) {
      console.warn('[REVA][TIME] Could not load saved timezone from SQLite:', err);
    }
  }

  /**
   * Validates if a timezone string is a recognized IANA timezone identifier
   */
  public isValidTimezone(tz: string): boolean {
    if (!tz || typeof tz !== 'string') return false;
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sets the user's browser/system timezone detected via Intl.DateTimeFormat().resolvedOptions().timeZone
   */
  public setUserTimezone(tz: string, offsetMinutes?: number): boolean {
    if (!this.isValidTimezone(tz)) {
      console.warn(`[REVA][TIME] Rejected invalid timezone: "${tz}"`);
      return false;
    }

    const changed = this.userTimezone !== tz;
    this.userTimezone = tz;
    if (typeof offsetMinutes === 'number') {
      this.userOffsetMinutes = offsetMinutes;
    }

    if (changed) {
      console.log(`[REVA][TIME] Synchronized user timezone to: "${this.userTimezone}" (offset: ${offsetMinutes ?? 'auto'}m)`);
    }

    // Persist to database
    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT INTO user_timezone_config (id, timezone, offset_minutes, updated_at)
          VALUES ('global', ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            timezone = excluded.timezone,
            offset_minutes = excluded.offset_minutes,
            updated_at = excluded.updated_at;
        `);
        stmt.run(this.userTimezone, this.userOffsetMinutes ?? null, new Date().toISOString());
      } catch (err) {
        console.warn('[REVA][TIME] Failed to persist timezone to SQLite:', err);
      }
    }

    return true;
  }

  /**
   * Returns current active user timezone (e.g. "America/New_York", "Asia/Kolkata")
   */
  public getUserTimezone(): string {
    return this.userTimezone;
  }

  /**
   * Returns current 0-23 hour in the user's local timezone
   */
  public getHour(date: Date = new Date()): number {
    try {
      const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: this.userTimezone,
        hour: 'numeric',
        hour12: false,
      }).format(date);
      const hour = parseInt(formatted, 10);
      return isNaN(hour) ? date.getUTCHours() : hour % 24;
    } catch {
      return date.getUTCHours();
    }
  }

  /**
   * Returns period of day strictly calculated in user's timezone
   */
  public getPeriodOfDay(date: Date = new Date()): PeriodOfDay {
    const hour = this.getHour(date);
    if (hour >= 5 && hour < 12) return 'MORNING';
    if (hour >= 12 && hour < 17) return 'AFTERNOON';
    if (hour >= 17 && hour < 22) return 'EVENING';
    return 'NIGHT';
  }

  /**
   * Returns whether it is late night in the user's timezone (11 PM - 5 AM)
   */
  public isLateNight(date: Date = new Date()): boolean {
    const hour = this.getHour(date);
    return hour >= 23 || hour < 5;
  }

  /**
   * Formats time string strictly in the user's timezone
   */
  public formatTime(date: Date | number = new Date(), options?: Intl.DateTimeFormatOptions): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: this.userTimezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    };
    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(d);
  }

  /**
   * Formats date string strictly in the user's timezone
   */
  public formatDate(date: Date | number = new Date(), options?: Intl.DateTimeFormatOptions): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: this.userTimezone,
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(d);
  }

  /**
   * Formats date and time string strictly in user's timezone
   */
  public formatDateTime(date: Date | number = new Date()): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: this.userTimezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d);
  }

  /**
   * Returns timezone offset description (e.g. "GMT-4", "UTC+5:30", "America/New_York")
   */
  public getTimezoneOffsetString(date: Date = new Date()): string {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: this.userTimezone,
        timeZoneName: 'shortOffset',
      }).formatToParts(date);
      const tzPart = parts.find((p) => p.type === 'timeZoneName');
      if (tzPart && tzPart.value) return tzPart.value;
    } catch {}

    if (this.userOffsetMinutes !== null) {
      const sign = this.userOffsetMinutes <= 0 ? '+' : '-';
      const abs = Math.abs(this.userOffsetMinutes);
      const h = Math.floor(abs / 60);
      const m = abs % 60;
      return `UTC${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    return this.userTimezone;
  }

  /**
   * Generates comprehensive UserTimeContext object for Gemini Live context injection & diagnostics
   */
  public getTimeContext(date: Date = new Date()): UserTimeContext {
    const hour = this.getHour(date);
    const periodOfDay = this.getPeriodOfDay(date);
    const isLateNight = this.isLateNight(date);
    const localTimeFormatted = this.formatTime(date, { hour: '2-digit', minute: '2-digit', hour12: true });
    const localDateFormatted = this.formatDate(date);
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: this.userTimezone, weekday: 'long' }).format(date);
    const timezoneOffset = this.getTimezoneOffsetString(date);

    return {
      localTimeFormatted,
      localDateFormatted,
      periodOfDay,
      isLateNight,
      hour,
      weekday,
      timeZone: this.userTimezone,
      timezoneOffset,
    };
  }

  /**
   * Generates formatted payload for `get_current_time` tool execution in user's OS timezone
   */
  public getCurrentTimeToolResult(): CurrentTimeToolData {
    const now = new Date();
    const formattedTime = this.formatTime(now, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    const formattedDate = this.formatDate(now, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const dayOfWeek = new Intl.DateTimeFormat('en-US', { timeZone: this.userTimezone, weekday: 'long' }).format(now);
    const periodOfDay = this.getPeriodOfDay(now);
    const tzDisplay = this.userTimezone;

    const spokenSummary = `It is currently ${formattedTime} on ${formattedDate} (${tzDisplay}).`;

    return {
      iso: now.toISOString(),
      formattedTime,
      formattedDate,
      dayOfWeek,
      timeZone: tzDisplay,
      periodOfDay,
      spokenSummary,
    };
  }

  /**
   * Formats a timer completion or reminder description in user's local timezone
   */
  public formatTimerCompletion(targetTimestampMs: number, label?: string): string {
    const timeStr = this.formatTime(new Date(targetTimestampMs), { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    return label ? `Timer for "${label}" set for ${timeStr} (${this.userTimezone})` : `Timer completed at ${timeStr} (${this.userTimezone})`;
  }

  /**
   * Formats a human-readable memory timestamp in the user's local timezone
   */
  public formatMemoryTimestamp(isoOrTimestamp?: string | number): string {
    if (!isoOrTimestamp) return this.formatDateTime(new Date());
    const d = typeof isoOrTimestamp === 'string' ? new Date(isoOrTimestamp) : new Date(isoOrTimestamp);
    return isNaN(d.getTime()) ? String(isoOrTimestamp) : this.formatDateTime(d);
  }
}
