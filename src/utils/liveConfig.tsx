import { Mode } from "../types";

// All tunables for the live decision layer (clean-frame gate, settled-position
// detector, two-tier commit, observation resync). Times are in milliseconds so
// behaviour is independent of the camera / rAF frame rate.
export const LIVE_CONFIG = {
  // --- Clean-frame / occlusion gate -------------------------------------
  // A detection counts towards the per-frame square census when its best
  // class score is at least this high.
  detectionConf: 0.5,
  // EMA weight for the rolling baseline of "how many squares have a
  // confident detection". Small = slow-adapting baseline.
  baselineEmaAlpha: 0.05,
  // A frame is "turbulent" (hand / occlusion) when the confident-detection
  // count drops below the baseline by max(turbulenceMinDrop,
  // turbulenceDropRatio * baseline).
  turbulenceMinDrop: 3,
  turbulenceDropRatio: 0.25,
  // Safety valve: if every frame has looked turbulent for this long, accept
  // the new reality (e.g. the board really was cleared) and re-learn the
  // baseline. Keeps the "display always converges" invariant.
  turbulenceMaxMs: 6000,

  // --- State smoothing -----------------------------------------------------
  // Half-life of the rolling 64x12 probability grid, in wall-clock time.
  // (The old code used 0.5 per *frame*, which meant almost no smoothing at
  // 60fps and heavy smoothing at 10fps.) Smaller = snappier, larger =
  // steadier against detector flicker.
  stateHalfLifeMs: 120,

  // --- Settled-position detector -----------------------------------------
  // The smoothed state must produce an identical per-square argmax for this
  // long (clean frames only) before any commit decision is taken.
  settleMs: 400,
  // ... and at least this many consecutive clean frames (guards very low FPS).
  minCleanFrames: 3,
  // Extra dwell before the single-move ("greedy") path commits: the move
  // must stay the best-scoring hypothesis this long. It stacks on top of
  // settleMs, so it can be short — the settle gate already provides the
  // stability the original 1s dwell was for.
  greedyDwellMs: 400,
  // A move only commits when its score beats every other candidate move's
  // score by at least this margin. Ambiguity (two knights reaching the same
  // square, similar-looking rook moves) becomes a short wait instead of a
  // possible wrong move.
  commitMargin: 0.1,
  // A square is "occupied by class j" in the settle signature / FEN
  // assignment when state[square][j] >= pieceConf, and "confidently empty"
  // when every class is <= emptyConf. In between it is "unknown": treated
  // as a wildcard in settle/mismatch checks, and keeping its currently
  // displayed piece during a resync (a confidence dropout must not delete
  // a piece from the display or restart the settle timer).
  pieceConf: 0.3,
  emptyConf: 0.15,

  // --- Observation resync (fallback tier) --------------------------------
  // A settled position that mismatches the displayed board and is not
  // explained by any committed move for this long triggers a resync.
  resyncTimeoutMs: 5500,
  // Minimum spacing between two resyncs.
  resyncCooldownMs: 2000,
  // When a king had to be invented (none observed and none on the displayed
  // board), a full tracking resync additionally requires both king classes
  // to be believed with at least this confidence somewhere. Below that the
  // display still converges via a display-only FEN update; only the
  // move-tracking hypothesis rebuild waits.
  kingConf: 0.15,
  // Modes in which the resync fallback may rewrite the tracked position.
  // "play" is excluded: there the opponent (Lichess) requires legality.
  resyncModes: ["record", "upload", "broadcast"] as Mode[],
};
