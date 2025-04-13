// FILE: frontend/src/components/ErrorMessage.jsx
import React from "react";
import "./ErrorMessage.css"; // Add basic styling

function ErrorMessage({ message }) {
  if (!message) return null; // Don't render if no message

  return (
    <div className="error-message-react">
      <strong>Error:</strong> {message}
    </div>
  );
}
export default ErrorMessage;
