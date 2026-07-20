"use client";

import { useEffect, useState } from "react";

export default function EcosystemLoader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Keep it extremely short to just mask hydration/layout jumps
    const timer = setTimeout(() => {
      setLoading(false);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  if (!loading) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--color-bg-base, #000)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "opacity 0.2s ease-out",
        opacity: loading ? 1 : 0,
      }}
    >
      <style>{`
        .global-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          border-top-color: #fff;
          animation: global-spin 1s ease-in-out infinite;
        }
        @keyframes global-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="global-spinner" />
    </div>
  );
}
