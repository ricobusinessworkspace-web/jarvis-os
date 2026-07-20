"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function EcosystemLoader() {
  const [phase, setPhase] = useState<"text" | "logo" | "done">("text");
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    // Read from localStorage (safely on client side)
    const storedName = localStorage.getItem("jarvis_user_name");
    if (storedName) {
      setUserName(storedName);
    }

    // Sequence timing
    const textTimer = setTimeout(() => {
      setPhase("logo");
    }, 1800); // text shows for 1.8s

    const logoTimer = setTimeout(() => {
      setPhase("done");
    }, 3000); // total 3s

    return () => {
      clearTimeout(textTimer);
      clearTimeout(logoTimer);
    };
  }, []);

  if (phase === "done") return null;

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
        transition: "opacity 0.6s ease-out",
        opacity: 1,
      }}
    >
      <style>{`
        @keyframes textFadeInOut {
          0% { opacity: 0; transform: scale(0.95); }
          20% { opacity: 1; transform: scale(1); }
          80% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.05); }
        }
        @keyframes logoFadeInPulse {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes ecosystemPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>

      {phase === "text" && (
        <div
          style={{
            position: "absolute",
            fontSize: "24px",
            fontWeight: 600,
            color: "#fff",
            animation: "textFadeInOut 1.8s ease-in-out forwards",
          }}
        >
          {userName ? `Welcome ${userName}` : "Welcome"}
        </div>
      )}

      {phase === "logo" && (
        <div
          style={{
            width: 100,
            height: 100,
            position: "relative",
            animation: "logoFadeInPulse 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards, ecosystemPulse 2s cubic-bezier(0.4, 0, 0.6, 1) 0.6s infinite",
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
      )}
    </div>
  );
}
