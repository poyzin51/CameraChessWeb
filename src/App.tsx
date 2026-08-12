import { Dispatch, useEffect, useRef, useState } from "react";
import { NavigateFunction, Outlet, useNavigate } from "react-router-dom";
import { GraphModel } from "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import { ModelRefs } from "./types";
import { useUser } from "./slices/userSlice";
import { useDispatch } from "react-redux";
import { lichessTrySetUser } from "./utils/lichess";
import { UnknownAction } from "@reduxjs/toolkit";
import { Toast } from "./components/common";
import LoadModels from "./utils/loadModels";

const App = () => {
  const dispatch: Dispatch<UnknownAction> = useDispatch();
  const navigate: NavigateFunction = useNavigate();
  const token = useUser().token;
  const [loading, setLoading] = useState(true);

  const piecesModelRef = useRef<GraphModel | null>(null);
  const xcornersModelRef = useRef<GraphModel | null>(null);
  const modelRefs: ModelRefs = {
    "piecesModelRef": piecesModelRef,
    "xcornersModelRef": xcornersModelRef,
  }

  useEffect(() => {
    if (token === "") {
      void lichessTrySetUser(navigate, dispatch)
        .catch((error: unknown) => console.error("Failed to restore Lichess session", error));
    }
  }, [dispatch, navigate, token]);

  useEffect(() => {
    LoadModels(piecesModelRef, xcornersModelRef)
      .then(() => setLoading(false))
      .catch((error) => console.error("Failed to load TensorFlow models", error));
  }, []);

  // The board-recognition models are ~10MB, so the first load takes a moment.
  // Without this the whole app is a blank black screen until they arrive.
  const splash = () => {
    return (
      <div className="d-flex h-100 flex-column align-items-center justify-content-center
        text-center text-white bg-dark">
        <img src="matepoint-logo.png" alt="MatePoint Academy"
          style={{ maxHeight: "120px", width: "auto" }} />
        <div className="spinner-border text-warning my-3" role="status" />
        <div className="mp-subtitle">Loading board recognition</div>
      </div>
    );
  }

  return (
    <>
      <Toast />
      {loading ? splash() : <Outlet context={modelRefs} />}
    </>
  );
};

export default App;
