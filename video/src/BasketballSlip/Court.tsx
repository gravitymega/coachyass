import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, GROUND_Y } from "./constants";

export const Court: React.FC = () => {
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(rgba(245,240,225,.08) 2px, transparent 2px), linear-gradient(160deg, ${COLORS.green} 55%, ${COLORS.greenDeep})`,
          backgroundSize: "28px 28px, cover",
        }}
      />

      {/* Backboard + hoop */}
      <div
        style={{
          position: "absolute",
          top: 170,
          left: "50%",
          transform: "translateX(-50%)",
          width: 260,
          height: 170,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 210,
            height: 130,
            background: COLORS.cream,
            border: `6px solid ${COLORS.ink}`,
            borderRadius: 10,
            opacity: 0.92,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 100,
            left: "50%",
            transform: "translateX(-50%)",
            width: 90,
            height: 14,
            borderRadius: 8,
            background: COLORS.orange,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 112,
            left: "50%",
            transform: "translateX(-50%)",
            width: 90,
            height: 46,
            borderBottom: `4px solid ${COLORS.cream}`,
            borderLeft: `4px solid ${COLORS.cream}`,
            borderRight: `4px solid ${COLORS.cream}`,
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            opacity: 0.6,
          }}
        />
      </div>

      {/* Ground / free-throw line */}
      <div
        style={{
          position: "absolute",
          top: GROUND_Y,
          left: 0,
          right: 0,
          height: 4,
          background: "rgba(245,240,225,0.25)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: GROUND_Y,
          left: "50%",
          transform: "translateX(-50%)",
          width: 420,
          height: 210,
          borderTop: "4px solid rgba(245,240,225,0.25)",
          borderLeft: "4px solid rgba(245,240,225,0.25)",
          borderRight: "4px solid rgba(245,240,225,0.25)",
          borderTopLeftRadius: 210,
          borderTopRightRadius: 210,
        }}
      />

      {/* Dusty court texture */}
      <AbsoluteFill
        style={{
          top: GROUND_Y,
          background:
            "repeating-linear-gradient(100deg, rgba(232,114,44,0.06) 0px, rgba(232,114,44,0.06) 2px, transparent 2px, transparent 26px)",
        }}
      />
    </AbsoluteFill>
  );
};
