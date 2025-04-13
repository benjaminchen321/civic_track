// FILE: frontend/src/pages/BrowseCommitteesPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { fetchCommittees } from "../services/api"; // Import API function
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import Pagination from "../components/Pagination";
import CommitteeListItem from "../components/CommitteeListItem";
import '../styles/BrowsePages.css'; // If you create shared browse styles

// Mock/Placeholder data - Replace with API call if backend endpoint exists
const MOCK_CONGRESSES = [
  { number: 118, name: "118th (2023-2024)" },
  { number: 117, name: "117th (2021-2022)" },
  // Add more or fetch dynamically
];
const MOCK_CHAMBERS = [
  { code: "", name: "All Chambers" },
  { code: "house", name: "House" },
  { code: "senate", name: "Senate" },
  { code: "joint", name: "Joint" },
];

function BrowseCommitteesPage() {
  const [committees, setCommittees] = useState([]);
  // TODO: Fetch congress list dynamically if possible via API
  const [congresses] = useState(MOCK_CONGRESSES);
  const [chambers] = useState(MOCK_CHAMBERS);

  // Filter State - Initialize with potentially sensible defaults
  const [selectedCongress, setSelectedCongress] = useState(
    MOCK_CONGRESSES[0]?.number?.toString() || ""
  );
  const [selectedChamber, setSelectedChamber] = useState("");

  // Data Fetching State
  const [pagination, setPagination] = useState(null);
  const [currentPageOffset, setCurrentPageOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const itemsPerPage = 25; // Should match API default/limit

  // --- Fetching Logic ---
  const loadCommittees = useCallback(
    async (offset = 0) => {
      setIsLoading(true);
      setError(null);
      // Don't clear committees immediately for pagination - feels smoother
      // setCommittees([]);
      setPagination(null);

      const params = {
        limit: itemsPerPage,
        offset: offset,
      };
      // Only add filters to params if they have a value
      if (selectedCongress) params.congress = selectedCongress;
      if (selectedChamber) params.chamber = selectedChamber;

      const { data, error: apiError } = await fetchCommittees(params);

      if (apiError) {
        setError(apiError);
        setCommittees([]); // Clear results on error
      } else if (data && data.committees !== undefined) {
        // Check for committees key specifically
        setCommittees(data.committees || []);
        setPagination(data.pagination || null);
        setError(null); // Clear previous errors on success
      } else {
        setError("Received unexpected data structure from API.");
        setCommittees([]);
      }
      setCurrentPageOffset(offset);
      setIsLoading(false);
    },
    [selectedCongress, selectedChamber]
  ); // Recreate fetcher if filters change

  // --- Initial Load ---
  // Load committees when the component mounts for the first time
  useEffect(() => {
    console.log("BrowseCommitteesPage mounted. Loading initial data.");
    loadCommittees(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means run only once on mount

  // --- Event Handlers ---
  const handleCongressChange = (e) => setSelectedCongress(e.target.value);
  const handleChamberChange = (e) => setSelectedChamber(e.target.value);

  const handleLoadClick = () => {
    // Load first page when explicitly clicking button after changing filters
    loadCommittees(0);
  };

  const handlePageChange = (newOffset) => {
    // Load the specific page offset requested by Pagination component
    if (newOffset !== null && newOffset !== currentPageOffset) {
      loadCommittees(newOffset);
    }
  };

  // --- Render ---
  return (
    <div>
      <div className="page-header-react">
        <h2>Browse Committees</h2>
      </div>

      {/* Filter Controls */}
      <div className="browse-controls-react">
        {" "}
        {/* Use distinct class */}
        <div className="browse-filter-group">
          <label htmlFor="browse-congress-filter">Congress:</label>
          <select
            id="browse-congress-filter"
            value={selectedCongress}
            onChange={handleCongressChange}
            disabled={isLoading}
          >
            <option value="">All Congresses</option>
            {congresses.map((c) => (
              <option key={c.number} value={c.number}>
                {c.number}
                {c.name ? ` (${c.name.split(" ")[0]})` : ""}{" "}
                {/* Adjust display */}
              </option>
            ))}
          </select>
        </div>
        <div className="browse-filter-group">
          <label htmlFor="browse-chamber-filter">Chamber:</label>
          <select
            id="browse-chamber-filter"
            value={selectedChamber}
            onChange={handleChamberChange}
            disabled={isLoading}
          >
            {chambers.map((ch) => (
              <option key={ch.code} value={ch.code}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
        <button onClick={handleLoadClick} disabled={isLoading}>
          {isLoading ? "Loading..." : "Apply Filters"}
        </button>
      </div>

      {/* Status and Results */}
      <div className="results-container-react">
        {/* Show loading spinner prominently */}
        {isLoading && <LoadingSpinner />}
        {/* Show error message if it exists */}
        {error && <ErrorMessage message={error} />}

        {/* Only show list and pagination if NOT loading and NO error */}
        {!isLoading && !error && (
          <>
            <ul className="results-list-react committee-list">
              {" "}
              {/* Distinct class */}
              {committees.length > 0 ? (
                committees.map((committee) => (
                  // Use CommitteeListItem component
                  <CommitteeListItem
                    key={committee.systemCode || committee.url}
                    committee={committee}
                  />
                ))
              ) : (
                <li>No committees found matching your criteria.</li>
              )}
            </ul>
            <Pagination
              pagination={pagination}
              currentPageOffset={currentPageOffset}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
export default BrowseCommitteesPage;
