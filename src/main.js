import "./styles.css";
import { ApexDriftApp } from "./game/ApexDriftApp.js";

window.addEventListener("DOMContentLoaded", () => {
  window.apexGame = new ApexDriftApp();
});
