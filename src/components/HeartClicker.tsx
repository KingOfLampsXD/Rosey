import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Volume2, VolumeX, Sparkles } from "lucide-react";

type Mood = "calm" | "happy" | "blush" | "curious" | "focused";

interface Upgrade {
  id: string; name: string; emoji: string; baseCost: number; power: number; desc: string;
}
const UPGRADES: Upgrade[] = [
  { id: "flower",    name: "Flower",         emoji: "🌸", baseCost: 15,     power: 0.1,  desc: "+0.1 hearts/sec" },
  { id: "chocolate", name: "Chocolate",      emoji: "🍫", baseCost: 100,    power: 1,    desc: "+1 hearts/sec" },
  { id: "teddy",     name: "Teddy Bear",     emoji: "🧸", baseCost: 600,    power: 6,    desc: "+6 hearts/sec" },
  { id: "ribbon",    name: "Ribbon",         emoji: "🎀", baseCost: 3500,   power: 30,   desc: "+30 hearts/sec" },
  { id: "bouquet",   name: "Bouquet",        emoji: "🌹", baseCost: 18000,  power: 150,  desc: "+150 hearts/sec" },
  { id: "letter",    name: "Love Letter",    emoji: "💌", baseCost: 90000,  power: 700,  desc: "+700 hearts/sec" },
  { id: "moon",      name: "Moon Date",      emoji: "🌙", baseCost: 450000, power: 3200, desc: "+3.2k hearts/sec" },
  { id: "blessing",  name: "Cherry Blessing",emoji: "✨", baseCost: 2_300_000, power: 14000, desc: "+14k hearts/sec" },
  { id: "eternal",   name: "Eternal Rose",   emoji: "💍", baseCost: 12_000_000, power: 70000, desc: "+70k hearts/sec" },
];

const MILESTONES: { at: number; label: string; toast: string; mood: Mood }[] = [
  { at: 100,     label: "Rose waves",                  toast: "Rose waves at you 👋", mood: "happy" },
  { at: 500,     label: "Rose says hello",             toast: "Rose: \"hello!\" 🌸",  mood: "happy" },
  { at: 1000,    label: "Rose smiles",                 toast: "Rose smiles softly ☺️", mood: "happy" },
  { at: 5000,    label: "Cherry blossom celebration",  toast: "Petals swirl around Rose 🌸✨", mood: "blush" },
  { at: 10000,   label: "Special animation",           toast: "Rose twirls just for you 💖", mood: "blush" },
  { at: 50000,   label: "Secret scene",                toast: "A secret unfolds under the moon 🌙", mood: "blush" },
  { at: 100000,  label: "Legendary",                   toast: "Legendary bond achieved 💍", mood: "blush" },
];

interface SaveState {
  hearts: number;
  totalHearts: number;
  clicks: number;
  owned: Record<string, number>;
  unlockedMs: number[];
  prestige: number;
  lastSeen: number;
  lastDaily: number;
}

const KEY = "rose-grove-save-v1";

function loadSave(): SaveState {
  if (typeof window === "undefined") return defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    return { ...defaultSave(), ...JSON.parse(raw) };
  } catch { return defaultSave(); }
}
function defaultSave(): SaveState {
  return { hearts: 0, totalHearts: 0, clicks: 0, owned: {}, unlockedMs: [], prestige: 0, lastSeen: Date.now(), lastDaily: 0 };
}

function fmt(n: number): string {
  if (n < 1000) return n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, "");
  const units = ["", "k", "M", "B", "T", "Qa", "Qi"];
  let i = 0; let v = n;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0) + units[i];
}

