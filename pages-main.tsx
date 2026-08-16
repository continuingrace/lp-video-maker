import React from "react";
import { createRoot } from "react-dom/client";
import LPVideoMaker from "./app/LPVideoMaker";
import "./app/globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><LPVideoMaker /></React.StrictMode>,
);
