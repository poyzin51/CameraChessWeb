import * as tf from "@tensorflow/tfjs-core";
import { getInvTransform, transformBoundary, transformCenters } from "./warp";
import { invalidVideo } from "./detect";
import { detect, getKeypoints, getSquares, getUpdate } from "./findPieces";
import { Color } from "chessops/types";
import { gameResetMoves, gameSetFen, gameSetStart } from "../slices/gameSlice";
import { getFenFromState } from "./fenFromState";
import { renderState } from "./render/renderState";
import { SetStringArray } from "../types";

interface findFenInput {
  piecesModelRef: any,
  videoRef: any,
  cornersRef: any,
  canvasRef: any,
  dispatch: any,
  setText: SetStringArray,
  color: Color
}

const setFenFromState = (state: number[][], color: Color, dispatch: any, setText: SetStringArray) => {
  const { playableFen, error } = getFenFromState(state, color);
  if (playableFen !== null) {
    dispatch(gameSetStart(playableFen));
    dispatch(gameSetFen(playableFen));
    dispatch(gameResetMoves());
    setText(["Set starting FEN"]);
  } else {
    setText(["Invalid FEN:", error ?? "unknown error"]);
  }
}

export const _findFen = async ({ piecesModelRef, videoRef,
  cornersRef, canvasRef, dispatch, setText, color }: findFenInput) => {
  if (invalidVideo(videoRef)) {
    return;
  }
  const keypoints: number[][] = getKeypoints(cornersRef, canvasRef);

  const invTransform = getInvTransform(keypoints);
  const [centers, centers3D] = transformCenters(invTransform);
  const [boundary, boundary3D] = transformBoundary(invTransform);
  const { boxes, scores } = await detect(piecesModelRef, videoRef, keypoints);
  try {
    const squares: number[] = getSquares(boxes, centers3D, boundary3D);
    const state = getUpdate(scores, squares);
    setFenFromState(state, color, dispatch, setText);

    renderState(canvasRef.current, centers, boundary, state);
  } finally {
    tf.dispose([boxes, scores, centers3D, boundary3D]);
  }
}

export const findFen = async ({ piecesModelRef, videoRef, cornersRef, canvasRef, dispatch, setText, color }:
  findFenInput) => {
  const startTensors = tf.memory().numTensors;

  await _findFen({ piecesModelRef, videoRef, cornersRef, canvasRef, dispatch, setText, color });

  const endTensors = tf.memory().numTensors;
  if (startTensors < endTensors) {
    console.error(`Memory Leak! (${endTensors} > ${startTensors})`)
  }

  return () => {
    tf.disposeVariables();
  };
}
