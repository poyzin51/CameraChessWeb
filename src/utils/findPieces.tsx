import { renderState } from "./render/renderState";
import * as tf from "@tensorflow/tfjs-core";
import { getInvTransform, transformBoundary, transformCenters } from "./warp";
import { gameResetMoves, gameSetFen, gameSetResync, gameSetStart, gameUpdate, makeBoard, makeUpdatePayload } from "../slices/gameSlice";
import { getBoxesAndScores, getInput, getXY, invalidVideo } from "./detect";
import { Game, Mode, MovesData, MovesPair } from "../types";
import { zeros } from "./math";
import { CORNER_KEYS } from "./constants";
import { parseSan } from "chessops/san";
import { makeUci } from "chessops/util";
import { makeFen } from "chessops/fen";
import { Color } from "chessops/types";
import { LIVE_CONFIG } from "./liveConfig";
import { countMismatches, fenPlacementLabels, getFenFromState, mergeSignatures, stateSignature } from "./fenFromState";
import { moveKey } from "./moves";

const calculateScore = (state: any, move: MovesData, from_thr = 0.6, to_thr = 0.6) => {
  let score = 0;
  move.from.forEach(square => {
    score += 1 - Math.max(...state[square]) - from_thr;
  })

  for (let i = 0; i < move.to.length; i++) {
    score += state[move.to[i]][move.targets[i]] - to_thr;
  }

  return score
}

const processState = (state: any, movesPairs: MovesPair[], possibleMoves: Set<string>): {
  bestScore1: number, bestScore2: number, bestJointScore: number,
  bestMove: MovesData | null, bestMoves: MovesData | null
} => {
  let bestScore1 = Number.NEGATIVE_INFINITY;
  let bestScore2 = Number.NEGATIVE_INFINITY;
  let bestJointScore = Number.NEGATIVE_INFINITY;
  let bestMove: MovesData | null = null;
  let bestMoves: MovesData | null = null;
  const seen: Set<string> = new Set();

  movesPairs.forEach(movePair => {
    const key1 = moveKey(movePair.move1);
    if (!seen.has(key1)) {
      seen.add(key1);
      const score = calculateScore(state, movePair.move1);
      if (score > 0) {
        possibleMoves.add(key1);
      }
      if (score > bestScore1) {
        bestMove = movePair.move1;
        bestScore1 = score;
      }
    }

    if ((movePair.move2 === null) || (movePair.moves === null) || !(possibleMoves.has(key1))) {
      return;
    }

    const score2: number = calculateScore(state, movePair.move2);
    if (score2 < 0) {
      return;
    } else if (score2 > bestScore2) {
      bestScore2 = score2;
    }

    const jointScore: number = calculateScore(state, movePair.moves);
    if (jointScore > bestJointScore) {
      bestJointScore = jointScore;
      bestMoves = movePair.moves;
    }
  })

  return { bestScore1, bestScore2, bestJointScore, bestMove, bestMoves };
}

const getBoxCenters = (boxes: tf.Tensor2D) => {
  const boxCenters: tf.Tensor2D = tf.tidy(() => {
    const l: tf.Tensor2D = tf.slice(boxes, [0, 0], [-1, 1]);
    const r: tf.Tensor2D = tf.slice(boxes, [0, 2], [-1, 1]);
    const b: tf.Tensor2D = tf.slice(boxes, [0, 3], [-1, 1]);
    const cx: tf.Tensor2D = tf.div(tf.add(l, r), 2);
    const cy: tf.Tensor2D = tf.sub(b, tf.div(tf.sub(r, l), 3));
    const boxCenters: tf.Tensor2D = tf.concat([cx, cy], 1);
    return boxCenters;
  })
  return boxCenters;
}

