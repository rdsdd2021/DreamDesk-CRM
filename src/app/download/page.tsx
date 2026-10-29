import React from "react";
import Link from "next/link";
import { Download, Smartphone, ShieldCheck, CheckCircle2, ArrowRight, Zap, RefreshCw } from "lucide-react";

export const metadata = {
  title: "Download DreamDesk CRM for Android",
  description: "Download the lightweight, high-speed DreamDesk CRM Android APK for telecallers.",
};

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between p-4 sm:p-6 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(37,99,235,0.18),rgba(255,255,255,0))]" />

      {/* Top Header */}
      <header className="relative z-10 max-w-md mx-auto w-full flex items-center justify-between pt-2 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
            D
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white leading-none">DreamDesk CRM</h1>
            <p className="text-[11px] text-neutral-400 font-mono mt-0.5">Android Telecaller Edition</p>
          </div>
        </div>
        <Link
          href="/"
          className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800"
        >
          <span>Open Web</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </header>

      {/* Main Content Hero */}
      <main className="relative z-10 max-w-md mx-auto w-full my-auto space-y-5">
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 shadow-2xl backdrop-blur-sm space-y-5">
          {/* App Card Header */}
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 shrink-0">
              <Smartphone className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-base text-white">DreamDesk CRM</span>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                  v1.1.0
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">Lightweight APK · Fast & Tab-Safe</p>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-emerald-400 font-medium">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> High RAM Priority
                </span>
                <span>•</span>
                <span>~3.2 MB</span>
              </div>
            </div>
          </div>

          {/* Primary Download Button */}
          <div className="space-y-2 pt-1">
            <a
              href="/downloads/DreamDesk-CRM.apk"
              download="DreamDesk-CRM.apk"
              className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/25 transition-all text-sm"
            >
              <Download className="w-4 h-4 animate-bounce" />
              <span>Download Android APK</span>
            </a>
            <p className="text-[11px] text-center text-neutral-400">
              Compatible with Android 7.0 and up (all phones)
            </p>
          </div>

          {/* Key Advantages for Telecallers */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800/80">
            <div className="bg-neutral-950/60 border border-neutral-800/60 rounded-lg p-2.5 space-y-1">
              <div className="flex items-center gap-1.5 text-blue-400 text-xs font-medium">
                <Zap className="w-3.5 h-3.5" />
                <span>Zero Tab Crashing</span>
              </div>
              <p className="text-[10px] text-neutral-400 leading-tight">
                Won't close in background while telecallers dial numbers.
              </p>
            </div>

            <div className="bg-neutral-950/60 border border-neutral-800/60 rounded-lg p-2.5 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Realtime Sync</span>
              </div>
              <p className="text-[10px] text-neutral-400 leading-tight">
                Instant sync with admissions pipeline & dispositions.
              </p>
            </div>
          </div>

          {/* Installation steps */}
          <div className="bg-neutral-950/80 rounded-xl p-3 border border-neutral-800/80 space-y-2">
            <h3 className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Easy 3-Step Installation:</span>
            </h3>
            <ol className="text-[11px] text-neutral-400 space-y-1.5 pl-4 list-decimal leading-relaxed">
              <li>Tap the <strong>Download Android APK</strong> button above.</li>
              <li>When Android asks <em>"File might be harmful"</em>, tap <strong>Download anyway</strong> (standard notice for apps outside Play Store).</li>
              <li>Open the downloaded file and tap <strong>Install</strong>.</li>
            </ol>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-md mx-auto w-full text-center py-4 text-[11px] text-neutral-400">
        DreamDesk CRM © 2026 · Built for Telecallers & Counselors
      </footer>
    </div>
  );
}
