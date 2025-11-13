import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app.jsx";   // or "./App.jsx" if your file is named that
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />                     {/* Capital A here */}
  </React.StrictMode>
);