export const getSquares = (boxes: tf.Tensor2D, centers3D: tf.Tensor3D, boundary3D: tf.Tensor3D): number[] => {
  const squares: number[] = tf.tidy(() => {
    const boxCenters3D: tf.Tensor3D = tf.expandDims(getBoxCenters(boxes), 1);
    const dist: tf.Tensor2D = tf.sum(tf.square(tf.sub(boxCenters3D, centers3D)), 2);
    const squares: any = tf.argMin(dist, 1);

    const shiftedBoundary3D: tf.Tensor3D = tf.concat([
      tf.slice(boundary3D, [0, 1, 0], [1, 3, 2]),
      tf.slice(boundary3D, [0, 0, 0], [1, 1, 2]),
    ], 1);

    const nBoxes: number = boxCenters3D.shape[0];

    const a: tf.Tensor2D = tf.squeeze(tf.sub(
      tf.slice(boundary3D, [0, 0, 0], [1, 4, 1]),
      tf.slice(shiftedBoundary3D, [0, 0, 0], [1, 4, 1])
    ), [2]);
    const b: tf.Tensor2D = tf.squeeze(tf.sub(
      tf.slice(boundary3D, [0, 0, 1], [1, 4, 1]),
      tf.slice(shiftedBoundary3D, [0, 0, 1], [1, 4, 1])
    ), [2]);
    const c: tf.Tensor2D = tf.squeeze(tf.sub(
      tf.slice(boxCenters3D, [0, 0, 0], [nBoxes, 1, 1]),
      tf.slice(shiftedBoundary3D, [0, 0, 0], [1, 4, 1])
    ), [2]);
    const d: tf.Tensor2D = tf.squeeze(tf.sub(
      tf.slice(boxCenters3D, [0, 0, 1], [nBoxes, 1, 1]),
      tf.slice(shiftedBoundary3D, [0, 0, 1], [1, 4, 1])
    ), [2]);

    const det: tf.Tensor2D = tf.sub(tf.mul(a, d), tf.mul(b, c));
    const newSquares: tf.Tensor1D = tf.where(
      tf.any(tf.less(det, 0), 1),
      tf.scalar(-1),
      squares
    );

    return newSquares.arraySync();
  });

  return squares;
}

export const getUpdate = (scoresTensor: tf.Tensor2D, squares: number[]) => {
  const update: number[][] = zeros(64, 12);
  const scores: number[][] = scoresTensor.arraySync();

  for (let i = 0; i < squares.length; i++) {
    const square = squares[i];
    if (typeof square !== 'number' || !Number.isInteger(square) || square < 0 || square >= 64) {
      continue;
    }
    for (let j = 0; j < 12; j++) {
      update[square][j] = Math.max(update[square][j], scores[i][j])
    }
  }
  return update;
}

const updateState = (state: number[][], update: number[][], decay: number = 0.5) => {
  for (let i = 0; i < 64; i++) {
    for (let j = 0; j < 12; j++) {
      state[i][j] = decay * state[i][j] + (1 - decay) * update[i][j]
    }
  }
  return state
}

const sanToLan = (board: any, san: string): string => {
  const move = parseSan(board, san);
  if (!move) return "";
  return makeUci(move);
}

// How many squares see a confident detection this frame (before smoothing).
// A hand over the board makes this collapse.
const countDetections = (update: number[][]): number => {
  let count = 0;
  for (let i = 0; i < 64; i++) {
    for (let j = 0; j < 12; j++) {
      if (update[i][j] >= LIVE_CONFIG.detectionConf) {
        count++;
        break;
      }
    }
  }
  return count;
}

export const detect = async (modelRef: any, videoRef: any, keypoints: number[][]):
  Promise<{ boxes: tf.Tensor2D, scores: tf.Tensor2D }> => {
  const { image4D, width, height, padding, roi } = getInput(videoRef, keypoints);
  const videoWidth: number = videoRef.current.videoWidth;
  const videoHeight: number = videoRef.current.videoHeight;
  const preds: tf.Tensor3D = modelRef.current.predict(image4D);
  const { boxes, scores } = getBoxesAndScores(preds, width, height, videoWidth, videoHeight, padding, roi);

  tf.dispose([image4D, preds]);

  return { boxes, scores }
}

export const getKeypoints = (cornersRef: any, canvasRef: any): number[][] => {
  const keypoints = CORNER_KEYS.map(x =>
    getXY(cornersRef.current[x], canvasRef.current.height, canvasRef.current.width)
  );
  return keypoints
}

