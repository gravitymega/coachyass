import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "./constants";

const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Caption: React.FC<{
  frame: number;
  from: number;
  to: number;
  text: string;
  align?: "top" | "bottom";
}> = ({ frame, from, to, text, align = "bottom" }) => {
  const { fps } = useVideoConfig();
  const localFrame = frame - from;
  if (frame < from || frame > to) return null;

  const enter = spring({ frame: localFrame, fps, config: { damping: 12, mass: 0.6 } });
  const exit = interpolate(frame, [to - 10, to], [1, 0], clampOpts);
  const opacity = Math.min(enter, exit);
  const scale = interpolate(enter, [0, 1], [0.85, 1]);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        [align === "bottom" ? "bottom" : "top"]: align === "bottom" ? 220 : 140,
        transform: `translateX(-50%) scale(${scale})`,
        opacity,
        background: COLORS.card,
        color: COLORS.greenDeep,
        padding: "20px 34px",
        borderRadius: 20,
        border: `4px solid ${COLORS.orange}`,
        fontFamily: "Arial, sans-serif",
        fontWeight: 800,
        fontSize: 46,
        textAlign: "center",
        maxWidth: 880,
        boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
      }}
    >
      {text}
    </div>
  );
};
