'use client';

import React, { useState } from 'react';
import {
  Settings,
  Bell,
  Moon,
  Shield,
  Download,
  Trash2,
  Smartphone,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useDayBridge } from '../../lib/storage/store';
import { DeviceSetup } from '../common/DeviceSetup';
import { TravelPreferencesCard } from '../travel/TravelPreferences';
import { ChangePasswordCard } from '../common/ChangePasswordCard';

export const SettingsView: React.FC = () => {
  const data=useDayBridge();
  const {
    profile,
    updateProfile,
    isLiveSupabase,
  } = useDayBridge();

  const [testNotificationSent, setTestNotificationSent] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const handleTestNotification = async () => {
    if (typeof Notification === 'undefined') {
      alert('Notifications are not supported on this device/browser.');
      return;
    }

    let perm = Notification.permission;
    if (perm !== 'granted') {
      perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    }

    if (perm === 'granted') {
      // Send safe, generic payload as required by threat model
      const registration=await navigator.serviceWorker.ready;
      await registration.showNotification('DayBridge Reminder', {body:'Open DayBridge to view a scheduled item.',icon:'/icon.svg'});
      setTestNotificationSent(true);
      setTimeout(() => setTestNotificationSent(false), 3000);
    }
  };

  const handleExportJSON=()=>{
    if(!window.confirm('This export is an unencrypted JSON file containing sensitive personal data. Save it only to a private device. Continue?'))return;
    const snapshot=Object.fromEntries(['profile','events','eventOccurrences','tasks','medications','medicationSchedules','medicationLogs','accounts','transactions','paycheckPlan','advances','bills','reserves','contacts'].map(key=>[key,(data as unknown as Record<string,unknown>)[key]]));
    const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='daybridge-private-export.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-teal-700" />
          <span>Application Settings</span>
        </h2>
        <p className="text-xs text-slate-600">
          Preferences, quiet hours, notifications, and privacy options
        </p>
      </div>

      <details className="rounded-3xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-bold text-slate-900">Devices, push notifications & sign-in security</summary><div className="mt-4 space-y-4"><DeviceSetup/><ChangePasswordCard/></div></details>
      <details className="rounded-3xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-bold text-slate-900">Travel notifications & location settings</summary><div className="mt-4"><TravelPreferencesCard/></div></details>

      {/* 1. PROFILE & TIMEZONE */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
        <h3 className="font-bold text-base text-slate-900">Personal Profile & Timezone</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Your Name</label>
            <input
              type="text"
              value={profile.fullName}
              onChange={(e) => updateProfile({ fullName: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Timezone (IANA)</label>
            <select
              value={profile.timezone}
              onChange={(e) => updateProfile({ timezone: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm focus:border-teal-500 min-h-[44px]"
            >
              <option value="America/New_York">Eastern Time (America/New_York)</option>
              <option value="America/Chicago">Central Time (America/Chicago)</option>
              <option value="America/Denver">Mountain Time (America/Denver)</option>
              <option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
              <option value="America/Anchorage">Alaska Time (America/Anchorage)</option>
              <option value="Pacific/Honolulu">Hawaii Time (Pacific/Honolulu)</option>
            </select>
          </div>
        </div>
      </section>

      {/* 2. QUIET HOURS & NOTIFICATIONS */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
        <div className="flex items-center gap-2">
          <Moon className="w-5 h-5 text-indigo-700" />
          <h3 className="font-bold text-base text-slate-900">Quiet Hours & Reminders</h3>
        </div>
        <p className="text-xs text-slate-600">
          Non-critical notification sounds will be muted during your resting window.
        </p>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 mb-1">Quiet Hours Start</label>
            <input
              type="time"
              value={profile.quietHoursStart}
              onChange={(e) => updateProfile({ quietHoursStart: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Quiet Hours End</label>
            <input
              type="time"
              value={profile.quietHoursEnd}
              onChange={(e) => updateProfile({ quietHoursEnd: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
            />
          </div>
        </div>

        {/* Test Notification Trigger */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-800 block">Test Web Push Reminder</span>
            <span className="text-[11px] text-slate-600">
              Permission status: <strong className="capitalize">{notificationPermission}</strong>
            </span>
          </div>

          <button
            onClick={handleTestNotification}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs border border-slate-300 min-h-[44px]"
          >
            <Bell className="w-4 h-4 text-teal-700" />
            <span>{testNotificationSent ? 'Sent!' : 'Send Test'}</span>
          </button>
        </div>
      </section>

      {/* 3. PWA & DEVICE INSTALLATION */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-lg space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-teal-700" />
          <h3 className="font-bold text-base text-slate-900">Install to Home Screen (PWA)</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          DayBridge is an installable Progressive Web App. App installation is required before accessing your private workspace.
        </p>

        <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1.5">
          <div>
            <strong>iPhone / iPad (Safari):</strong> Tap the Share button (<span className="text-teal-700">Share icon</span>), then choose &apos;Add to Home Screen&apos;.
          </div>
          <div>
            <strong>Android (Chrome):</strong> Tap the three-dot menu (<span className="text-teal-700">⋮</span>), then choose &apos;Install app&apos; or &apos;Add to Home Screen&apos;.
          </div>
        </div>
      </section>

      {/* 4. BACKUP, EXPORT & DATA HYGIENE */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
        <h3 className="font-bold text-base text-slate-900">Data Backup & Privacy Controls</h3>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleExportJSON}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span>Export All Data (JSON Backup)</span>
          </button>

        </div>
        <p className="text-xs leading-5 text-slate-600">The export contains unencrypted personal information. Data deletion and recovery workflows are intentionally unavailable until they can be confirmed and tested against the cloud database.</p>
      </section>
    </div>
  );
};
