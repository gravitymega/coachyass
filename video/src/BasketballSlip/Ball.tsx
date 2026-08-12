import React from "react";
import { interpolate } from "remotion";
import { COLORS, GROUND_Y, TIMELINE } from "./constants";

const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const BallGraphic: React.FC<{ size: number; spin: number }> = ({ size, spin }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle at 35% 30%, #F2914E, ${COLORS.orange} 60%, ${COLORS.orangeDark})`,
      position: "relative",
      transform: `rotate(${spin}deg)`,
      boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
    }}
  >
    <div style={{ position: "absolute", top: 0, left: "48%", width: "4%", height: "100%", background: COLORS.ink, opacity: 0.55 }} />
    <div style={{ position: "absolute", left: 0, top: "48%", width: "100%", height: "4%", background: COLORS.ink, opacity: 0.55 }} />
    <div
      style={{
        position: "absolute",
        inset: 0,
        border: `${size * 0.035}px solid ${COLORS.ink}`,
        opacity: 0.35,
        borderRadius: "50%",
      }}
    />
  </div>
);

export const Ball: React.FC<{ frame: number }> = ({ frame }) => {
  const [, dribbleEnd] = TIMELINE.dribble;
  const [wobbleStart, wobbleEnd] = TIMELINE.wobble;
  const [slipStart, slipEnd] = TIMELINE.slip;

  const size = 70;

  // Held during the walk-in, not yet visible bouncing.
  if (frame < TIMELINE.walkIn[1]) {
    const x = interpolate(frame, TIMELINE.walkIn, [-380 - 70, -70], clampOpts);
    return (
      <div style={{ position: "absolute", left: `calc(50% + ${x}px)`, top: GROUND_Y - 300, transform: "translate(-50%,-50%)" }}>
        <BallGraphic size={size} spin={frame * 6} />
      </div>
    );
  }

  // Bouncing next to the player's hand while dribbling.
  if (frame < dribbleEnd) {
    const t = frame - TIMELINE.walkIn[1];
    const bounce = Math.abs(Math.sin(t * 0.5));
    const y = GROUND_Y - 40 - bounce * 260;
    return (
      <div style={{ position: "absolute", left: "calc(50% + 78px)", top: y, transform: "translate(-50%,-50%)" }}>
        <BallGraphic size={size} spin={t * 10} />
      </div>
    );
  }

  // Still bouncing, slightly wilder, as the feet start to slide.
  if (frame < wobbleEnd) {
    const t = interpolate(frame, [wobbleStart, wobbleEnd], [0, 1], clampOpts);
    const bounce = Math.abs(Math.sin((frame - TIMELINE.walkIn[1]) * 0.5));
    const y = GROUND_Y - 40 - bounce * 260;
    const x = 78 + t * 40;
    return (
      <div style={{ position: "absolute", left: `calc(50% + ${x}px)`, top: y, transform: "translate(-50%,-50%)" }}>
        <BallGraphic size={size} spin={frame * 10} />
      </div>
    );
  }

  // Launched into the air, spinning away as the player loses it completely.
  if (frame < slipEnd + 20) {
    const t = interpolate(frame, [slipStart, slipEnd + 20], [0, 1], clampOpts);
    const x = interpolate(t, [0, 1], [118, 640]);
    const y = GROUND_Y - 300 - Math.sin(t * Math.PI) * 420 + t * 120;
    const opacity = interpolate(t, [0.75, 1], [1, 0], clampOpts);
    return (
      <div style={{ position: "absolute", left: `calc(50% + ${x}px)`, top: y, transform: "translate(-50%,-50%)", opacity }}>
        <BallGraphic size={size} spin={frame * 16} />
      </div>
    );
  }

  return null;
};
