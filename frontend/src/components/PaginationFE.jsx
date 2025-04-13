// FILE: frontend/src/components/PaginationFE.jsx
import React from "react";
// Use existing Pagination.css or create new styles if needed
import "./Pagination.css";

function PaginationFE({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) {
    return null; // Don't show pagination if only one page
  }

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Basic pagination - show Prev/Next and current page info
  // TODO: Add page number links later if desired
  return (
    <div className="pagination-controls">
      <button onClick={handlePrev} disabled={currentPage <= 1}>
        « Previous
      </button>
      <span className="page-info">
        Page {currentPage} of {totalPages}
      </span>
      <button onClick={handleNext} disabled={currentPage >= totalPages}>
        Next »
      </button>
    </div>
  );
}

export default PaginationFE;
