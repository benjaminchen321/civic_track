// FILE: frontend/src/components/Pagination.jsx
import React from "react";
import "./Pagination.css"; // Add styles

// Helper to parse offset from API's next/prev URLs
const parseOffsetFromUrl = (url) => {
  if (!url) return null;
  try {
    // Need full URL for constructor, handle relative paths from API if necessary
    const fullUrl = url.startsWith("http") ? url : `https://example.com${url}`; // Dummy base
    const params = new URLSearchParams(new URL(fullUrl).search);
    const offset = parseInt(params.get("offset"), 10);
    return isNaN(offset) ? null : offset;
  } catch (e) {
    console.error("Error parsing offset from URL:", url, e);
    return null;
  }
};

function Pagination({
  pagination,
  currentPageOffset,
  itemsPerPage,
  onPageChange,
}) {
  if (!pagination || !pagination.count || pagination.count <= itemsPerPage) {
    // Don't show pagination if only one page or no data
    return null;
  }

  const totalItems = pagination.count;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const currentPage = Math.floor(currentPageOffset / itemsPerPage) + 1;

  const nextOffset = parseOffsetFromUrl(pagination.next);
  // Calculate previous offset manually as API might not provide 'previous' URL
  const prevOffset =
    currentPageOffset > 0
      ? Math.max(0, currentPageOffset - itemsPerPage)
      : null;

  const canGoPrev = currentPageOffset > 0;
  const canGoNext = nextOffset !== null && nextOffset > currentPageOffset; // Ensure next offset is valid

  return (
    <div className="pagination-controls">
      <button onClick={() => onPageChange(prevOffset)} disabled={!canGoPrev}>
        « Previous
      </button>
      <span className="page-info">
        Page {currentPage} of {totalPages} ({totalItems} items)
      </span>
      <button onClick={() => onPageChange(nextOffset)} disabled={!canGoNext}>
        Next »
      </button>
    </div>
  );
}

export default Pagination;
