'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowRight, CalendarDays, CheckCircle2, Clock3, Download,
  FileText, LockKeyhole, MapPinned, Pill, ShieldCheck, Smartphone,
  Wallet,
} from 'lucide-react';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

function standalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    !!(navigator as Navigator & { standalone?: boolean }).standalone;
}

const benefits = [
  {
    icon: CalendarDays,
    title: 'Stay on schedule',
    description: 'Keep appointments, recurring responsibilities and daily check-ins together.',
  },
  {
    icon: MapPinned,
    title: 'Plan the journey',
    description: 'Preview routes, traffic-aware travel times and when to leave.',
  },
  {
    icon: Wallet,
    title: 'Know your budget',
    description: 'Track money, upcoming bills, paychecks and safe-to-spend estimates.',
  },
  {
    icon: Pill,
    title: 'Remember the essentials',
    description: 'Organize medication schedules, personal notes and weekly self-reviews.',
  },
] as const;

export function InstallGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const refresh = () => setReady(standalone());
    const handleInstalled = () => {
      setInstallPrompt(null);
      setNotice('DayBridge is installed. Open it from your home screen or app launcher to sign in.');
      refresh();
    };
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    refresh();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIos(isIOS);
    setDesktop(!isIOS && !/Android/i.test(navigator.userAgent));
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  // Keep the existing app-shell warm-up intact; no private workspace data is loaded here.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const warm = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
        const registration = await navigator.serviceWorker.ready;
        const assets = new Set<string>();
        document.querySelectorAll('script[src],link[href]').forEach(node => {
          const value = node.getAttribute('src') || node.getAttribute('href');
          if (value) assets.add(new URL(value, location.origin).href);
        });
        performance.getEntriesByType('resource').forEach(entry => assets.add(entry.name));
        registration.active?.postMessage({ type: 'DAYBRIDGE_WARM_SHELL', assets: [...assets] });
      } catch {
        // The public page remains available online even if service workers are unavailable.
      }
    };
    void warm();
  }, []);

  const tryInstall = async () => {
    if (!installPrompt) {
      setShowHelp(true);
      document.getElementById('daybridge-install-guide')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      return;
    }
    setInstalling(true);
    setNotice('');
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      setNotice(choice.outcome === 'accepted'
        ? 'Installation requested. When it finishes, open DayBridge from your home screen or app launcher.'
        : 'No changes were made. You can install later using your browser menu.');
      setReady(standalone());
    } catch {
      setShowHelp(true);
      setNotice('Your browser could not open the install prompt. Use the steps below instead.');
    } finally {
      setInstalling(false);
    }
  };

  // An installed PWA still goes straight into the original authentication and workspace.
  if (ready === null) return <div className="min-h-screen bg-slate-50" />;
  if (ready) return <>{children}</>;

  const instructions = ios
    ? 'In Safari, tap Share, then Add to Home Screen. Open DayBridge using the new icon.'
    : desktop
      ? 'In Chrome or Edge, choose Install DayBridge from the address bar or browser menu, then open it from your apps.'
      : 'In Chrome or Samsung Internet, open the browser menu and choose Install app or Add to Home screen, then launch DayBridge from its icon.';

  return (
    <main className="min-h-screen overflow-hidden bg-[#f6faf9] text-slate-900">
      <header className="border-b border-teal-950/10 bg-white/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-800 text-white">
              <CalendarDays aria-hidden="true" className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-extrabold tracking-tight text-slate-950">DayBridge</p>
              <p className="text-[11px] font-semibold tracking-[.16em] text-teal-800 uppercase">Personal edition</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void tryInstall()}
            disabled={installing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-teal-800 px-3 py-2 text-sm font-bold text-teal-900 transition hover:bg-teal-50 disabled:opacity-60 sm:px-5"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            <span>{installing ? 'Opening…' : 'Install app'}</span>
          </button>
        </div>
      </header>

      <section aria-labelledby="daybridge-intro-title" className="relative mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:gap-14">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-bold tracking-wide text-teal-900">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            An organized day starts here
          </div>
          <h1 id="daybridge-intro-title" className="max-w-2xl text-4xl font-extrabold leading-[1.12] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.55rem]">
            Your day. Your plan. <span className="text-teal-800">Your progress.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-700 sm:text-lg">
            One private daily organizer for appointments, recurring check-ins,
            travel planning, budgeting, medications and notes. Spend less time
            juggling reminders and more time focusing on what comes next.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void tryInstall()}
              disabled={installing}
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-teal-800 px-7 py-3 text-base font-bold text-white shadow-lg shadow-teal-950/15 transition hover:bg-teal-900 disabled:opacity-60"
            >
              <Download aria-hidden="true" className="h-5 w-5" />
              {installing ? 'Opening install prompt…' : 'Try DayBridge — Install app'}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
            <a href="#daybridge-features" className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold text-teal-900 underline-offset-4 hover:underline">
              Explore features
            </a>
          </div>
          <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-600">
            <LockKeyhole aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-teal-800" />
            Early access is invitation-only. You can install the app now; signing in requires an approved account.
          </p>
          {notice && <p role="status" className="mt-4 rounded-xl border border-teal-200 bg-white px-4 py-3 text-sm text-teal-900">{notice}</p>}
        </div>

        <div aria-label="Illustrative example of a personal daily plan" className="relative mx-auto w-full max-w-[460px]">
          <div aria-hidden="true" className="absolute -inset-5 rounded-[3rem] bg-gradient-to-br from-teal-200/60 via-cyan-100/30 to-transparent blur-2xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-teal-950/10 sm:p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold tracking-[.17em] text-teal-800 uppercase">Illustrative day</p>
                <h2 className="mt-2 text-2xl font-extrabold text-slate-950">Keep moving forward.</h2>
              </div>
              <span className="rounded-2xl bg-teal-50 p-3 text-teal-800"><CalendarDays aria-hidden="true" className="h-6 w-6" /></span>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-4">
                <CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0 text-teal-700" />
                <div><p className="text-sm font-bold">Daily check-in</p><p className="text-xs text-slate-600">Stay on top of your routine</p></div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <Clock3 aria-hidden="true" className="h-6 w-6 shrink-0 text-teal-700" />
                <div><p className="text-sm font-bold">Next appointment</p><p className="text-xs text-slate-600">Know when and where to go</p></div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <MapPinned aria-hidden="true" className="h-6 w-6 shrink-0 text-teal-700" />
                <div><p className="text-sm font-bold">Plan your departure</p><p className="text-xs text-slate-600">Routes and traffic-aware estimates</p></div>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-teal-700" />
              Example content only — not an actual account or screenshot.
            </div>
          </div>
        </div>
      </section>

      <section id="daybridge-features" aria-labelledby="daybridge-features-title" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <p className="text-xs font-bold tracking-[.17em] text-teal-800 uppercase">The essentials, together</p>
          <h2 id="daybridge-features-title" className="mt-2 max-w-2xl text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Practical tools for real daily responsibilities.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-[#fbfdfc] p-5">
                <div className="inline-flex rounded-xl bg-teal-50 p-3 text-teal-800"><Icon aria-hidden="true" className="h-6 w-6" /></div>
                <h3 className="mt-4 text-base font-bold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="daybridge-install-guide" aria-labelledby="daybridge-install-title" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-16 sm:px-8">
        <div className="grid gap-8 rounded-[2rem] border border-teal-200 bg-teal-50/70 p-6 sm:p-9 md:grid-cols-[.8fr_1.2fr]">
          <div>
            <div className="inline-flex rounded-xl bg-white p-3 text-teal-800"><Smartphone aria-hidden="true" className="h-6 w-6" /></div>
            <h2 id="daybridge-install-title" className="mt-4 text-2xl font-extrabold text-slate-950">Install. Open. Sign in.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">DayBridge is an installable web app. It opens from your device like an app, while existing account protection stays in place.</p>
          </div>
          <div className="space-y-3">
            {[
              ['1', 'Install DayBridge', installPrompt ? 'Use the Install app button above and accept your browser’s prompt.' : instructions],
              ['2', 'Open the installed app', 'Launch DayBridge from your home screen or app launcher.'],
              ['3', 'Sign in securely', 'Use your administrator-provided username or email and password.'],
            ].map(([number, title, description]) => (
              <div key={number} className="flex items-start gap-4 rounded-2xl bg-white p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-800 text-sm font-extrabold text-white">{number}</span>
                <div><h3 className="font-bold text-slate-950">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{description}</p></div>
              </div>
            ))}
            {showHelp && <p role="status" className="rounded-xl border border-teal-200 bg-white px-4 py-3 text-sm text-teal-900">If the install option is missing, try a supported browser on HTTPS. Installation support varies by device and browser.</p>}
            <button type="button" onClick={() => void tryInstall()} disabled={installing} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3 font-bold text-white hover:bg-teal-900 disabled:opacity-60">
              <Download aria-hidden="true" className="h-5 w-5" />
              {installing ? 'Opening…' : 'Try DayBridge — Install app'}
            </button>
          </div>
        </div>
        <p className="mt-7 text-center text-xs leading-6 text-slate-600">
          DayBridge is a personal organization aid, not an official court attendance verification system,
          medical device or guaranteed emergency reminder service.
        </p>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-6 text-center text-xs text-slate-600">
        DayBridge — Developed by Global Intent Company. Private access by invitation during early testing.
      </footer>
    </main>
  );
}
