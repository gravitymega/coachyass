import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Court } from "./Court";
import { Player } from "./Player";
import { Ball } from "./Ball";
import { DustCloud, ImpactStars, ImpactFlash, getShake } from "./Effects";
import { Caption } from "./Caption";
import { EndCard } from "./EndCard";
import { TIMELINE } from "./constants";

export const BasketballSlip: React.FC = () => {
  const frame = useCurrentFrame();
  const shake = getShake(frame);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `translate(${shake.x}px, ${shake.y}px)` }}>
        <Court />
        <DustCloud frame={frame} />
        <Player frame={frame} />
        <Ball frame={frame} />
        <ImpactStars frame={frame} />
        <ImpactFlash frame={frame} />
      </AbsoluteFill>

      <Caption
        frame={frame}
        from={TIMELINE.walkIn[0] + 8}
        to={TIMELINE.dribble[0] + 8}
        text="Nouveau sur le terrain 😎"
      />
      <Caption
        frame={frame}
        from={TIMELINE.dribble[0] + 10}
        to={TIMELINE.wobble[0] + 4}
        text="Regarde-moi ça..."
      />
      <Caption
        frame={frame}
        from={TIMELINE.slip[1] + 2}
        to={TIMELINE.fallen[1] - 4}
        text="Oups... 💥"
      />

      <EndCard frame={frame} />
    </AbsoluteFill>
  );
};
