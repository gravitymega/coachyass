import React from "react";
import { interpolate } from "remotion";
import { COLORS, GROUND_Y, TIMELINE } from "./constants";

export type Pose = {
  x: number;
  y: number;
  rotation: number;
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  headTilt: number;
  glassesOff: boolean;
  dizzy: boolean;
};

const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const getPose = (frame: number): Pose => {
  const [walkStart, walkEnd] = TIMELINE.walkIn;
  const [, dribbleEnd] = TIMELINE.dribble;
  const [, wobbleEnd] = TIMELINE.wobble;
  const [, slipEnd] = TIMELINE.slip;

  // Walk-in: strut from off-screen left to center, confident bounce.
  if (frame < walkEnd) {
    const x = interpolate(frame, [walkStart, walkEnd], [-380, 0], clampOpts);
    const bob = Math.abs(Math.sin(frame * 0.35)) * 14;
    const swing = Math.sin(frame * 0.35) * 22;
    return {
      x,
      y: -bob,
      rotation: -3,
      legL: swing,
      legR: -swing,
      armL: -swing * 0.7,
      armR: swing * 0.7,
      headTilt: -4,
      glassesOff: false,
      dizzy: false,
    };
  }

  // Dribble: cocky stance, one hand bouncing the ball.
  if (frame < dribbleEnd) {
    const t = frame - walkEnd;
    const dribbleArm = 10 + Math.sin(t * 0.5) * 35;
    return {
      x: 0,
      y: -Math.abs(Math.sin(t * 0.5)) * 4,
      rotation: -6,
      legL: -10,
      legR: 12,
      armL: -95,
      armR: dribbleArm,
      headTilt: -8,
      glassesOff: false,
      dizzy: false,
    };
  }

  // Wobble: weight shifts, front foot slides on the dust, arms fly out for balance.
  if (frame < wobbleEnd) {
    const t = interpolate(frame, TIMELINE.wobble, [0, 1], clampOpts);
    return {
      x: interpolate(t, [0, 1], [0, 14]),
      y: 0,
      rotation: interpolate(t, [0, 1], [-6, -18]),
      legL: interpolate(t, [0, 1], [-10, -55]),
      legR: interpolate(t, [0, 1], [12, 30]),
      armL: interpolate(t, [0, 1], [-95, -150]),
      armR: interpolate(t, [0, 1], [10, 140]),
      headTilt: interpolate(t, [0, 1], [-8, 6]),
      glassesOff: false,
      dizzy: false,
    };
  }

  // Slip: both feet fly up, body slams backward toward the ground.
  if (frame < slipEnd) {
    const t = interpolate(frame, TIMELINE.slip, [0, 1], clampOpts);
    const flail = Math.sin(t * Math.PI * 3) * (1 - t) * 60;
    return {
      x: interpolate(t, [0, 1], [14, -30]),
      y: interpolate(t, [0, 1], [0, -70], clampOpts) + Math.max(0, t - 0.6) * 260,
      rotation: interpolate(t, [0, 1], [-18, -95]),
      legL: interpolate(t, [0, 1], [-55, 70]) + flail,
      legR: interpolate(t, [0, 1], [30, 85]) + flail,
      armL: interpolate(t, [0, 1], [-150, -210]) + flail,
      armR: interpolate(t, [0, 1], [140, 200]) - flail,
      headTilt: interpolate(t, [0, 1], [6, 20]),
      glassesOff: t > 0.55,
      dizzy: false,
    };
  }

  // Fallen: flat on the ground, twitching, seeing stars.
  const t = frame - slipEnd;
  const twitch = Math.sin(t * 0.6) * 4;
  return {
    x: -30,
    y: 190,
    rotation: -95 + twitch,
    legL: 80 + twitch,
    legR: 90 - twitch,
    armL: -205 + twitch,
    armR: 195 - twitch,
    headTilt: 18,
    glassesOff: true,
    dizzy: true,
  };
};

const Limb: React.FC<{
  angle: number;
  originTop: number;
  originLeft: number;
  length: number;
  width: number;
  color: string;
  z: number;
}> = ({ angle, originTop, originLeft, length, width, color, z }) => (
  <div
    style={{
      position: "absolute",
      top: originTop,
      left: originLeft,
      width,
      height: length,
      background: color,
      borderRadius: width / 2,
      transformOrigin: "50% 0%",
      transform: `translateX(-50%) rotate(${angle}deg)`,
      zIndex: z,
      boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.08)",
    }}
  />
);

