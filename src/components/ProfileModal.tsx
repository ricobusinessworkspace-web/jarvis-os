'use client';

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ShieldAlert, ShieldCheck, UserCog, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  role: 'developer' | 'admin' | 'agent';
  email: string;
}

export default function ProfileModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    // In a real implementation, fetch this from Supabase / API
    // For now we mock an agent to demonstrate the UI structure
    if (open) {
      setUser({
        id: 'user-1',
        role: 'agent',
        email: 'agent@jarvis.os',
      });
      setClickCount(0);
    }
  }, [open]);

  const handleTitleClick = async () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    if (newCount >= 5) {
      // Developer Unlock
      try {
        const res = await fetch('/api/auth/developer-unlock', { method: 'POST' });
        if (res.ok) {
          setUser(prev => prev ? { ...prev, role: 'developer' } : null);
          alert('Developer mode unlocked!');
        }
      } catch (err) {
        console.error('Unlock failed', err);
      }
    }
  };

  const isPrivileged = user?.role === 'developer' || user?.role === 'admin';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-2xl duration-200">
          
          <div className="flex justify-between items-center mb-2">
            <Dialog.Title 
              className="text-lg font-semibold tracking-tight cursor-default select-none"
              onClick={handleTitleClick}
            >
              System Profile
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </Dialog.Close>
          </div>

          {user ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-secondary/20">
                <div 
                  className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold cursor-pointer group"
                  title="Profilbild ändern (Demnächst)"
                >
                  {user.email.charAt(0).toUpperCase()}
                  <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-xs">
                    📷
                  </div>
                </div>
                <div>
                  <div className="text-xl font-bold">{user.email}</div>
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-muted">
                    {user.role === 'developer' && <ShieldAlert size={14} className="text-red-500" />}
                    {user.role === 'admin' && <ShieldCheck size={14} className="text-blue-500" />}
                    {user.role === 'agent' && <User size={14} className="text-green-500" />}
                    <span className="uppercase tracking-wider font-semibold">{user.role}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted">Dein Anzeigename</label>
                <input 
                  id="profileNameInput"
                  type="text" 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                  placeholder="z.B. Max Mustermann" 
                />
                <p className="text-xs text-muted">Dieser Name wird im Activity Log angezeigt.</p>
              </div>

              <button 
                className="w-full flex items-center justify-center rounded-lg bg-primary text-primary-foreground p-3 text-sm font-semibold hover:bg-primary/90 transition-colors"
                onClick={() => {
                  const input = document.getElementById('profileNameInput') as HTMLInputElement;
                  if (input?.value) {
                    localStorage.setItem('jarvis_user_name', input.value);
                    alert('Profil gespeichert! (Splash-Screen aktualisiert sich beim nächsten Start)');
                  }
                }}
              >
                Profil speichern
              </button>

              {isPrivileged && (
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-medium mb-3 text-muted">Administration</h3>
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary/50 p-3 text-sm font-medium transition-colors hover:bg-secondary">
                    <UserCog size={16} />
                    Benutzerverwaltung öffnen
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted">Loading profile...</div>
          )}

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
