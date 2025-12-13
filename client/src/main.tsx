import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initTelemetry } from "./utils/telemetry";

initTelemetry();

createRoot(document.getElementById("root")!).render(<App />);
