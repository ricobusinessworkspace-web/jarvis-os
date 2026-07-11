'use client';
import { ExternalLink } from 'lucide-react';
import JarvisChat from '@/components/jarvis/JarvisChat';

export default function JarvisPage() {
  const handlePopOut = () => {
    // Open in a new window with specific dimensions
    const width = 800;
    const height = 900;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    window.open(
      '/jarvis',
      'jarvis-window',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Jarvis AI</h1>
        <button
          onClick={handlePopOut}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-surface border border-border text-muted hover:text-foreground hover:border-border/80 transition-colors"
        >
          <ExternalLink size={14} />
          Pop Out
        </button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Side: Widgets (Future Phase) */}
        <div className="hidden lg:flex flex-col gap-4 col-span-1">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm flex flex-col items-center justify-center h-48 opacity-50">
            <p className="text-sm text-muted">Sales Pipeline Widget (Coming Soon)</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm flex flex-col items-center justify-center h-48 opacity-50">
            <p className="text-sm text-muted">Call Tracker Widget (Coming Soon)</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm flex flex-col items-center justify-center h-48 opacity-50">
            <p className="text-sm text-muted">Starred Leads Widget (Coming Soon)</p>
          </div>
        </div>

        {/* Right Side: Chat */}
        <div className="col-span-1 lg:col-span-2 h-full">
          <JarvisChat />
        </div>
      </div>
    </div>
  );
}
