import { parseFen, makeFen } from "chessops/fen";
import { Chess } from "chessops/chess";
import { Color, Role } from "chessops/types";
import { opposite } from "chessops/util";
import { LABEL_MAP, PIECE_SYMBOLS } from "./constants";
import { LIVE_CONFIG } from "./liveConfig";

// Signature values per square: 0-11 = LABELS class index,
// SIG_EMPTY = confidently empty, SIG_UNKNOWN = not enough evidence either way.
export const SIG_EMPTY = -1;
export const SIG_UNKNOWN = -2;

export interface ObservedFen {
  // What the camera sees, verbatim (may be an illegal / unplayable position).
  rawFen: string,
  // A chessops-constructible version (exactly one king per side, no
  // impossible checks), or null when the observation cannot be repaired.
  playableFen: string | null,
  error: string | null,
  blackKingScore: number,
  whiteKingScore: number,
  // True when a king had to be invented because none was observed.
  kingsForced: boolean
}

// Three-state per-square readout of a 64x12 probability grid.
export const stateSignature = (state: number[][]): number[] => {
  const sig = Array(64).fill(SIG_EMPTY);
  for (let i = 0; i < 64; i++) {
    let bestJ = -1;
    let bestScore = 0;
    for (let j = 0; j < 12; j++) {
      if (state[i][j] > bestScore) {
        bestScore = state[i][j];
        bestJ = j;
      }
    }
    if (bestScore >= LIVE_CONFIG.pieceConf) {
      sig[i] = bestJ;
    } else if (bestScore > LIVE_CONFIG.emptyConf) {
      sig[i] = SIG_UNKNOWN;
    }
  }
  return sig;
}

// Merge two signatures; SIG_UNKNOWN acts as a wildcard. Returns null when
// two definite readings disagree (the position actually changed).
export const mergeSignatures = (oldSig: number[], newSig: number[]): number[] | null => {
  const merged = Array(64);
  for (let i = 0; i < 64; i++) {
    const a = oldSig[i];
    const b = newSig[i];
    if (a === b || b === SIG_UNKNOWN) {
      merged[i] = a;
    } else if (a === SIG_UNKNOWN) {
      merged[i] = b;
    } else {
      return null;
    }
  }
  return merged;
}

// Squares where the signature definitely disagrees with a placement.
// SIG_UNKNOWN squares never count (a confidence dropout is not a mismatch).
export const countMismatches = (sig: number[], labels: number[]): number => {
  let n = 0;
  for (let i = 0; i < 64; i++) {
    if (sig[i] !== SIG_UNKNOWN && sig[i] !== labels[i]) {
      n++;
    }
  }
  return n;
}

const isBackRank = (square: number): boolean => square < 8 || square >= 56;
const isPawnLabel = (label: number): boolean => PIECE_SYMBOLS[label % 6] === "pawn";
const BLACK_KING = 1;
const WHITE_KING = 7;

// FEN string for an arbitrary (possibly unplayable) placement. Built by
// mutating a placeholder Chess board, which sidesteps chessops validation.
const placementFen = (labels: number[], color: Color): string => {
  const turn = color === "white" ? "w" : "b";
  const setup = parseFen(`4k3/8/8/8/8/8/8/4K3 ${turn} - - 0 1`).unwrap();
  const board = Chess.fromSetup(setup).unwrap();
  board.board.clear();
  for (let i = 0; i < 64; i++) {
    if (labels[i] < 0) {
      continue;
    }
    const role: Role = PIECE_SYMBOLS[labels[i] % 6];
    const pieceColor: Color = (labels[i] > 5) ? 'white' : 'black';
    board.board.set(i, { role, color: pieceColor });
  }
  return makeFen(board.toSetup());
}

// Force exactly one king of the given class onto the labels array.
// Returns true if a king had to be invented (none was observed).
const ensureSingleKing = (labels: number[], state: number[][], kingLabel: number): boolean => {
  const otherKing = kingLabel === BLACK_KING ? WHITE_KING : BLACK_KING;
  const kingSquares: number[] = [];
  for (let i = 0; i < 64; i++) {
    if (labels[i] === kingLabel) {
      kingSquares.push(i);
    }
  }

  if (kingSquares.length === 1) {
    return false;
  }

  if (kingSquares.length > 1) {
    let best = kingSquares[0];
    kingSquares.forEach(i => {
      if (state[i][kingLabel] > state[best][kingLabel]) {
        best = i;
      }
    });
    kingSquares.forEach(i => {
      if (i !== best) {
        labels[i] = SIG_EMPTY;
      }
    });
    return false;
  }

  // No king observed: place one at the most king-like square.
  let best = -1;
  for (let i = 0; i < 64; i++) {
    if (labels[i] === otherKing) {
      continue;
    }
    if (best === -1 || state[i][kingLabel] > state[best][kingLabel]) {
      best = i;
    }
  }
  labels[best] = kingLabel;
  return true;
}

