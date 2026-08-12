export const COLORS = {
  cream: "#F5F0E1",
  green: "#1E3A2F",
  greenDeep: "#152B22",
  orange: "#E8722C",
  orangeDark: "#C55A1E",
  ink: "#141414",
  gray: "#6d6a60",
  card: "#FFFDF7",
  border: "#E3DCC8",
  denim: "#33455E",
  denimDark: "#232F42",
  skin: "#C98A5C",
  white: "#FFFFFF",
} as const;

// Frame ranges for each beat of the gag (30fps).
export const TIMELINE = {
  walkIn: [0, 75] as const,
  dribble: [75, 140] as const,
  wobble: [140, 163] as const,
  slip: [163, 192] as const,
  fallen: [192, 232] as const,
  endCard: [222, 270] as const,
};

export const FPS = 30;
export const DURATION = 270;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const GROUND_Y = 1330;
