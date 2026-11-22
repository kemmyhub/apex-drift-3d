import "./styles.css";
import { ApexDriftApp } from "./game/ApexDriftApp.js";
import { bootstrapGame } from "./game/bootstrap.js";

window.addEventListener("DOMContentLoaded", () => {
  bootstrapGame({
    documentRef: document,
    windowRef: window,
    createApp: () => new ApexDriftApp()
  });
});