export default function HeartClicker({ onMood }: { onMood: (m: Mood) => void }) {
  const [state, setState] = useState<SaveState>(() => loadSave());
  const [combo, setCombo] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [floaters, setFloaters] = useState<{ id: number; x: number; y: number; v: number; dx: number }[]>([]);
  const comboTimer = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ambientRef = useRef<{ stop: () => void } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const prestigeMult = 1 + state.prestige * 0.25;
  const hps = useMemo(() => {
    let s = 0;
    for (const u of UPGRADES) s += (state.owned[u.id] || 0) * u.power;
    return s * prestigeMult;
  }, [state.owned, prestigeMult]);

  const perClick = useMemo(() => {
    const base = 1 + (state.owned["flower"] || 0) * 0.05;
    const comboMult = 1 + Math.min(combo, 50) * 0.04;
    return base * comboMult * prestigeMult;
  }, [state.owned, combo, prestigeMult]);

  // Persist
  useEffect(() => {
    const t = setInterval(() => {
      const s = { ...stateRef.current, lastSeen: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(s));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // Offline progression
  useEffect(() => {
    const elapsed = Math.min(60 * 60 * 8, (Date.now() - state.lastSeen) / 1000);
    if (elapsed > 30 && hps > 0) {
      const gained = elapsed * hps * 0.4;
      setState(s => ({ ...s, hearts: s.hearts + gained, totalHearts: s.totalHearts + gained }));
      showToast(`While you were away: +${fmt(gained)} 💖`);
    }
    // Daily reward
    const daysSince = (Date.now() - (state.lastDaily || 0)) / 86400000;
    if (daysSince >= 1) {
      const bonus = 50 * Math.max(1, state.prestige + 1);
      setState(s => ({ ...s, hearts: s.hearts + bonus, totalHearts: s.totalHearts + bonus, lastDaily: Date.now() }));
      setTimeout(() => showToast(`Daily gift: +${fmt(bonus)} 💖`), 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // HPS tick
  useEffect(() => {
    if (hps <= 0) return;
    const t = setInterval(() => {
      setState(s => ({ ...s, hearts: s.hearts + hps / 10, totalHearts: s.totalHearts + hps / 10 }));
    }, 100);
    return () => clearInterval(t);
  }, [hps]);

  // Milestones
  useEffect(() => {
    for (const m of MILESTONES) {
      if (state.totalHearts >= m.at && !state.unlockedMs.includes(m.at)) {
        setState(s => ({ ...s, unlockedMs: [...s.unlockedMs, m.at] }));
        showToast(m.toast);
        onMood(m.mood);
        setTimeout(() => onMood("calm"), 4500);
      }
    }
  }, [state.totalHearts, state.unlockedMs, onMood]);

  // Mood from interaction patterns
  useEffect(() => {
    if (combo > 12) onMood("happy");
    else if (combo > 4) onMood("focused");
  }, [combo, onMood]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(t => (t === msg ? null : t)), 3200);
  }

  function ensureAudio() {
    if (audioCtxRef.current) return audioCtxRef.current;
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      audioCtxRef.current = new Ctx();
    } catch { /* ignore */ }
    return audioCtxRef.current;
  }

  function playChime() {
    if (muted) return;
    const ctx = ensureAudio(); if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99];
    const f = freqs[Math.floor(Math.random() * freqs.length)] * (1 + Math.min(combo, 20) * 0.02);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = f;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.42);
  }

  function startAmbient() {
    if (ambientRef.current || muted) return;
    const ctx = ensureAudio(); if (!ctx) return;
    // gentle pink-noise wind via filtered noise
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const out = noiseBuffer.getChannelData(0);
    let b0 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.97 * b0 + white * 0.03;
      out[i] = b0 * 3;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer; noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;
    const gain = ctx.createGain(); gain.gain.value = 0.04;
    noise.connect(lp).connect(gain).connect(ctx.destination);
    noise.start();
    ambientRef.current = { stop: () => { try { noise.stop(); } catch {} } };
  }
  function stopAmbient() {
    ambientRef.current?.stop(); ambientRef.current = null;
  }
  useEffect(() => {
    if (muted) stopAmbient();
    return () => stopAmbient();
  }, [muted]);

  function handleClick(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Math.random();
    setFloaters(f => [...f, { id, x, y, v: perClick, dx: -30 + Math.random() * 60 }].slice(-30));
    setTimeout(() => setFloaters(f => f.filter(p => p.id !== id)), 1100);

    setState(s => ({
      ...s,
      hearts: s.hearts + perClick,
      totalHearts: s.totalHearts + perClick,
      clicks: s.clicks + 1,
    }));
    setCombo(c => c + 1);
    if (comboTimer.current) window.clearTimeout(comboTimer.current);
    comboTimer.current = window.setTimeout(() => setCombo(0), 1400);

    startAmbient();
    playChime();
  }

  function costOf(u: Upgrade) {
    const n = state.owned[u.id] || 0;
    return Math.ceil(u.baseCost * Math.pow(1.15, n));
  }

  function buy(u: Upgrade) {
    const cost = costOf(u);
    if (state.hearts < cost) return;
    setState(s => ({ ...s, hearts: s.hearts - cost, owned: { ...s.owned, [u.id]: (s.owned[u.id] || 0) + 1 } }));
    onMood("blush"); setTimeout(() => onMood("calm"), 1800);
  }

  function prestige() {
    if (state.totalHearts < 1_000_000) return;
    if (!confirm("Prestige? Reset progress for a permanent +25% multiplier per level.")) return;
    setState(s => ({ ...defaultSave(), prestige: s.prestige + 1, lastDaily: s.lastDaily }));
    showToast("Cherry Bloom! +25% forever 🌸");
  }

  const achievements = [
    { id: "first",  done: state.clicks >= 1,        label: "First touch" },
    { id: "c100",   done: state.clicks >= 100,      label: "100 clicks" },
    { id: "h1k",    done: state.totalHearts >= 1000, label: "1,000 hearts" },
    { id: "h1m",    done: state.totalHearts >= 1_000_000, label: "1M hearts" },
    { id: "combo",  done: combo >= 25 || state.totalHearts >= 10_000, label: "25 combo" },
    { id: "pres",   done: state.prestige >= 1,      label: "Prestiged" },
  ];

  return (
    <>
      {/* Floating toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass px-5 py-3 rounded-full text-sm font-semibold"
             style={{ animation: "fade-in 0.3s ease-out" }}>
          {toast}
        </div>
      )}

      {/* Top bar */}
      <div className="fixed top-4 left-4 right-4 z-40 flex justify-between items-start gap-3 pointer-events-none">
        <div className="glass rounded-2xl px-4 py-2.5 pointer-events-auto">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary fill-primary" />
            <span className="text-xl font-bold text-gradient">{fmt(state.hearts)}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {fmt(hps)}/s · {perClick.toFixed(1)}/click
            {state.prestige > 0 && <span className="ml-2">🌸 ×{prestigeMult.toFixed(2)}</span>}
          </div>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <button onClick={() => setMuted(m => !m)} aria-label="Toggle sound"
                  className="glass rounded-full w-10 h-10 flex items-center justify-center hover:scale-105 transition">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Central click target — invisible, sits over Rose's body area */}
      <button
        onClick={handleClick}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[55%] w-[280px] h-[420px] z-20 cursor-pointer"
        style={{ background: "transparent" }}
        aria-label="Give Rose a heart"
      >
        {floaters.map(f => (
          <span key={f.id} className="absolute pointer-events-none select-none font-bold text-2xl"
                style={{
                  left: f.x, top: f.y,
                  transform: "translate(-50%, 0)",
                  color: "oklch(0.65 0.22 10)",
                  textShadow: "0 2px 8px oklch(0.5 0.2 350 / 0.5)",
                  animation: "float-up 1s ease-out forwards",
                  ["--dx" as any]: `${f.dx}px`,
                }}>
            +{fmt(f.v)} ❤
          </span>
        ))}
      </button>

      {/* Visible heart button below Rose */}
      <div className="absolute left-1/2 bottom-32 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
        <button
          onClick={handleClick}
          className="heart-btn pointer-events-auto w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white"
        >
          <Heart className="w-9 h-9 fill-white text-white drop-shadow" />
        </button>
        {combo > 2 && (
          <div className="glass rounded-full px-3 py-1 text-xs font-bold pointer-events-auto"
               style={{ animation: "bounce-soft 0.6s ease-in-out infinite" }}>
            <Sparkles className="inline w-3 h-3 mr-1" />
            Combo ×{combo}
          </div>
        )}
      </div>

      {/* Bottom shop */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
        <div className="mx-auto max-w-5xl px-4 pb-4 pointer-events-auto">
          <div className="glass rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-bold text-gradient">Gifts for Rose</h3>
              <button onClick={prestige}
                      disabled={state.totalHearts < 1_000_000}
                      className="text-xs font-semibold px-3 py-1 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "var(--gradient-heart)", color: "white" }}>
                Cherry Bloom (Prestige)
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {UPGRADES.map(u => {
                const cost = costOf(u);
                const owned = state.owned[u.id] || 0;
                const can = state.hearts >= cost;
                return (
                  <button key={u.id} onClick={() => buy(u)} disabled={!can}
                          className="shrink-0 w-32 text-left rounded-xl p-2.5 transition border"
                          style={{
                            background: can ? "oklch(1 0 0 / 0.6)" : "oklch(1 0 0 / 0.3)",
                            borderColor: can ? "oklch(0.78 0.16 350 / 0.6)" : "transparent",
                            opacity: can ? 1 : 0.55,
                          }}>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{u.emoji}</span>
                      <span className="text-[10px] font-bold text-muted-foreground">×{owned}</span>
                    </div>
                    <div className="text-xs font-bold mt-1 truncate">{u.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{u.desc}</div>
                    <div className="text-[11px] font-semibold mt-1 text-primary">{fmt(cost)} 💖</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Side: achievements + milestones */}
      <div className="hidden md:block fixed top-24 right-4 z-30 w-56 space-y-2 pointer-events-none">
        <div className="glass rounded-2xl p-3 pointer-events-auto">
          <h4 className="text-xs font-bold text-gradient mb-2">Achievements</h4>
          <ul className="space-y-1">
            {achievements.map(a => (
              <li key={a.id} className={`text-xs flex items-center gap-2 ${a.done ? "" : "opacity-40"}`}>
                <span>{a.done ? "🌸" : "·"}</span>
                <span>{a.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass rounded-2xl p-3 pointer-events-auto">
          <h4 className="text-xs font-bold text-gradient mb-2">Milestones</h4>
          <ul className="space-y-1">
            {MILESTONES.map(m => {
              const got = state.unlockedMs.includes(m.at);
              return (
                <li key={m.at} className={`text-xs flex items-center justify-between gap-2 ${got ? "" : "opacity-50"}`}>
                  <span>{got ? "💖" : "·"} {m.label}</span>
                  <span className="text-[10px] text-muted-foreground">{fmt(m.at)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
