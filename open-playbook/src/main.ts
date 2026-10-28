// Phase 1 : page d'attente. Le site complet (bibliothèque, fiches, éditeur) arrive en phase 2.
import "@fontsource/barlow/400.css";
import "@fontsource/barlow-condensed/700.css";
import "./style.css";
import library from "../data/tactics.json";
import type { Library } from "./engine";

const lib = library as Library;
const animated = lib.tactics.filter((t) => t.steps?.length).length;
document.querySelector("#status")!.textContent =
  `${lib.tactics.length} fiches, dont ${animated} animées · ${lib.tactics.length} cards, ${animated} animated`;
