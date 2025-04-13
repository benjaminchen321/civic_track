// FILE: frontend/src/components/MemberInfoDisplay.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import BillListItem from "./BillListItem"; // Renders individual legislation items
import {
  fetchMemberDetails,
  fetchSponsored,
  fetchCosponsored,
  fetchMemberCommittees,
  fetchMemberVotes,
} from "../services/api"; // API call functions
import PaginationFE from "./PaginationFE"; // --- NEW: Import Frontend Pagination ---

// Constant for items per page in lazy loading
const ITEMS_PER_PAGE = 15;
// --- NEW: How many items to show per page on FRONTEND ---
const ITEMS_PER_PAGE_FE = 10;

function MemberInfoDisplay({ bioguideId }) {
  const [activeTab, setActiveTab] = useState("details");

  // State for DETAILS tab (loaded initially)
  const [detailsState, setDetailsState] = useState({
    data: null,
    loading: true,
    error: null,
  });

  // --- State for List Tabs (Stores ALL items after fetch) ---
  const [sponsoredState, setSponsoredState] = useState({
    allItems: [],
    totalCount: null,
    loading: false,
    error: null,
    loaded: false,
  });
  const [cosponsoredState, setCosponsoredState] = useState({
    allItems: [],
    totalCount: null,
    loading: false,
    error: null,
    loaded: false,
  });
  // --- Current page for FRONTEND pagination ---
  const [sponsoredCurrentPage, setSponsoredCurrentPage] = useState(1);
  const [cosponsoredCurrentPage, setCosponsoredCurrentPage] = useState(1);
  // --- End State Changes ---

  // Simpler state for non-paginated/unimplemented tabs
  const [committeesState, setCommitteesState] = useState({
    data: null,
    error: null,
    loading: false,
    loaded: false,
  });
  const [votesState, setVotesState] = useState({
    data: null,
    error: null,
    loading: false,
    loaded: false,
  });

  // Back to Top state & Ref
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollableContentRef = useRef(null); // Ref for the scrollable div

  // --- Fetch Member Details (and initial counts) ---
  useEffect(() => {
    let isStillMounted = true;
    console.log(
      `MemberInfoDisplay: useEffect[bioguideId] START for: ${bioguideId}`
    );
    // Reset all states completely when bioguideId changes
    setDetailsState({ data: null, loading: true, error: null });
    setSponsoredState({
      allItems: [],
      totalCount: null,
      loading: false,
      error: null,
      loaded: false,
    }); // Reset list state
    setCosponsoredState({
      allItems: [],
      totalCount: null,
      loading: false,
      error: null,
      loaded: false,
    }); // Reset list state
    setSponsoredCurrentPage(1); // Reset page number
    setCosponsoredCurrentPage(1); // Reset page number
    setCommitteesState({
      data: null,
      error: null,
      loading: false,
      loaded: false,
    });
    setVotesState({ data: null, error: null, loading: false, loaded: false });
    setActiveTab("details");
    setShowBackToTop(false);

    if (!bioguideId) {
      setDetailsState({
        data: null,
        loading: false,
        error: "No Bioguide ID provided.",
      });
      return;
    }

    const loadDetails = async () => {
      console.log(`MemberInfoDisplay: Fetching details for ${bioguideId}`);
      const { data: detailsResponse, error: fetchError } =
        await fetchMemberDetails(bioguideId);

      if (!isStillMounted) return;

      console.log("MemberInfoDisplay: Details API Response:", {
        detailsResponse,
        fetchError,
      });
      const actualError = fetchError || detailsResponse?.error;

      if (actualError) {
        console.error("Error loading member details:", actualError);
        setDetailsState({
          data: null,
          loading: false,
          error: `Details Error: ${actualError}`,
        });
        // Set counts to 0 if details fail
        setSponsoredState((prev) => ({ ...prev, totalCount: 0 }));
        setCosponsoredState((prev) => ({ ...prev, totalCount: 0 }));
      } else if (detailsResponse?.details) {
        const detailsData = detailsResponse.details;
        console.log("MemberInfoDisplay: Setting details data:", detailsData);
        setDetailsState({ data: detailsData, loading: false, error: null });
        // Set initial total counts into the specific tab states
        const spCount = detailsData.sponsoredLegislation?.count ?? 0;
        const coCount = detailsData.cosponsoredLegislation?.count ?? 0;
        console.log(
          "MemberInfoDisplay: Setting initial counts - Sponsored:",
          spCount,
          "Cosponsored:",
          coCount
        );
        setSponsoredState((prev) => ({ ...prev, totalCount: spCount }));
        setCosponsoredState((prev) => ({ ...prev, totalCount: coCount }));
      } else {
        console.error("Invalid details data structure:", detailsResponse);
        setDetailsState({
          data: null,
          loading: false,
          error: "Invalid details data structure received.",
        });
        setSponsoredState((prev) => ({ ...prev, totalCount: 0 }));
        setCosponsoredState((prev) => ({ ...prev, totalCount: 0 }));
      }
    };

    loadDetails();
    return () => {
      isStillMounted = false;
    }; // Cleanup
  }, [bioguideId]); // Dependency array is correct

  // --- Load ALL data for a tab ---
  const loadAllTabData = useCallback(
    async (tabName) => {
      if (!bioguideId) return;
      const tabConfigMap = {
        sponsored: {
          stateGetter: () => sponsoredState,
          setter: setSponsoredState,
          fetchFn: fetchSponsored,
        },
        cosponsored: {
          stateGetter: () => cosponsoredState,
          setter: setCosponsoredState,
          fetchFn: fetchCosponsored,
        },
        committees: {
          stateGetter: () => committeesState,
          setter: setCommitteesState,
          fetchFn: fetchMemberCommittees,
        },
        votes: {
          stateGetter: () => votesState,
          setter: setVotesState,
          fetchFn: fetchMemberVotes,
        },
      };
      const config = tabConfigMap[tabName];
      if (
        !config ||
        config.stateGetter().loading ||
        config.stateGetter().loaded
      ) {
        // Don't reload if already loaded or currently loading
        return;
      }

      console.log(`MemberInfoDisplay: Loading ALL ${tabName}`);
      config.setter((prev) => ({ ...prev, loading: true, error: null }));

      // Fetch function now returns { items, count, error } from backend service
      const { data: apiResponse, error: fetchError } = await config.fetchFn(
        bioguideId
      ); // No limit/offset params needed now
      const responseError = fetchError || apiResponse?.error;

      console.log(`MemberInfoDisplay: API response for ALL ${tabName}:`, {
        apiResponse,
        responseError,
      });

      config.setter((prev) => {
        if (responseError) {
          console.error(`Error loading ALL ${tabName}:`, responseError);
          return {
            ...prev,
            error: `Load Error: ${responseError}`,
            loading: false,
            loaded: true,
            allItems: [], // Reset items on error
            totalCount: 0, // Reset count on error
          };
        } else if (
          (tabName === "sponsored" || tabName === "cosponsored") &&
          apiResponse?.items !== undefined
        ) {
          const allItems = apiResponse.items || [];
          // Use count from response if available, otherwise use items length or previous state
          const finalTotalCount =
            apiResponse.count ?? prev.totalCount ?? allItems.length;

          console.log(
            `Updating state for ${tabName}. ALL Items: ${allItems.length}. Total Count: ${finalTotalCount}.`
          );

          return {
            ...prev,
            allItems: allItems, // Store ALL fetched items
            totalCount: finalTotalCount, // Update total count from this response
            error: null,
            loading: false,
            loaded: true,
          };
        } else if (
          (tabName === "committees" || tabName === "votes") &&
          apiResponse
        ) {
          // Handle non-paginated simple state update
          return {
            ...prev,
            data: apiResponse,
            error: apiResponse.error || null,
            loading: false,
            loaded: true,
          };
        } else {
          // Unexpected list structure
          console.error(`Invalid data structure for ${tabName}:`, apiResponse);
          return {
            ...prev,
            error: `Invalid data structure for ${tabName}`,
            loading: false,
            loaded: true,
            allItems: [],
          };
        }
      });
    },
    [bioguideId]
  ); // Only depends on bioguideId

  // --- Event Handlers ---
  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    // Use current state value to check if initial load needed
    const configMap = {
      sponsored: sponsoredState,
      cosponsored: cosponsoredState,
      committees: committeesState,
      votes: votesState,
    };
    const currentState = configMap[tabName];

    if (tabName === "sponsored" || tabName === "cosponsored") {
      // Trigger load only if not already loaded or currently loading
      if (currentState && !currentState.loaded && !currentState.isLoading) {
        console.log(`Switching to ${tabName}, triggering load.`);
        // Reset current page to 1 for the specific tab
        if (tabName === "sponsored") setSponsoredCurrentPage(1);
        else if (tabName === "cosponsored") setCosponsoredCurrentPage(1);
        loadAllTabData(tabName); // Load all data for this tab
      }
    } else {
      // Handle non-list tabs as before
      if (currentState && !currentState.loaded && !currentState.loading) {
        const setter =
          tabName === "committees" ? setCommitteesState : setVotesState;
        const fetchFn =
          tabName === "committees" ? fetchMemberCommittees : fetchMemberVotes;
        setter((prev) => ({ ...prev, loading: true }));
        fetchFn(bioguideId).then(({ data, error }) => {
          setter({ data, error, loading: false, loaded: true });
        });
      }
    }

    if (scrollableContentRef.current)
      scrollableContentRef.current.scrollTop = 0;
  };

  // --- FIX: Remove handleLoadMore ---

  // --- Scroll Logic & Back to Top ---
  const scrollToTop = () => {
    if (scrollableContentRef.current) {
      scrollableContentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  useEffect(() => {
    const scrollableElement = scrollableContentRef.current;
    if (!scrollableElement) return;
    let isActive = true;
    const handleScroll = () => {
      if (!isActive) return;
      setShowBackToTop(scrollableElement.scrollTop > 300);
    };
    scrollableElement.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    handleScroll(); // Initial check
    return () => {
      // Cleanup
      isActive = false;
      if (scrollableElement)
        scrollableElement.removeEventListener("scroll", handleScroll);
    };
  }, [activeTab]); // Dependency okay

  // --- Helper Render Legislation List with Frontend Pagination ---
  const renderLegislationList = (
    stateData,
    listName,
    currentPage,
    setCurrentPage
  ) => {
    // stateData is sponsoredState or cosponsoredState
    if (!stateData.loaded && !stateData.isLoading)
      return <p className="tab-prompt">Loading data...</p>; // Show loading prompt
    if (stateData.isLoading) return <LoadingSpinner />; // Show spinner while fetching ALL

    // Use allItems for FE pagination
    const items = stateData.allItems || [];
    const totalItems = stateData.totalCount ?? items.length; // Use known total or length

    // --- Frontend Pagination Logic ---
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE_FE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE_FE;
    const endIndex = startIndex + ITEMS_PER_PAGE_FE;
    const itemsToShow = items.slice(startIndex, endIndex);
    // --- End FE Pagination Logic ---

    return (
      <>
        {stateData.error && <ErrorMessage message={stateData.error} />}
        {items.length > 0 ? (
          <>
            <ul className="results-list-react bill-list">
              {itemsToShow.map((item, index) => (
                <BillListItem
                  key={`${item.congress}-${item.type}-${item.number}-${
                    startIndex + index
                  }`}
                  bill={item}
                />
              ))}
            </ul>
            {/* --- Add Frontend Pagination Component --- */}
            <PaginationFE
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => {
                setCurrentPage(page);
                // Scroll to top of list when changing page
                if (scrollableContentRef.current)
                  scrollableContentRef.current.scrollTop = 0;
              }}
            />
          </>
        ) : (
          stateData.loaded &&
          !stateData.isLoading &&
          !stateData.error && <p>No {listName} items found.</p>
        )}
        {/* Remove Load More Button */}
      </>
    );
  };

  // --- Helper Render Details Tab ---
  const renderDetailsTab = () => {
    if (detailsState.loading) return <LoadingSpinner />;
    if (detailsState.error)
      return <ErrorMessage message={detailsState.error} />;
    if (!detailsState.data) return <p>No details available.</p>;
    const detailsData = detailsState.data;
    // Keep the full JSX structure for rendering details here
    return (
      <div className="member-details-content">
        <h4>Member Details</h4>
        <div className="details-top-section">
          <div className="member-photo-container">
            {detailsData.depiction?.imageUrl ? (
              <img
                src={detailsData.depiction.imageUrl}
                alt={`Photo of ${detailsData.name}`}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : detailsData.bioguide_id ? (
              <img
                src={`https://bioguide.congress.gov/bioguide/photo/${detailsData.bioguide_id[0]}/${detailsData.bioguide_id}.jpg`}
                alt={`Photo of ${detailsData.name}`}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <span>No Photo</span>
            )}
            {detailsData.depiction?.attribution && (
              <span
                className="photo-attribution-text"
                dangerouslySetInnerHTML={{
                  __html: detailsData.depiction.attribution,
                }}
              ></span>
            )}
          </div>
          <div className="member-details-grid">
            <strong>Name:</strong>
            <span>
              {detailsData.honorificName
                ? `${detailsData.honorificName}. `
                : ""}
              {detailsData.name || "N/A"}
            </span>
            <strong>Party:</strong>
            <span>{detailsData.party || "N/A"}</span>
            <strong>State:</strong>
            <span>{detailsData.state || "N/A"}</span>
            {detailsData.terms?.[0]?.chamber && (
              <>
                <strong>Chamber:</strong>
                <span>
                  {detailsData.terms[0].chamber.includes("House")
                    ? "House"
                    : detailsData.terms[0].chamber.includes("Senate")
                    ? "Senate"
                    : detailsData.terms[0].chamber}
                </span>
              </>
            )}
            {detailsData.birth_year && (
              <>
                <strong>Born:</strong>
                <span>{detailsData.birth_year}</span>
              </>
            )}
            {detailsData.website_url && (
              <>
                <strong>Website:</strong>
                <span>
                  <a
                    href={
                      detailsData.website_url.startsWith("http")
                        ? detailsData.website_url
                        : `https://${detailsData.website_url}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Official Website
                  </a>
                </span>
              </>
            )}
          </div>
        </div>
        <div className="details-history-section">
          <div className="history-group">
            <h5>Term History</h5>
            <ul>
              {detailsData.terms?.length > 0 ? (
                detailsData.terms.map((term, i) => (
                  <li key={`${term.congress}-${i}`}>
                    <strong>{term.congress}th Cong.</strong> (
                    {term.startYear || "?"} - {term.endYear || "Present"})<br />
                    <span>
                      {term.chamber || "?"} -{" "}
                      {term.stateName || term.stateCode || "?"}{" "}
                      {term.district ? `(Dist. ${term.district})` : ""}
                    </span>
                  </li>
                ))
              ) : (
                <li>N/A</li>
              )}
            </ul>
          </div>
          <div className="history-group">
            <h5>Party History</h5>
            <ul>
              {detailsData.partyHistory?.length > 0 ? (
                detailsData.partyHistory.map((p, i) => (
                  <li key={`${p.startYear}-${i}`}>
                    <strong>{p.partyName || "?"}</strong> ({p.startYear || "?"}{" "}
                    - {p.endYear || "Present"})
                  </li>
                ))
              ) : (
                <li>N/A</li>
              )}
            </ul>
          </div>
          <div className="history-group">
            <h5>Leadership History</h5>
            <ul>
              {detailsData.leadership?.length > 0 ? (
                detailsData.leadership.map((l, i) => (
                  <li key={`${l.congress}-${i}`}>
                    <strong>{l.type || "?"}</strong> (Cong. {l.congress || "?"})
                    {l.startDate && (
                      <>
                        <br />
                        <span>
                          {l.startDate} - {l.endDate || "Present"}
                        </span>
                      </>
                    )}
                  </li>
                ))
              ) : (
                <li>No leadership roles listed.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // --- Main Render ---
  // Get counts from details state for initial display
  const displaySponsoredCount =
    detailsState.data?.sponsoredLegislation?.count ?? "?";
  const displayCosponsoredCount =
    detailsState.data?.cosponsoredLegislation?.count ?? "?";

  return (
    <div className="member-info-react">
      {/* Tab Navigation */}
      <div className="tab-nav-react">
        <button
          onClick={() => handleTabClick("details")}
          className={activeTab === "details" ? "active" : ""}
        >
          Details
        </button>
        <button
          onClick={() => handleTabClick("sponsored")}
          className={activeTab === "sponsored" ? "active" : ""}
        >
          Sponsored ({displaySponsoredCount})
        </button>
        <button
          onClick={() => handleTabClick("cosponsored")}
          className={activeTab === "cosponsored" ? "active" : ""}
        >
          Cosponsored ({displayCosponsoredCount})
        </button>
        <button
          onClick={() => handleTabClick("committees")}
          className={activeTab === "committees" ? "active" : ""}
        >
          Committees
        </button>
        <button
          onClick={() => handleTabClick("votes")}
          className={activeTab === "votes" ? "active" : ""}
        >
          Votes
        </button>
      </div>

      {/* Tab Content */}
      <div
        className="tab-content-react"
        ref={scrollableContentRef}
        style={{ maxHeight: "70vh", overflowY: "auto" }}
      >
        {/* Details Tab */}
        <div className={`tab-pane ${activeTab === "details" ? "active" : ""}`}>
          {activeTab === "details" && renderDetailsTab()}
        </div>
        {/* Sponsored Tab */}
        <div
          className={`tab-pane ${activeTab === "sponsored" ? "active" : ""}`}
        >
          {activeTab === "sponsored" &&
            renderLegislationList(
              sponsoredState,
              "sponsored",
              sponsoredCurrentPage,
              setSponsoredCurrentPage
            )}
        </div>
        {/* Cosponsored Tab */}
        <div
          className={`tab-pane ${activeTab === "cosponsored" ? "active" : ""}`}
        >
          {activeTab === "cosponsored" &&
            renderLegislationList(
              cosponsoredState,
              "cosponsored",
              cosponsoredCurrentPage,
              setCosponsoredCurrentPage
            )}
        </div>
        {/* Committees Tab */}
        <div
          className={`tab-pane ${activeTab === "committees" ? "active" : ""}`}
        >
          {activeTab === "committees" && (
            <>
              <h4>Committee Assignments</h4>{" "}
              {committeesState.loading && <LoadingSpinner />}{" "}
              {committeesState.error && (
                <ErrorMessage message={committeesState.error} />
              )}{" "}
              {committeesState.loaded &&
                !committeesState.loading &&
                !committeesState.error && (
                  <p>No committee data available via API.</p>
                )}
            </>
          )}
        </div>
        {/* Votes Tab */}
        <div className={`tab-pane ${activeTab === "votes" ? "active" : ""}`}>
          {activeTab === "votes" && (
            <>
              <h4>Recent Votes</h4> {votesState.loading && <LoadingSpinner />}{" "}
              {votesState.error && <ErrorMessage message={votesState.error} />}{" "}
              {votesState.loaded &&
                !votesState.loading &&
                !votesState.error && <p>Voting record data not implemented.</p>}
            </>
          )}
        </div>
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="back-to-top"
          title="Scroll back to top"
        >
          ↑ Top
        </button>
      )}
    </div>
  );
}
export default MemberInfoDisplay;
