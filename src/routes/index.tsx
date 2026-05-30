import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import CherryGrove from "@/components/CherryGrove";

const RoseViewer = lazy(() => import("@/components/RoseViewer"));
const HeartClicker = lazy(() => import("@/components/HeartClicker"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rose · Cherry Grove" },
      { name: "description", content: "Meet Rose in a dreamy Minecraft Cherry Grove. She's waiting for you." },
      { property: "og:title", content: "Rose · Cherry Grove" },
      { property: "og:description", content: "Meet Rose in a dreamy Minecraft Cherry Grove. She's waiting for you." },
    ],
  }),
  component: Index,
});

type Mood = "calm" | "happy" | "blush" | "curious" | "focused";

function Index() {
  return (
    <main className="relative w-screen h-screen overflow-hidden">
      <CherryGrove />
      <header className="absolute top-20 left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none">
        <h1 className="text-4xl md:text-5xl font-bold text-gradient drop-shadow-sm">Rose</h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1 tracking-wide">cherry grove · waiting for you</p>
      </header>
      <div className="absolute left-1/2 bottom-40 -translate-x-1/2 w-72 h-10 rounded-[50%] z-0"
           style={{ background: "radial-gradient(ellipse, oklch(0.85 0.18 10 / 0.45), transparent 70%)", filter: "blur(8px)" }} />
      <ClientOnly fallback={null}>
        <Interactive />
      </ClientOnly>
    </main>
  );
}

function Interactive() {
  const [mood, setMood] = useState<Mood>("calm");
  const idleTimer = useRef<number | null>(null);
  const lastMoodOverride = useRef(0);

  const setMoodSafe = useCallback((m: Mood) => {
    lastMoodOverride.current = Date.now();
    setMood(m);
  }, []);

  useEffect(() => {
    const reset = () => {
      if (Date.now() - lastMoodOverride.current > 4000) setMood("calm");
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        if (Date.now() - lastMoodOverride.current > 4000) setMood("curious");
      }, 15000);
    };
    const onMove = (e: PointerEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const d = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (d < 180 && Date.now() - lastMoodOverride.current > 1500) setMood("focused");
      reset();
    };
    window.addEventListener("pointermove", onMove);
    reset();
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, []);

  return (
    <>
      <div className="absolute inset-0 z-10">
        <Suspense fallback={null}>
          <RoseViewer mood={mood} />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <HeartClicker onMood={setMoodSafe} />
      </Suspense>
    </>
  );
}
