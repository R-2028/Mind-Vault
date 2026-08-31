/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserNotificationPreferences } from '../types';
import { logSecurityAudit } from './storage';

const NOTIF_PREFS_KEY = 'cognitive_vault_notification_prefs_v1';

export const DEFAULT_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  enabled: true,
  channel: 'Slack',
  webhookUrl: '',
  emailRecipient: 'riteshnayak2301@gmail.com',
  triggerOnBurnout: true,
  triggerOnFriction: true,
  triggerOnAllReflections: false,
};

/**
 * Load user notification preferences from local storage
 */
export function getNotificationPreferences(): UserNotificationPreferences {
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...JSON.parse(raw),
    };
  } catch (err) {
    console.warn('Failed to parse notification preferences:', err);
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

/**
 * Save user notification preferences to local storage
 */
export function saveNotificationPreferences(prefs: UserNotificationPreferences): void {
  try {
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
    logSecurityAudit(
      'AUTH',
      `Updated notification integrations: ${prefs.enabled ? 'Enabled' : 'Disabled'} (${prefs.channel})`,
      'INFO'
    );
  } catch (err) {
    console.error('Failed to save notification preferences:', err);
  }
}

/**
 * Test notification connection directly with server-side dispatcher
 */
export async function testNotificationConnection(
  prefs: UserNotificationPreferences
): Promise<{ success: boolean; record?: any; message?: string; error?: string }> {
  try {
    const resp = await fetch('/api/notifications/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: prefs.channel,
        webhookUrl: prefs.webhookUrl,
        emailRecipient: prefs.emailRecipient,
      }),
    });

    const data = await resp.json();
    if (data.success) {
      logSecurityAudit(
        'STORAGE',
        `Dispatched test external notification alert to ${prefs.channel} (${data.record?.status})`,
        'SUCCESS'
      );
      return data;
    } else {
      return { success: false, error: data.error || 'Server rejected test dispatch' };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error during test dispatch' };
  }
}

/**
 * Fetch server-side sanitized notification transmission logs
 */
export async function fetchNotificationLogs(): Promise<any[]> {
  try {
    const resp = await fetch('/api/notifications/logs');
    const data = await resp.json();
    if (data.success && Array.isArray(data.logs)) {
      return data.logs;
    }
    return [];
  } catch (err) {
    console.warn('Failed fetching notification logs:', err);
    return [];
  }
}
