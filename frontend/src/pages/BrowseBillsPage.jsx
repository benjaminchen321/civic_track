// FILE: frontend/src/pages/BrowseBillsPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { fetchBills } from "../services/api"; // Import API function
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import Pagination from "../components/Pagination";
import BillListItem from "../components/BillListItem"; // Import the new component
import '../styles/BrowsePages.css';

// Mock/Placeholder data - Replace later if needed
const MOCK_CONGRESSES = [
  { number: 118, name: "118th (2023-2024)" },
  { number: 117, name: "117th (2021-2022)" },
  // Add more or fetch dynamically
];
// Ideally, get this from config or API if it changes
const BILL_TYPES = [
  { code: "", name: "All Types" },
  { code: "hr", name: "HR" },
  { code: "s", name: "S" },
  { code: "hres", name: "HRES" },
  { code: "sres", name: "SRES" },
  { code: "hjres", name: "HJRES" },
  { code: "sjres", name: "SJRES" },
  { code: "hconres", name: "HCONRES" },
  { code: "sconres", name: "SCONRES" },
];

function BrowseBillsPage() {
  const [bills, setBills] = useState([]);
  const [congresses] = useState(MOCK_CONGRESSES);
  const [billTypes] = useState(BILL_TYPES);

  // Filter State
  const [selectedCongress, setSelectedCongress] = useState(
    MOCK_CONGRESSES[0]?.number?.toString() || ""
  );
  const [selectedBillType, setSelectedBillType] = useState(""); // Default to All Types

  // Data Fetching State
  const [pagination, setPagination] = useState(null);
  const [currentPageOffset, setCurrentPageOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const itemsPerPage = 20; // Match API default/limit

  // --- Fetching Logic ---
  const loadBills = useCallback(
    async (offset = 0) => {
      setIsLoading(true);
      setError(null);
      setPagination(null); // Clear pagination before fetch

      const params = {
        congress: selectedCongress, // Congress is required for bill browsing endpoint
        limit: itemsPerPage,
        offset: offset,
      };
      if (selectedBillType) {
        params.billType = selectedBillType;
      }

      const { data, error: apiError } = await fetchBills(params);

      if (apiError) {
        setError(apiError);
        setBills([]);
      } else if (data && data.bills !== undefined) {
        setBills(data.bills || []);
        setPagination(data.pagination || null);
        setError(null);
      } else {
        setError("Received unexpected data structure from API.");
        setBills([]);
      }
      setCurrentPageOffset(offset);
      setIsLoading(false);
    },
    [selectedCongress, selectedBillType]
  ); // Dependencies

  // --- Initial Load ---
  useEffect(() => {
    console.log("BrowseBillsPage mounted. Loading initial data.");
    if (selectedCongress) {
      // Only load if a congress is selected
      loadBills(0);
    } else {
      // Handle case where no default congress is available initially
      setBills([]);
      setError("Please select a Congress to load bills.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  // --- Event Handlers ---
  const handleCongressChange = (e) => setSelectedCongress(e.target.value);
  const handleBillTypeChange = (e) => setSelectedBillType(e.target.value);

  const handleLoadClick = () => {
    if (!selectedCongress) {
      setError("Please select a Congress.");
      return;
    }
    loadBills(0); // Load first page with current filters
  };

  const handlePageChange = (newOffset) => {
    if (
      newOffset !== null &&
      newOffset !== currentPageOffset &&
      selectedCongress
    ) {
      loadBills(newOffset);
    }
  };

  // --- Render ---
  return (
    <div>
      <div className="page-header-react">
        <h2>Browse Bills</h2>
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
            {/* Optional: Add a "Select Congress" default option if needed */}
            {/* <option value="">Select Congress</option> */}
            {congresses.map((c) => (
              <option key={c.number} value={c.number}>
                {c.number}
                {c.name ? ` (${c.name.split(" ")[0]})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="browse-filter-group">
          <label htmlFor="browse-billtype-filter">Bill Type:</label>
          <select
            id="browse-billtype-filter"
            value={selectedBillType}
            onChange={handleBillTypeChange}
            disabled={isLoading}
          >
            {billTypes.map((bt) => (
              <option key={bt.code} value={bt.code}>
                {bt.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleLoadClick}
          disabled={isLoading || !selectedCongress}
        >
          {isLoading ? "Loading..." : "Apply Filters"}
        </button>
      </div>

      {/* Status and Results */}
      <div className="results-container-react">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} />}
        {!isLoading && !error && (
          <>
            <ul className="results-list-react bill-list">
              {" "}
              {/* Distinct class */}
              {bills.length > 0 ? (
                bills.map((bill) => (
                  <BillListItem
                    key={`${bill.congress}-${bill.type}-${bill.number}`}
                    bill={bill}
                  />
                ))
              ) : (
                <li>No bills found matching your criteria.</li>
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
export default BrowseBillsPage;
