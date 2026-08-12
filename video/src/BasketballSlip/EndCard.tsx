import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, TIMELINE } from "./constants";

const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const EndCard: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();
  const [start] = TIMELINE.endCard;
  if (frame < start) return null;

  const local = frame - start;
  const bgOpacity = interpolate(frame, [start, start + 18], [0, 1], clampOpts);
  const pop = spring({ frame: local - 10, fps, config: { damping: 11, mass: 0.7 } });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: COLORS.green,
        opacity: bgOpacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: 60,
      }}
    >
      <div
        style={{
          fontFamily: "Arial, sans-serif",
          fontWeight: 900,
          fontSize: 64,
          color: COLORS.cream,
          textAlign: "center",
          lineHeight: 1.2,
          transform: `scale(${Math.max(0, pop)})`,
        }}
      >
        Le style, c&apos;est bien.
        <br />
        L&apos;équilibre, c&apos;est mieux. 😅
      </div>
      <div
        style={{
          fontFamily: "Arial, sans-serif",
          fontWeight: 700,
          fontSize: 34,
          color: COLORS.orange,
          opacity: interpolate(local, [22, 34], [0, 1], clampOpts),
        }}
      >
        🏀 Gravity Basketball MTL
      </div>
    </div>
  );
};
