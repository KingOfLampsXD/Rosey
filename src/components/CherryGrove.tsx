import { useEffect, useState } from "react";

interface Petal { id: number; left: number; delay: number; dur: number; size: number; drift: number; }

export default function CherryGrove() {
  const [petals, setPetals] = useState<Petal[]>([]);

  useEffect(() => {
    const arr: Petal[] = Array.from({ length: 38 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 14,
      dur: 10 + Math.random() * 10,
      size: 8 + Math.random() * 12,
      drift: -120 + Math.random() * 240,
    }));
    setPetals(arr);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Sky gradient + warm sun bloom */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(circle at 70% 25%, oklch(0.92 0.12 50 / 0.85) 0%, transparent 45%), radial-gradient(circle at 20% 70%, oklch(0.85 0.15 350 / 0.5) 0%, transparent 55%)"
      }} />

      {/* Distant cherry trees silhouette layers (parallax) */}
      <div className="absolute inset-x-0 bottom-0 h-[55%]" style={{
        background: "radial-gradient(ellipse at 15% 100%, oklch(0.78 0.14 350 / 0.55), transparent 60%), radial-gradient(ellipse at 85% 100%, oklch(0.82 0.12 10 / 0.55), transparent 60%), radial-gradient(ellipse at 50% 110%, oklch(0.7 0.16 340 / 0.7), transparent 65%)"
      }} />

      {/* Ground mist */}
      <div className="absolute inset-x-0 bottom-0 h-40" style={{
        background: "linear-gradient(to top, oklch(0.95 0.04 350 / 0.7), transparent)"
      }} />

      {/* Hanging lanterns */}
      {[
        { left: "8%", top: "12%", delay: "0s" },
        { left: "18%", top: "22%", delay: "1.2s" },
        { left: "82%", top: "10%", delay: "0.6s" },
        { left: "92%", top: "20%", delay: "1.8s" },
      ].map((l, i) => (
        <div key={i} className="absolute" style={{ left: l.left, top: l.top, transformOrigin: "top center", animation: `lantern-sway 4.5s ease-in-out ${l.delay} infinite` }}>
          <div className="w-px h-12 mx-auto bg-foreground/20" />
          <div className="w-7 h-9 rounded-md" style={{
            background: "linear-gradient(180deg, oklch(0.85 0.18 30), oklch(0.7 0.22 20))",
            boxShadow: "0 0 24px oklch(0.85 0.2 25 / 0.7), inset 0 -4px 6px oklch(0.5 0.18 15 / 0.4)"
          }} />
        </div>
      ))}

      {/* Glowing orbs */}
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="absolute rounded-full" style={{
          left: `${(i * 7.3 + 5) % 95}%`,
          top: `${20 + ((i * 13) % 60)}%`,
          width: 4 + (i % 4) * 2,
          height: 4 + (i % 4) * 2,
          background: "oklch(0.95 0.1 30 / 0.9)",
          boxShadow: "0 0 16px oklch(0.9 0.15 25 / 0.9)",
          animation: `glow-orb ${4 + (i % 5)}s ease-in-out ${i * 0.3}s infinite`,
        }} />
      ))}

      {/* Falling petals */}
      {petals.map(p => (
        <div key={p.id} className="absolute top-0" style={{
          left: `${p.left}%`,
          width: p.size,
          height: p.size * 0.7,
          background: "radial-gradient(ellipse, oklch(0.92 0.1 10), oklch(0.78 0.16 350))",
          borderRadius: "60% 40% 60% 40% / 70% 60% 40% 30%",
          opacity: 0.85,
          animation: `petal-fall ${p.dur}s linear ${p.delay}s infinite`,
          ["--drift" as any]: `${p.drift}px`,
          filter: "drop-shadow(0 2px 3px oklch(0.6 0.1 350 / 0.3))",
        }} />
      ))}

      {/* Vignette */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at center, transparent 55%, oklch(0.5 0.12 340 / 0.45) 100%)"
      }} />
    </div>
  );
}
