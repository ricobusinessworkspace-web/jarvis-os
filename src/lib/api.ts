// Central API Interface for Desktop/Web environments
export const api = {
  // WebAuthn / TouchID Fallback handling
  promptTouchID: async (message: string) => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      return await (window as any).electronAPI.promptTouchID(message);
    }
    // Web Fallback (WebAuthn)
    console.log('WebAuthn / Passkey Fallback for Web App');
    if (!window.PublicKeyCredential) {
      throw new Error("WebAuthn is not supported on this device.");
    }
    return { success: true, message: "Passkey mock success" };
  },

  // Developer Unlock Bootstrapper
  unlockDeveloper: async () => {
    try {
      const res = await fetch('/api/auth/developer-unlock', { method: 'POST' });
      if (res.ok) {
        return true;
      }
      return false;
    } catch (err) {
      console.error("Developer unlock failed:", err);
      return false;
    }
  }
};
