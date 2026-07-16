"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function EcosystemLoader() {
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Simulate a brief loading state for the ecosystem feel, 
    // or tie it to an actual global state if desired.
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted || !loading) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--color-bg-base)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "opacity 0.4s ease-out",
        opacity: loading ? 1 : 0,
      }}
    >
      <div
        style={{
          width: 100,
          height: 100,
          position: "relative",
          animation: "ecosystemPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
      >
        <Image
          src="/apple-touch-icon.png"
          alt="Jarvis OS Loader"
          fill
          style={{ borderRadius: 22, objectFit: "cover" }}
          priority
        />
      </div>
    </div>
  );
}
