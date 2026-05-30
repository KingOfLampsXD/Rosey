import { useEffect, useRef } from "react";
import * as skinview3d from "skinview3d";

type Mood = "calm" | "happy" | "blush" | "curious" | "focused";

interface Props {
  mood: Mood;
  onReady?: () => void;
}

// Rose stands centered, full body, facing the viewer.
// Head + eyes track the cursor via real 3D bone rotation (no overlays).
export default function RoseViewer({ mood }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<skinview3d.SkinViewer | null>(null);
  const moodRef = useRef<Mood>(mood);

  useEffect(() => { moodRef.current = mood; }, [mood]);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const viewer = new skinview3d.SkinViewer({
      width: mount.clientWidth,
      height: mount.clientHeight,
      skin: "/rose.png",
      enableControls: false,
      background: undefined,
      preserveDrawingBuffer: false,
    });
    viewer.canvas.style.display = "block";
    viewer.canvas.style.width = "100%";
    viewer.canvas.style.height = "100%";
    mount.appendChild(viewer.canvas);

    // Face the viewer, perfectly centered
    viewer.playerObject.rotation.y = 0;
    viewer.camera.position.set(0, 0, 55);
    viewer.playerObject.position.y = -2;
    viewer.zoom = 0.78;

    // Soft, warm sunset lighting (skinview3d exposes globalLight + cameraLight)
    viewer.globalLight.intensity = 1.05;
    viewer.cameraLight.intensity = 0.55;

    // Disable any built-in walking
    viewer.animation = null;

    viewerRef.current = viewer;

    const player = viewer.playerObject;
    const head = player.skin.head;
    const body = player.skin.body;
    const leftArm = player.skin.leftArm;
    const rightArm = player.skin.rightArm;

    // Arms relaxed at sides (default skinview3d already does this, just ensure)
    leftArm.rotation.set(0, 0, 0);
    rightArm.rotation.set(0, 0, 0);

    // Cursor tracking — normalized [-1, 1] from center of viewport
    const target = { x: 0, y: 0 };
    let lastMove = performance.now();
    const onPointer = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
      lastMove = performance.now();
    };
    const onLeave = () => { target.x = 0; target.y = 0; };
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("pointerleave", onLeave);
    document.addEventListener("mouseleave", onLeave);

    // Smoothed values
    const cur = { x: 0, y: 0 };
    let blinkT = 0;
    let nextBlink = 2 + Math.random() * 3;
    let breathT = 0;
    let tiltT = Math.random() * 10;
    const start = performance.now();

    const tick = () => {
      const now = performance.now();
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - (tick as any)._last || now) / 1000);
      (tick as any)._last = now;

      // Idle drift if cursor inactive
      const idleSec = (now - lastMove) / 1000;
      const idle = idleSec > 4;
      if (idle) {
        target.x = Math.sin(t * 0.3) * 0.15;
        target.y = Math.sin(t * 0.21) * 0.08;
      }

      // Smooth toward target
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;

      // Head rotation: yaw follows x, pitch follows y. Clamped, natural range.
      const yaw = -cur.x * 0.55;
      const pitch = cur.y * 0.35;
      // Subtle head tilt that wanders
      tiltT += dt;
      const tilt = Math.sin(tiltT * 0.4) * 0.04;

      head.rotation.y = yaw;
      head.rotation.x = pitch;
      head.rotation.z = tilt;

      // Upper torso: slight counter-rotation for life
      body.rotation.y = yaw * 0.12;

      // Breathing — gentle vertical scale + body bob
      breathT += dt;
      const breath = Math.sin(breathT * 1.6) * 0.012;
      body.scale.y = 1 + breath;
      player.position.y = -2 + Math.sin(breathT * 1.6) * 0.25;

      // Tiny weight shifting (hip sway)
      player.rotation.z = Math.sin(breathT * 0.5) * 0.012;

      // Subtle arm sway
      leftArm.rotation.x = Math.sin(breathT * 1.6) * 0.04;
      rightArm.rotation.x = -Math.sin(breathT * 1.6) * 0.04;

      // Blinking — squash head scaleY briefly (skin texture blink illusion)
      blinkT += dt;
      if (blinkT > nextBlink) {
        const into = blinkT - nextBlink;
        const dur = 0.14;
        if (into < dur) {
          const k = Math.sin((into / dur) * Math.PI);
          head.scale.y = 1 - k * 0.18;
        } else {
          head.scale.y = 1;
          blinkT = 0;
          nextBlink = 2.5 + Math.random() * 3.5;
        }
      } else {
        head.scale.y = 1;
      }

      // Mood reactions
      const m = moodRef.current;
      if (m === "happy" || m === "blush") {
        // Gentle bounce
        player.position.y += Math.abs(Math.sin(breathT * 4)) * 0.4;
      }
      if (m === "focused") {
        // Lean very slightly forward
        body.rotation.x = 0.06;
        head.rotation.x = pitch + 0.04;
      } else {
        body.rotation.x = 0;
      }
      if (m === "curious") {
        head.rotation.z = tilt + 0.12;
      }
    };

    let raf = 0;
    const loop = () => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onResize = () => {
      if (!mount) return;
      viewer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("mouseleave", onLeave);
      viewer.dispose();
      if (viewer.canvas.parentNode) viewer.canvas.parentNode.removeChild(viewer.canvas);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
}
