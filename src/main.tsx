import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Add debugging
console.log("🔵 STEP 1: main.tsx file loaded");

const rootElement = document.getElementById("root");
console.log("🔵 STEP 2: Root element:", rootElement ? "Found ✓" : "NOT FOUND ✗");

if (!rootElement) {
  document.body.innerHTML = `
    <div style="padding: 40px; font-family: system-ui; background: #ff6b6b; color: white; min-height: 100vh;">
      <h1>❌ Error: Root element not found</h1>
      <p>Cannot find element with id="root"</p>
      <p>Check if index.html has &lt;div id="root"&gt;&lt;/div&gt;</p>
    </div>
  `;
  throw new Error("Root element not found");
}

// Try rendering
try {
  console.log("🔵 STEP 3: Creating React root...");
  const root = createRoot(rootElement);
  console.log("🔵 STEP 4: Rendering App component...");
  root.render(<App />);
  console.log("✅ STEP 5: React app mounted successfully!");
} catch (error) {
  console.error("❌ ERROR:", error);
  rootElement.innerHTML = `
    <div style="padding: 40px; font-family: system-ui; background: #ff6b6b; color: white; min-height: 100vh;">
      <h1>❌ Error Loading App</h1>
      <pre style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 8px; margin-top: 20px; overflow: auto; max-height: 400px; font-size: 14px;">
        ${error instanceof Error ? error.message : String(error)}
        ${error instanceof Error && error.stack ? '\n\n' + error.stack : ''}
      </pre>
      <p style="margin-top: 20px; font-size: 16px;">Open the browser console (F12) and check for more errors.</p>
      <button onclick="window.location.reload()" style="padding: 15px 30px; margin-top: 20px; cursor: pointer; font-size: 16px; background: white; color: #ff6b6b; border: none; border-radius: 4px; font-weight: bold;">Reload Page</button>
    </div>
  `;
}
