import React from "react";
import { interpolate } from "remotion";
import { COLORS, GROUND_Y, TIMELINE } from "./constants";

const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Puff: React.FC<{ delay: number; frame: number; x: number; size: number }> = ({ delay, frame, x, size }) => {
  const t = interpolate(frame, [delay, delay + 26], [0, 1], clampOpts);
  if (t <= 0) return null;
  const scale = interpolate(t, [0, 1], [0.3, 1.6]);
  const opacity = interpolate(t, [0, 0.2, 1], [0, 0.55, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: `calc(50% + ${x}px)`,
        top: GROUND_Y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: COLORS.cream,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
      }}
    />
  );
};

export const DustCloud: React.FC<{ frame: number }> = ({ frame }) => {
  const [wobbleStart] = TIMELINE.wobble;
  const [slipStart] = TIMELINE.slip;
  if (frame < wobbleStart) return null;
  return (
    <>
      <Puff frame={frame} delay={wobbleStart} x={20} size={90} />
      <Puff frame={frame} delay={wobbleStart + 6} x={-30} size={70} />
      <Puff frame={frame} delay={slipStart} x={-10} size={140} />
      <Puff frame={frame} delay={slipStart + 8} x={40} size={110} />
    </>
  );
};

const Star: React.FC<{ angle: number; radius: number; size: number; spin: number }> = ({ angle, radius, size, spin }) => {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontSize: size,
        color: COLORS.orange,
        transform: `translate(-50%, -50%) rotate(${spin}deg)`,
        textShadow: "0 2px 4px rgba(0,0,0,0.25)",
      }}
    >
      ✦
    </div>
  );
};

export const ImpactStars: React.FC<{ frame: number }> = ({ frame }) => {
  const [slipEnd] = [TIMELINE.slip[1]];
  if (frame < slipEnd) return null;
  const t = frame - slipEnd;
  return (
    <div
      style={{
        position: "absolute",
        left: "calc(50% - 30px)",
        top: GROUND_Y - 400,
      }}
    >
      {[0, 72, 144, 216, 288].map((base, i) => (
        <Star key={i} angle={base + t * 4} radius={70} size={30 + (i % 2) * 10} spin={t * 6} />
      ))}
    </div>
  );
};

export const ImpactFlash: React.FC<{ frame: number }> = ({ frame }) => {
  const [slipEnd] = [TIMELINE.slip[1]];
  const opacity = interpolate(frame, [slipEnd - 2, slipEnd, slipEnd + 6], [0, 0.85, 0], clampOpts);
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: COLORS.cream,
        opacity,
      }}
    />
  );
};

export const getShake = (frame: number): { x: number; y: number } => {
  const [slipEnd] = [TIMELINE.slip[1]];
  const t = frame - slipEnd;
  if (t < 0 || t > 12) return { x: 0, y: 0 };
  const decay = 1 - t / 12;
  return {
    x: Math.sin(t * 3.2) * 14 * decay,
    y: Math.cos(t * 4.1) * 10 * decay,
  };
};