const tryPlayable = (labels: number[], color: Color): { fen: string | null, error: string | null } => {
  const fen = placementFen(labels, color);
  const parsed = parseFen(fen);
  if (parsed.isErr) {
    return { fen: null, error: "Unparseable FEN" };
  }
  // fromSetup also rejects "the side not to move is in check", missing
  // kings, and pawns on the back rank.
  const pos = Chess.fromSetup(parsed.unwrap());
  if (pos.isErr) {
    return { fen: null, error: `${pos.error}` };
  }
  return { fen, error: null };
}

interface FenFromStateOpts {
  // Currently displayed placement (labels per square); SIG_UNKNOWN squares
  // keep this prior belief instead of being wiped.
  prior?: number[] | null,
  // Pre-computed (settled) signature; computed from state when omitted.
  signature?: number[],
  // Try the opposite side to move when the requested one is unplayable.
  tryBothColors?: boolean
}

// Legality-free readout of a 64x12 state grid. Always yields rawFen (what
// the camera sees); yields playableFen only when the observation can be
// turned into a chessops-legal setup.
export const getFenFromState = (state: number[][], color: Color, opts: FenFromStateOpts = {}): ObservedFen => {
  const sig = opts.signature ?? stateSignature(state);
  const prior = opts.prior ?? null;

  let blackKingScore = 0;
  let whiteKingScore = 0;
  for (let i = 0; i < 64; i++) {
    blackKingScore = Math.max(blackKingScore, state[i][BLACK_KING]);
    whiteKingScore = Math.max(whiteKingScore, state[i][WHITE_KING]);
  }

  const observed = Array(64).fill(SIG_EMPTY);
  for (let i = 0; i < 64; i++) {
    let label = sig[i] >= 0 ? sig[i] : (sig[i] === SIG_UNKNOWN && prior !== null ? prior[i] : SIG_EMPTY);

    // The detector cannot see a pawn on a back rank (and chessops rejects
    // it); take the next-best non-pawn class instead, if any is confident.
    if (label >= 0 && isPawnLabel(label) && isBackRank(i)) {
      label = SIG_EMPTY;
      let bestScore = LIVE_CONFIG.pieceConf;
      for (let j = 0; j < 12; j++) {
        if (!isPawnLabel(j) && state[i][j] > bestScore) {
          bestScore = state[i][j];
          label = j;
        }
      }
    }
    observed[i] = label;
  }

  const rawFen = placementFen(observed, color);

  const playObserved = [...observed];
  let kingsForced = ensureSingleKing(playObserved, state, BLACK_KING);
  kingsForced = ensureSingleKing(playObserved, state, WHITE_KING) || kingsForced;

  let playable = tryPlayable(playObserved, color);
  if (playable.fen === null && (opts.tryBothColors ?? false)) {
    const flipped = tryPlayable(playObserved, opposite(color));
    if (flipped.fen !== null) {
      playable = flipped;
    }
  }

  return {
    rawFen,
    playableFen: playable.fen,
    error: playable.error,
    blackKingScore,
    whiteKingScore,
    kingsForced
  };
}

const roleToLabelIdx = (role: Role, color: Color): number => {
  const label = role === 'knight' ? 'n' : role[0];
  return LABEL_MAP[color === 'white' ? label.toUpperCase() : label.toLowerCase()];
}

// Per-square LABELS index (or SIG_EMPTY) of a FEN's piece placement.
// Returns null when the FEN cannot be parsed.
export const fenPlacementLabels = (fen: string): number[] | null => {
  const setup = parseFen(fen);
  if (setup.isErr) {
    return null;
  }
  const labels = Array(64).fill(SIG_EMPTY);
  for (const [square, piece] of setup.unwrap().board) {
    labels[square] = roleToLabelIdx(piece.role, piece.color);
  }
  return labels;
}
