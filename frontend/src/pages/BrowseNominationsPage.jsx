// FILE: frontend/src/pages/BrowseNominationsPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { fetchNominations } from "../services/api"; // Import API function
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import Pagination from "../components/Pagination";
import NominationListItem from "../components/NominationListItem"; // Import the new component
import '../styles/BrowsePages.css';

// Mock/Placeholder data - Replace later if needed
const MOCK_CONGRESSES = [
  { number: 118, name: "118th (2023-2024)" },
  { number: 117, name: "117th (2021-2022)" },
  // Add more or fetch dynamically
];

function BrowseNominationsPage() {
  const [nominations, setNominations] = useState([]);
  const [congresses] = useState(MOCK_CONGRESSES);

  // Filter State
  const [selectedCongress, setSelectedCongress] = useState(
    MOCK_CONGRESSES[0]?.number?.toString() || ""
  ); // Default to latest mock congress

  // Data Fetching State
  const [pagination, setPagination] = useState(null);
  const [currentPageOffset, setCurrentPageOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const itemsPerPage = 25; // Match API default/limit

  // --- Fetching Logic ---
  const loadNominations = useCallback(
    async (offset = 0) => {
      setIsLoading(true);
      setError(null);
      setPagination(null);

      const params = {
        limit: itemsPerPage,
        offset: offset,
      };
      if (selectedCongress) {
        // Only include congress if selected
        params.congress = selectedCongress;
      }

      const { data, error: apiError } = await fetchNominations(params);

      if (apiError) {
        setError(apiError);
        setNominations([]);
      } else if (data && data.nominations !== undefined) {
        setNominations(data.nominations || []);
        setPagination(data.pagination || null);
        setError(null);
      } else {
        setError("Received unexpected data structure from API.");
        setNominations([]);
      }
      setCurrentPageOffset(offset);
      setIsLoading(false);
    },
    [selectedCongress]
  ); // Dependency: reload if selectedCongress changes

  // --- Initial Load ---
  useEffect(() => {
    console.log("BrowseNominationsPage mounted. Loading initial data.");
    // Load based on initially selected congress
    loadNominations(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // --- Event Handlers ---
  const handleCongressChange = (e) => setSelectedCongress(e.target.value);

  const handleLoadClick = () => {
    // Load first page when explicitly clicking button after changing filters
    loadNominations(0);
  };

  const handlePageChange = (newOffset) => {
    // Load the specific page offset requested by Pagination component
    if (newOffset !== null && newOffset !== currentPageOffset) {
      loadNominations(newOffset);
    }
  };

  // --- Render ---
  return (
    <div>
      <div className="page-header-react">
        <h2>Browse Nominations</h2>
      </div>

      {/* Filter Controls */}
      <div className="browse-controls-react">
        <div className="browse-filter-group">
          <label htmlFor="browse-congress-filter">Congress:</label>
          <select
            id="browse-congress-filter"
            value={selectedCongress}
            onChange={handleCongressChange}
            disabled={isLoading}
          >
            <option value="">All Congresses</option> {/* Allow selecting all */}
            {congresses.map((c) => (
              <option key={c.number} value={c.number}>
                {c.number}
                {c.name ? ` (${c.name.split(" ")[0]})` : ""}
              </option>
            ))}
          </select>
        </div>
        {/* Add other filters like committee later if supported by API */}
        <button onClick={handleLoadClick} disabled={isLoading}>
          {isLoading ? "Loading..." : "Apply Filters"}
        </button>
      </div>

      {/* Status and Results */}
      <div className="results-container-react">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} />}
        {!isLoading && !error && (
          <>
            <ul className="results-list-react nomination-list">
              {" "}
              {/* Distinct class */}
              {nominations.length > 0 ? (
                nominations.map((nom) => (
                  // Use NominationListItem component
                  // Ensure a unique key - citation might not be unique across congresses if 'All' selected
                  <NominationListItem
                    key={`${nom.congress}-${nom.number}`}
                    nomination={nom}
                  />
                ))
              ) : (
                <li>No nominations found matching your criteria.</li>
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
export default BrowseNominationsPage;
