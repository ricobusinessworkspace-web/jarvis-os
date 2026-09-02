'use client';

import React, { useState } from 'react';
import { Bot, Copy, Check, Loader2, X } from 'lucide-react';
import { getClaudeContext } from '@/actions/export';

export function ClaudeExportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState('');
  const [copied, setCopied] = useState(false);

  const handleOpen = async () => {
    setIsOpen(true);
    setLoading(true);
    const res = await getClaudeContext();
    if (res.success && res.data) {
      setMarkdown(res.data);
    } else {
      setMarkdown('Error loading context.');
    }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button 
        onClick={handleOpen}
        className="flex items-center justify-center p-2 rounded-xl bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors tooltip-trigger relative group"
        title="Export Context for Claude"
      >
        <Bot className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-elevated border border-border rounded-3xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border/50 bg-background/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 text-orange-500 rounded-xl">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Claude Context Export</h2>
                  <p className="text-xs text-muted-foreground">Kopiere diesen Text und füge ihn in Claude ein.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 text-muted hover:text-foreground hover:bg-overlay rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-background/30">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                  <span className="text-sm">Generiere OS State...</span>
                </div>
              ) : (
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed bg-black/20 p-4 rounded-xl border border-border/30">
                  {markdown}
                </pre>
              )}
            </div>

            <div className="p-6 border-t border-border/50 bg-background/50 flex justify-end gap-3">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Schließen
              </button>
              <button 
                onClick={handleCopy}
                disabled={loading || !markdown}
                className="px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Kopiert!' : 'Kontext kopieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
