/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Send,
  ShieldCheck,
  Radio,
  Sliders,
  Mail,
  MessageSquare,
  Sparkles,
  RefreshCw,
  EyeOff,
  Check,
  Lock,
} from 'lucide-react';
import { UserNotificationPreferences } from '../types';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  testNotificationConnection,
  fetchNotificationLogs,
} from '../services/notifications';

interface NotificationSettingsPanelProps {
  onSaved?: () => void;
  standalone?: boolean;
}

export const NotificationSettingsPanel: React.FC<NotificationSettingsPanelProps> = ({
  onSaved,
  standalone = false,
}) => {
  const [preferences, setPreferences] = useState<UserNotificationPreferences>(
    getNotificationPreferences()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    const fetched = await fetchNotificationLogs();
    setLogs(fetched);
    setIsLoadingLogs(false);
  };

  const handleSave = () => {
    setIsSaving(true);
    saveNotificationPreferences(preferences);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      if (onSaved) onSaved();
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 400);
  };

  const handleTestDispatch = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await testNotificationConnection(preferences);
    setIsTesting(false);
    if (res.success) {
      setTestResult({
        success: true,
        message: res.message || `Test alert successfully dispatched to ${preferences.channel}!`,
      });
      loadLogs();
    } else {
      setTestResult({
        success: false,
        message: res.error || 'Failed to dispatch test notification.',
      });
    }
  };

  return (
    <div className={`space-y-6 ${standalone ? 'p-6 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800/80 flex items-center justify-center text-purple-400 shrink-0 shadow-inner">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">External Notification Integrations</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-300 font-semibold">
                Zero-Knowledge Sanitized
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Receive external alerts via Slack, Discord, or Email when high friction or acute fatigue is detected.
            </p>
          </div>
        </div>

        {/* Master Enabled Switch */}
        <label className="flex items-center gap-3 cursor-pointer bg-neutral-950 px-3.5 py-2 rounded-xl border border-neutral-800 self-start sm:self-auto">
          <span className="text-xs font-semibold text-neutral-300">
            {preferences.enabled ? 'Alerts Active' : 'Alerts Disabled'}
          </span>
          <input
            type="checkbox"
            checked={preferences.enabled}
            onChange={(e) => setPreferences({ ...preferences, enabled: e.target.checked })}
            className="sr-only"
          />
          <div
            className={`w-9 h-5 rounded-full transition-colors relative ${
              preferences.enabled ? 'bg-cyan-500' : 'bg-neutral-800'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-neutral-950 absolute top-0.5 transition-transform ${
                preferences.enabled ? 'left-4.5 translate-x-0' : 'left-0.5'
              }`}
            />
          </div>
        </label>
      </div>

      {/* Target Channel Selector */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          Preferred Delivery Destination
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Slack */}
          <button
            type="button"
            onClick={() => setPreferences({ ...preferences, channel: 'Slack' })}
            className={`p-4 rounded-xl border text-left transition flex flex-col justify-between gap-3 ${
              preferences.channel === 'Slack'
                ? 'bg-purple-950/40 border-purple-600/80 shadow-lg shadow-purple-950/40'
                : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className={`w-4 h-4 ${preferences.channel === 'Slack' ? 'text-purple-400' : 'text-neutral-400'}`} />
                <span className="text-sm font-bold text-white">Slack Webhook</span>
              </div>
              {preferences.channel === 'Slack' && (
                <CheckCircle2 className="w-4 h-4 text-purple-400" />
              )}
            </div>
            <p className="text-[11px] text-neutral-400">
              Formatted block message with severity badges and micro-action tips.
            </p>
          </button>

          {/* Discord */}
          <button
            type="button"
            onClick={() => setPreferences({ ...preferences, channel: 'Discord' })}
            className={`p-4 rounded-xl border text-left transition flex flex-col justify-between gap-3 ${
              preferences.channel === 'Discord'
                ? 'bg-indigo-950/40 border-indigo-600/80 shadow-lg shadow-indigo-950/40'
                : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className={`w-4 h-4 ${preferences.channel === 'Discord' ? 'text-indigo-400' : 'text-neutral-400'}`} />
                <span className="text-sm font-bold text-white">Discord Webhook</span>
              </div>
              {preferences.channel === 'Discord' && (
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              )}
            </div>
            <p className="text-[11px] text-neutral-400">
              Rich embed card with condition summary and zero-knowledge badge.
            </p>
          </button>

          {/* Email */}
          <button
            type="button"
            onClick={() => setPreferences({ ...preferences, channel: 'Email' })}
            className={`p-4 rounded-xl border text-left transition flex flex-col justify-between gap-3 ${
              preferences.channel === 'Email'
                ? 'bg-cyan-950/40 border-cyan-600/80 shadow-lg shadow-cyan-950/40'
                : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className={`w-4 h-4 ${preferences.channel === 'Email' ? 'text-cyan-400' : 'text-neutral-400'}`} />
                <span className="text-sm font-bold text-white">Email (Resend/API)</span>
              </div>
              {preferences.channel === 'Email' && (
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              )}
            </div>
            <p className="text-[11px] text-neutral-400">
              Dispatched via Resend / SendGrid API to your verified inbox.
            </p>
          </button>
        </div>
      </div>

      {/* Destination Configuration Inputs */}
      <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-4">
        {preferences.channel === 'Slack' && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
              <span>Slack Incoming Webhook URL</span>
              <span className="text-[10px] text-neutral-500">Optional if set in server env</span>
            </label>
            <input
              type="url"
              value={preferences.webhookUrl || ''}
              onChange={(e) => setPreferences({ ...preferences, webhookUrl: e.target.value })}
              placeholder="https://hooks.slack.com/services/T000/B000/XXXXXX"
              className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500"
            />
            <p className="text-[11px] text-neutral-500">
              Leave blank to use default server environment webhook (<code className="text-purple-300">NOTIFICATION_WEBHOOK_URL</code>).
            </p>
          </div>
        )}

        {preferences.channel === 'Discord' && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
              <span>Discord Channel Webhook URL</span>
              <span className="text-[10px] text-neutral-500">Optional if set in server env</span>
            </label>
            <input
              type="url"
              value={preferences.webhookUrl || ''}
              onChange={(e) => setPreferences({ ...preferences, webhookUrl: e.target.value })}
              placeholder="https://discord.com/api/webhooks/123456789/abcdef..."
              className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-neutral-500">
              Webhook URL from Discord Channel Integrations tab.
            </p>
          </div>
        )}

        {preferences.channel === 'Email' && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
              <span>Recipient Email Address</span>
              <span className="text-[10px] text-cyan-400 font-semibold">Protected</span>
            </label>
            <input
              type="email"
              value={preferences.emailRecipient || ''}
              onChange={(e) => setPreferences({ ...preferences, emailRecipient: e.target.value })}
              placeholder="user@example.com"
              className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[11px] text-neutral-500">
              Alerts are sent via server-side Resend API key (<code className="text-cyan-300">RESEND_API_KEY</code>).
            </p>
          </div>
        )}

        {/* Trigger Criteria Checkboxes */}
        <div className="pt-3 border-t border-neutral-850 space-y-2.5">
          <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            Trigger Criteria & Sensitivity
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-300">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/80 hover:bg-neutral-850">
              <input
                type="checkbox"
                checked={preferences.triggerOnBurnout}
                onChange={(e) => setPreferences({ ...preferences, triggerOnBurnout: e.target.checked })}
                className="rounded text-cyan-500 focus:ring-0 bg-neutral-950 border-neutral-700"
              />
              <span>High Burnout & Fatigue Spikes (<code className="text-amber-400">trigger_alert: true</code>)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/80 hover:bg-neutral-850">
              <input
                type="checkbox"
                checked={preferences.triggerOnFriction}
                onChange={(e) => setPreferences({ ...preferences, triggerOnFriction: e.target.checked })}
                className="rounded text-cyan-500 focus:ring-0 bg-neutral-950 border-neutral-700"
              />
              <span>Critical Friction & Unresolved Blockers</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/80 hover:bg-neutral-850 sm:col-span-2">
              <input
                type="checkbox"
                checked={preferences.triggerOnAllReflections}
                onChange={(e) => setPreferences({ ...preferences, triggerOnAllReflections: e.target.checked })}
                className="rounded text-cyan-500 focus:ring-0 bg-neutral-950 border-neutral-700"
              />
              <span>Dispatch on Every Reflection (Daily Evening Digest Mode)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Zero-Knowledge Payload Sanitization Card */}
      <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
          <ShieldCheck className="w-4 h-4" />
          <span>Zero-Knowledge Sanitization Guarantee</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-neutral-950/70 border border-rose-950/80 text-rose-300/90 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-rose-400">
              <EyeOff className="w-3.5 h-3.5" />
              <span>NEVER Transmitted:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-neutral-400">
              <li>Raw journal reflection plaintext</li>
              <li>Personal entity names & secrets</li>
              <li>GPS coordinates & addresses</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-neutral-950/70 border border-emerald-950/80 text-emerald-300/90 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              <span>Safely Dispatched:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-neutral-400">
              <li>Sanitized diagnostic trigger (<code className="text-purple-300">FATIGUE_SPIKE</code>)</li>
              <li>Severity level & timestamp</li>
              <li>Unblocked morning micro-action tips</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Action Buttons & Feedback */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestDispatch}
            disabled={isTesting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 hover:border-purple-500 text-neutral-200 text-xs font-semibold transition shadow-sm disabled:opacity-50"
          >
            {isTesting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-neutral-300 border-t-transparent rounded-full animate-spin" />
                <span>Dispatching Test...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 text-purple-400" />
                <span>Test Alert Dispatch</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={loadLogs}
            disabled={isLoadingLogs}
            className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 transition"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs transition shadow-lg shadow-purple-950/50 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving Preferences...</span>
            </>
          ) : saveSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Preferences Saved!</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>Save Integrations</span>
            </>
          )}
        </button>
      </div>

      {/* Test Status Banner */}
      {testResult && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
            testResult.success
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Transmission History Logs */}
      {logs.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-neutral-800">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
              Recent Sanitized Dispatches ({logs.length})
            </h4>
            <span className="text-[10px] text-neutral-500">Live In-Memory Server Queue</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {logs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-850 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold shrink-0 ${
                      log.status === 'SENT'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-neutral-850 text-neutral-400 border border-neutral-700'
                    }`}
                  >
                    {log.status}
                  </span>
                  <span className="font-semibold text-neutral-200 shrink-0">[{log.channel}]</span>
                  <span className="text-neutral-400 truncate text-[11px]">{log.sanitizedMessage}</span>
                </div>
                <span className="text-[10px] text-neutral-500 font-mono shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