export const findPieces = (modelRef: any, videoRef: any, canvasRef: any,
  playingRef: any, setText: any, dispatch: any, cornersRef: any, boardRef: any,
  movesPairsRef: any, lastMoveRef: any, moveTextRef: any, mode: Mode,
  fenRef: any) => {
  let centers: number[][] | null = null;
  let boundary: number[][];
  let centers3D: tf.Tensor3D;
  let boundary3D: tf.Tensor3D;
  let state: number[][];
  let keypoints: number[][];
  let possibleMoves: Set<string>;
  let requestId: number;
  let greedyMoveToTime: { [move: string]: number };
  let active = true;

  // Clean-frame gate / settled-position / resync bookkeeping
  let detBaseline: number | null;
  let turbulentSince: number | null;
  let cleanStreak: number;
  let settleSig: number[] | null;
  let settleStart: number;
  let unexplainedSince: number | null;
  let lastResyncTime: number;

  const resetTracking = () => {
    state = zeros(64, 12);
    possibleMoves = new Set<string>;
    greedyMoveToTime = {};
    detBaseline = null;
    turbulentSince = null;
    cleanStreak = 0;
    settleSig = null;
    settleStart = 0;
    unexplainedSince = null;
    lastResyncTime = 0;
  }

  // Returns null for a clean frame, otherwise a short reason string.
  const classifyFrame = (detCount: number, now: number): string | null => {
    let reason: string | null = null;

    if (detBaseline !== null) {
      const drop = detBaseline - detCount;
      const dropLimit = Math.max(LIVE_CONFIG.turbulenceMinDrop, LIVE_CONFIG.turbulenceDropRatio * detBaseline);
      if (drop >= dropLimit) {
        reason = "occluded";
      }
    }

    if (reason !== null) {
      if (turbulentSince === null) {
        turbulentSince = now;
      } else if (now - turbulentSince >= LIVE_CONFIG.turbulenceMaxMs) {
        // Turbulent for too long: this is the new reality (board cleared,
        // lighting change, ...). Re-learn the baseline instead of freezing.
        reason = null;
        detBaseline = null;
      }
    }
    if (reason === null) {
      turbulentSince = null;
    }
    return reason;
  }

  // If a both-colour hypothesis won with the "wrong" side to move, rewrite
  // the tracked board so that colour is to move before playing the SAN.
  const alignTurn = (color: Color | undefined) => {
    if (color === undefined || boardRef.current.turn === color) {
      return;
    }
    const setup = boardRef.current.toSetup();
    setup.turn = color;
    setup.epSquare = undefined;
    const fen = makeFen(setup);
    const game: Game = {
      "fen": fen, "moves": "", "start": fen, "lastMove": "",
      "greedy": false, "fromOpponent": false, "error": null, "resync": false
    };
    boardRef.current = makeBoard(game);
    dispatch(gameSetStart(fen));
  }

  // The camera is the source of truth: this must always move the display
  // towards the observed position. When the observation is playable, the
  // whole tracker resyncs (hypotheses rebuilt for both colours). When it is
  // not even representable as a chess position, the displayed FEN is still
  // updated (display-only sync) and tracking re-attaches on a later attempt.
  const attemptResync = (now: number, displayed: number[] | null) => {
    const observed = getFenFromState(state, boardRef.current.turn, {
      prior: displayed,
      signature: settleSig ?? undefined,
      tryBothColors: true
    });
    lastResyncTime = now;

    // An invented king means the readout is guessing; only trust it for
    // full tracking when the king classes were at least somewhat believed.
    const kingsOk = !observed.kingsForced ||
      Math.min(observed.blackKingScore, observed.whiteKingScore) >= LIVE_CONFIG.kingConf;

    if (observed.playableFen !== null && kingsOk) {
      unexplainedSince = null;
      possibleMoves.clear();
      greedyMoveToTime = {};

      dispatch(gameSetStart(observed.playableFen));
      dispatch(gameSetFen(observed.playableFen));
      dispatch(gameResetMoves());
      dispatch(gameSetResync(true));
      console.log("Resynced to observed position", observed.playableFen);
    } else {
      dispatch(gameSetFen(observed.rawFen));
      console.log("Display-only sync to observed position", observed.rawFen, observed.error);
    }
  }

  const loop = async () => {
    try {
      if (playingRef.current === false || invalidVideo(videoRef)) {
        centers = null
      } else {
        if (centers === null) {
          keypoints = getKeypoints(cornersRef, canvasRef);
          const invTransform = getInvTransform(keypoints);
          [centers, centers3D] = transformCenters(invTransform);
          [boundary, boundary3D] = transformBoundary(invTransform);
          resetTracking();
        }
        const startTime: number = performance.now();
        const startTensors: number = tf.memory().numTensors;

        const { boxes, scores } = await detect(modelRef, videoRef, keypoints);
        const squares: number[] = getSquares(boxes, centers3D, boundary3D);
        const update: number[][] = getUpdate(scores, squares);

        const now: number = performance.now();
        const detCount: number = countDetections(update);
        const turbulence: string | null = classifyFrame(detCount, now);

        let settled = false;
        let bestScore1 = Number.NEGATIVE_INFINITY;
        let bestScore2 = Number.NEGATIVE_INFINITY;
        let bestJointScore = Number.NEGATIVE_INFINITY;
        let bestMove: MovesData | null = null;
        let bestMoves: MovesData | null = null;

        if (turbulence === null) {
          // Clean frame: feed the rolling state and the commit logic.
          detBaseline = (detBaseline === null)
            ? detCount
            : (1 - LIVE_CONFIG.baselineEmaAlpha) * detBaseline + LIVE_CONFIG.baselineEmaAlpha * detCount;
          cleanStreak++;

          state = updateState(state, update);

          // "Unknown" squares are wildcards: a confidence dropout neither
          // restarts the settle timer nor blocks the settled flag.
          const sig = stateSignature(state);
          const merged = settleSig === null ? null : mergeSignatures(settleSig, sig);
          if (merged !== null) {
            settleSig = merged;
            settled = (now - settleStart >= LIVE_CONFIG.settleMs) && (cleanStreak >= LIVE_CONFIG.minCleanFrames);
          } else {
            settleSig = sig;
            settleStart = now;
          }

          ({ bestScore1, bestScore2, bestJointScore, bestMove, bestMoves } = processState(state, movesPairsRef.current, possibleMoves));
        } else {
          // Turbulent frame (hand / mid-air piece / occlusion): freeze the
          // state so it never feeds the commit logic, and drop the settle.
          cleanStreak = 0;
        }

        const endTime: number = performance.now();
        const fps: string = (1000 / (endTime - startTime)).toFixed(1);

        // All commits operate on settled positions only.
        let hasMove: boolean = false;
        if (settled && (bestMoves !== null) && (mode !== "play")) {
          const move: string = bestMoves.sans[0];
          hasMove = (bestScore2 > 0) && (bestJointScore > 0) && (possibleMoves.has(moveKey(bestMoves)));
          if (hasMove) {
            alignTurn(bestMoves.color);
            boardRef.current.playSan(move);
            possibleMoves.clear();
            greedyMoveToTime = {};
          }
        }

        let hasGreedyMove: boolean = false;
        if (settled && bestMove !== null && !(hasMove) && (bestScore1 > 0)) {
          const move: string = bestMove.sans[0];
          if (!(move in greedyMoveToTime)) {
            greedyMoveToTime[move] = endTime;
          }

          const secondElapsed = (endTime - greedyMoveToTime[move]) > LIVE_CONFIG.greedyDwellMs;
          const newMove = sanToLan(boardRef.current, move) !== lastMoveRef.current;
          hasGreedyMove = secondElapsed && newMove;
          if (hasGreedyMove) {
            alignTurn(bestMove.color);
            boardRef.current.playSan(move);
            greedyMoveToTime = { greedyMove: greedyMoveToTime[move] };
          }
        }

        if (hasMove || hasGreedyMove) {
          // No takebacks in "play" mode
          const greedy = (mode === "play") ? false : hasGreedyMove;
          const payload = makeUpdatePayload(boardRef.current, greedy);
          console.log("payload", payload);
          dispatch(gameUpdate(payload));
        }

        // Observation resync: a settled position that the displayed board
        // does not match, and that no committed move explained, eventually
        // overwrites the tracked position. Legality never blocks the display.
        if (hasMove || hasGreedyMove) {
          unexplainedSince = null;
        } else if (settled && LIVE_CONFIG.resyncModes.includes(mode)) {
          const displayed: number[] | null = fenPlacementLabels(fenRef.current);
          if (displayed === null || settleSig === null || countMismatches(settleSig, displayed) === 0) {
            unexplainedSince = null;
          } else {
            if (unexplainedSince === null) {
              unexplainedSince = now;
            } else if ((now - unexplainedSince >= LIVE_CONFIG.resyncTimeoutMs)
              && (now - lastResyncTime >= LIVE_CONFIG.resyncCooldownMs)) {
              attemptResync(now, displayed);
            }
          }
        } else if (!settled) {
          unexplainedSince = null;
        }

        let status: string = turbulence !== null ? turbulence : (settled ? "settled" : "tracking");
        if (unexplainedSince !== null) {
          const remaining = Math.max(0, LIVE_CONFIG.resyncTimeoutMs - (now - unexplainedSince)) / 1000;
          status = `desync, resync in ${remaining.toFixed(1)}s`;
        }
        setText([`FPS: ${fps} (${status})`, moveTextRef.current]);

        renderState(canvasRef.current, centers, boundary, state);

        tf.dispose([boxes, scores]);

        const endTensors: number = tf.memory().numTensors;
        if (startTensors < endTensors) {
          console.error(`Memory Leak! (${endTensors} > ${startTensors})`)
        }
      }
    } catch (error) {
      console.error("Piece detection failed", error);
    } finally {
      if (active) {
        requestId = requestAnimationFrame(() => {
          void loop();
        });
      }
    }
  }
  requestId = requestAnimationFrame(() => {
    void loop();
  });

  return () => {
    active = false;
    tf.disposeVariables();
    if (requestId) {
      window.cancelAnimationFrame(requestId);
    }
  };
};
