import { ReactNode } from 'react';
import { JarvisProvider } from '@/components/jarvis/JarvisContext';

export default function JarvisLayout({ children }: { children: ReactNode }) {
  // In the future, this is where we can add a Paywall or subscription check
  // const hasAccess = await checkSubscription(user.id, 'jarvis-ai');
  // if (!hasAccess) return <JarvisPaywall />;

  return (
    <JarvisProvider>
      {children}
    </JarvisProvider>
  );
}
