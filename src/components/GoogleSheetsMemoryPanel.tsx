/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Cloud,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  DownloadCloud,
  UploadCloud,
  LogOut,
} from 'lucide-react';
import {
  initAuth,
  googleSignIn,
  googleSignOut,
  getAccessToken,
} from '../lib/google-auth.js';
import { User } from 'firebase/auth';

interface GoogleSheetsMemoryPanelProps {
  memoryCount: number;
  onSyncComplete?: () => void;
}

export const GoogleSheetsMemoryPanel: React.FC<GoogleSheetsMemoryPanelProps> = ({
  memoryCount,
  onSyncComplete,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setAccessToken(res.accessToken);
        setStatusMessage('Connected to Google Account. Ready to sync memory.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to authenticate with Google.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setCurrentUser(null);
    setAccessToken(null);
    setSpreadsheetUrl(null);
    setStatusMessage('Disconnected from Google Drive & Sheets.');
  };

  const handleSyncToSheets = async () => {
    if (!accessToken) {
      setErrorMessage('Please connect your Google Account first.');
      return;
    }

    setIsSyncing(true);
    setErrorMessage(null);
    setStatusMessage('Synchronizing SQLite memory ledger to Google Sheets...');

    try {
      const res = await fetch('/api/memory/sheets/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to synchronize with Google Sheets.');
      }

      setSpreadsheetUrl(data.spreadsheetUrl);
      setLastSyncTime(new Date().toLocaleTimeString());
      setStatusMessage(`Successfully synced ${data.syncedCount} memories to Google Sheets.`);
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error during Google Sheets synchronization.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromSheets = async () => {
    if (!accessToken) {
      setErrorMessage('Please connect your Google Account first.');
      return;
    }

    setIsRestoring(true);
    setErrorMessage(null);
    setStatusMessage('Restoring memories from Google Sheets into local memory database...');

    try {
      const res = await fetch('/api/memory/sheets/restore', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to restore memories from Google Sheets.');
      }

      setStatusMessage(`Restored ${data.importedCount} memories into local database.`);
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error during memory restoration.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 text-zinc-100 font-sans space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-semibold text-purple-100 flex items-center gap-2">
              Google Sheets Long-Term Storage
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-mono">
                Persistent Drive
              </span>
            </h3>
            <p className="text-[11px] text-purple-300/60 font-mono">
              Preserves REVA memories across server reboots, devices & re-deploys.
            </p>
          </div>
        </div>

        {currentUser && (
          <button
            onClick={handleSignOut}
            className="p-1.5 text-zinc-400 hover:text-rose-300 hover:bg-purple-900/30 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1 font-mono"
            title="Disconnect Google Account"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>
        )}
      </div>

      {/* Auth state or Login prompt */}
      {!currentUser ? (
        <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-left">
            <span className="text-xs font-semibold text-purple-200">Connect Google Sheets & Drive</span>
            <p className="text-[11px] text-purple-300/70 font-mono">
              Sign in with Google to enable permanent multi-tab spreadsheet backup for REVA.
            </p>
          </div>

          {/* Official Google Sign-in Styled Button */}
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-800 rounded-lg text-xs font-medium font-sans flex items-center gap-2.5 shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span>{isSigningIn ? 'Connecting...' : 'Sign in with Google'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-xs font-mono">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Connected as: {currentUser.email}</span>
            </div>
            {lastSyncTime && (
              <span className="text-[10px] text-zinc-400">Last Synced: {lastSyncTime}</span>
            )}
          </div>

          {/* Sync & Restore Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSyncToSheets}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <UploadCloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>{isSyncing ? 'Syncing to Sheets...' : 'Sync to Google Sheets'}</span>
            </button>

            <button
              onClick={handleRestoreFromSheets}
              disabled={isRestoring}
              className="px-3 py-1.5 bg-purple-900 hover:bg-purple-800 text-purple-100 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <DownloadCloud className={`w-3.5 h-3.5 ${isRestoring ? 'animate-bounce' : ''}`} />
              <span>{isRestoring ? 'Restoring...' : 'Restore into Local DB'}</span>
            </button>

            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border border-cyan-800/60 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Google Sheet</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Status or Error alerts */}
      {statusMessage && (
        <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-2.5 rounded bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