export const Player: React.FC<{ frame: number }> = ({ frame }) => {
  const pose = getPose(frame);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: GROUND_Y,
        width: 0,
        height: 0,
        transform: `translate(${pose.x}px, ${pose.y}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          transform: `rotate(${pose.rotation}deg)`,
          transformOrigin: "50% 100%",
        }}
      >
        {/* Legs (skinny dark-denim jeans + clean white sneakers) */}
        <Limb angle={pose.legL} originTop={-210} originLeft={-14} length={150} width={26} color={COLORS.denim} z={1} />
        <Limb angle={pose.legR} originTop={-210} originLeft={14} length={150} width={26} color={COLORS.denimDark} z={1} />

        {/* Sneakers */}
        <div
          style={{
            position: "absolute",
            top: -210,
            left: -14,
            width: 54,
            height: 24,
            borderRadius: 10,
            background: COLORS.white,
            border: `2px solid ${COLORS.orange}`,
            transformOrigin: "10% 0%",
            transform: `rotate(${pose.legL}deg) translate(90px, 8px)`,
            zIndex: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -210,
            left: 14,
            width: 54,
            height: 24,
            borderRadius: 10,
            background: COLORS.white,
            border: `2px solid ${COLORS.orange}`,
            transformOrigin: "10% 0%",
            transform: `rotate(${pose.legR}deg) translate(90px, 8px)`,
            zIndex: 2,
          }}
        />

        {/* Torso: orange jersey */}
        <div
          style={{
            position: "absolute",
            top: -350,
            left: -55,
            width: 110,
            height: 150,
            background: COLORS.orange,
            borderRadius: "30px 30px 18px 18px",
            zIndex: 3,
            boxShadow: "inset 0 0 0 3px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 46,
              left: "50%",
              transform: "translateX(-50%)",
              color: COLORS.greenDeep,
              fontFamily: "Arial, sans-serif",
              fontWeight: 900,
              fontSize: 46,
            }}
          >
            23
          </div>
        </div>

        {/* Arms */}
        <Limb angle={pose.armL} originTop={-345} originLeft={-52} length={130} width={24} color={COLORS.skin} z={4} />
        <Limb angle={pose.armR} originTop={-345} originLeft={52} length={130} width={24} color={COLORS.skin} z={4} />

        {/* Head */}
        <div
          style={{
            position: "absolute",
            top: -455,
            left: -46,
            width: 92,
            height: 92,
            borderRadius: "50%",
            background: COLORS.skin,
            transform: `rotate(${pose.headTilt}deg)`,
            zIndex: 5,
            boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.06)",
          }}
        >
          {/* Cap */}
          <div
            style={{
              position: "absolute",
              top: -14,
              left: -4,
              width: 100,
              height: 40,
              background: COLORS.green,
              borderRadius: "50px 50px 0 0",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 78,
              width: 40,
              height: 14,
              background: COLORS.green,
              borderRadius: 6,
            }}
          />

          {!pose.glassesOff ? (
            <div
              style={{
                position: "absolute",
                top: 38,
                left: 6,
                width: 80,
                height: 24,
                background: COLORS.ink,
                borderRadius: 8,
              }}
            />
          ) : pose.dizzy ? (
            <div
              style={{
                position: "absolute",
                top: 40,
                left: 10,
                fontSize: 26,
                lineHeight: 1,
              }}
            >
              @ @
            </div>
          ) : (
            <>
              <div
                style={{
                  position: "absolute",
                  top: 42,
                  left: 18,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: COLORS.ink,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 42,
                  left: 58,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: COLORS.ink,
                }}
              />
            </>
          )}

          {/* Mouth: smug smirk vs. shocked "oh" */}
          <div
            style={{
              position: "absolute",
              top: 66,
              left: 34,
              width: pose.dizzy ? 16 : 24,
              height: pose.dizzy ? 16 : 6,
              borderRadius: pose.dizzy ? "50%" : 4,
              background: COLORS.greenDeep,
            }}
          />
        </div>
      </div>
    </div>
  );
};
