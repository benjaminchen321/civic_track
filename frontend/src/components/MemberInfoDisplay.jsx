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
// import "./MemberInfoDisplay.css"; // Assuming basic styles exist for layout

// Helper to parse offset from API's next/prev URLs
const parseOffsetFromUrl = (url) => {
  if (!url) return null;
  try {
    const fullUrl = url.startsWith("http") ? url : `https://example.com${url}`; // Dummy base if relative
    const params = new URL(fullUrl).searchParams;
    const offset = parseInt(params.get("offset"), 10);
    // console.log(`Parsed offset ${offset} from ${url}`); // Uncomment for debugging
    return isNaN(offset) ? null : offset;
  } catch (e) {
    console.error("Error parsing offset from URL:", url, e);
    return null;
  }
};

// Constant for items per page in lazy loading
const ITEMS_PER_PAGE = 15;

function MemberInfoDisplay({ bioguideId }) {
  const [activeTab, setActiveTab] = useState("details");

  // State for DETAILS tab (loaded initially)
  const [detailsState, setDetailsState] = useState({
    data: null,
    loading: true,
    error: null,
  });

  // State for LAZY LOADED Tabs (using standard useState)
  const [sponsoredState, setSponsoredState] = useState({
    items: [],
    pagination: null,
    currentOffset: 0,
    hasMore: false,
    totalCount: null,
    loading: false,
    error: null,
    loaded: false,
  });
  const [cosponsoredState, setCosponsoredState] = useState({
    items: [],
    pagination: null,
    currentOffset: 0,
    hasMore: false,
    totalCount: null,
    loading: false,
    error: null,
    loaded: false,
  });
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
      items: [],
      pagination: null,
      currentOffset: 0,
      hasMore: false,
      totalCount: null,
      loading: false,
      error: null,
      loaded: false,
    }); // Reset paginated state
    setCosponsoredState({
      items: [],
      pagination: null,
      currentOffset: 0,
      hasMore: false,
      totalCount: null,
      loading: false,
      error: null,
      loaded: false,
    }); // Reset paginated state
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
        setSponsoredState((prev) => ({ ...prev, totalCount: 0 })); // Set counts to 0 on error
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

    // Cleanup function
    return () => {
      console.log("MemberInfoDisplay: Cleanup for ", bioguideId);
      isStillMounted = false;
    };
  }, [bioguideId]); // Re-run ONLY when bioguideId changes

  // --- Lazy Load Tab Data ---
  // useCallback depends only on bioguideId, uses functional state updates
  const loadTabData = useCallback(
    async (tabName, offset = 0, append = false) => {
      if (!bioguideId) return;

      // Map tab name to state getter and setter
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
      if (!config) return;

      // Check current loading state before fetching
      if (config.stateGetter().loading) {
        console.log(`LoadTabData for ${tabName} aborted: already loading.`);
        return;
      }

      console.log(
        `MemberInfoDisplay: ${
          append ? "Loading more" : "Loading initial"
        } ${tabName} (Requesting Offset: ${offset})`
      );
      config.setter((prev) => ({ ...prev, loading: true, error: null })); // Set loading true

      const params =
        tabName === "sponsored" || tabName === "cosponsored"
          ? { limit: ITEMS_PER_PAGE, offset }
          : {};
      const { data: apiResponse, error: fetchError } = await config.fetchFn(
        bioguideId,
        params
      );
      const responseError = fetchError || apiResponse?.error;

      console.log(
        `MemberInfoDisplay: API response for ${tabName} (Offset: ${offset}):`,
        { apiResponse, responseError }
      );

      // Use functional update form to guarantee access to latest state
      config.setter((prev) => {
        console.log(
          `Setter running for ${tabName}. Append: ${append}. Prev items count: ${prev.items?.length}. Prev Offset: ${prev.currentOffset}`
        ); // Log previous state

        if (responseError) {
          console.error(`Error in setter for ${tabName}:`, responseError);
          return {
            ...prev,
            error: `Load Error: ${responseError}`,
            loading: false,
            loaded: true,
            items: append ? prev.items : [],
            pagination: prev.pagination,
            hasMore: append ? prev.hasMore : false,
          }; // Assume no more on error
        } else if (
          (tabName === "sponsored" || tabName === "cosponsored") &&
          apiResponse?.items !== undefined
        ) {
          const newItems = apiResponse.items || [];
          const newPagination = apiResponse.pagination || null;
          const currentTotalCount = prev.totalCount; // Preserve total count
          // Ensure prev.items is treated as an array before spreading
          const combinedItems = append
            ? [...(prev.items || []), ...newItems]
            : newItems;

          // --- FIX: Rely on API's next link presence for hasMore ---
          const newHasMore = !!newPagination?.next;
          // --- End FIX ---

          console.log(
            `Updating ${tabName}. Fetched: ${newItems.length}. Combined: ${combinedItems.length}. Total: ${currentTotalCount}. HasMore: ${newHasMore}. New Pagination obj:`,
            newPagination
          );

          return {
            ...prev, // Keep totalCount
            items: combinedItems,
            pagination: newPagination, // Store the NEW pagination object
            currentOffset: offset, // Store the offset actually requested
            hasMore: newHasMore, // Use flag derived from API pagination
            error: null,
            loading: false,
            loaded: true,
          };
        } else if (
          (tabName === "committees" || tabName === "votes") &&
          apiResponse
        ) {
          // Handle simpler state structure for these tabs
          return {
            ...prev,
            data: apiResponse,
            error: apiResponse.error || null,
            loading: false,
            loaded: true,
          };
        } else {
          // Unexpected structure from API
          console.error(
            `Invalid data structure in setter for ${tabName}:`,
            apiResponse
          );
          return {
            ...prev,
            error: `Invalid data structure for ${tabName}`,
            loading: false,
            loaded: true,
            items: append ? prev.items : [],
            hasMore: false,
          };
        }
      });
    },
    [bioguideId]
  ); // Only depends on bioguideId

  // --- Event Handlers ---
  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    // Use current state value to check if initial load is needed
    const configMap = {
      sponsored: sponsoredState,
      cosponsored: cosponsoredState,
      committees: committeesState,
      votes: votesState,
    };
    const currentState = configMap[tabName];
    if (currentState && !currentState.loaded && !currentState.loading) {
      loadTabData(tabName, 0, false); // Trigger initial load for the tab
    }
    // Scroll tab content to top on switch
    if (scrollableContentRef.current)
      scrollableContentRef.current.scrollTop = 0;
  };

  const handleLoadMore = (tabName) => {
    // Read current state directly when handler runs
    const currentState =
      tabName === "sponsored" ? sponsoredState : cosponsoredState;
    // --- FIX: Use pagination ref from state, check loading ---
    const currentPagination = currentState.pagination;
    const nextUrl = currentPagination?.next;

    console.log(
      `Load More clicked for ${tabName}. Current State Pagination:`,
      currentPagination
    );

    if (!nextUrl || currentState.loading) {
      // Check if next URL exists and not already loading
      console.log(
        `Load More condition failed: NextURL=${nextUrl}, Loading=${currentState?.loading}`
      );
      return;
    }
    const nextOffset = parseOffsetFromUrl(nextUrl); // Parse offset from the *correct* next URL
    console.log(`Attempting to load next offset: ${nextOffset}`);
    if (nextOffset !== null) {
      loadTabData(tabName, nextOffset, true); // Load next, APPEND data
    } else {
      console.warn(
        `Could not parse next offset for ${tabName} from URL:`,
        nextUrl
      );
      // Set error on the relevant state slice
      const configMap = {
        sponsored: setSponsoredState,
        cosponsored: setCosponsoredState,
      };
      const setter = configMap[tabName];
      if (setter) {
        setter((prev) => ({
          ...prev,
          error: "Failed to determine next page offset.",
        }));
      }
    }
  };

  const scrollToTop = () => {
    if (scrollableContentRef.current) {
      scrollableContentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // --- Scroll Listener for Back to Top ---
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
  }, [activeTab]); // Re-attach listener if scroll container changes per tab

  // --- Helper Render Legislation List ---
  const renderLegislationList = (stateData, listName) => {
    // stateData is { items, pagination, currentOffset, hasMore, totalCount, loading, error, loaded }
    if (!stateData.loaded && !stateData.loading)
      return <p className="tab-prompt">Click tab to load.</p>;
    if (stateData.loading && stateData.items.length === 0)
      return <LoadingSpinner />;

    const items = stateData.items || [];
    const hasMore = stateData.hasMore; // Use calculated flag based on pagination.next
    const isLoadingMore = stateData.loading && items.length > 0;

    return (
      <>
        {stateData.error && <ErrorMessage message={stateData.error} />}
        {items.length > 0 ? (
          <ul className="results-list-react bill-list">
            {items.map((item, index) => (
              <BillListItem
                key={`${item.congress}-${item.type}-${item.number}-${index}`}
                bill={item}
              />
            ))}
          </ul>
        ) : (
          stateData.loaded &&
          !stateData.loading &&
          !stateData.error && <p>No {listName} items found.</p>
        )}
        {/* Load More Button - Render based on calculated hasMore flag */}
        {hasMore && (
          <div className="load-more-container">
            <button
              onClick={() => handleLoadMore(listName)}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
        {isLoadingMore && <LoadingSpinner />}
      </>
    );
  };

  // --- Helper Render Details Tab ---
  const renderDetailsTab = () => {
    // console.log("Render Details Tab - State:", detailsState);
    if (detailsState.loading) return <LoadingSpinner />;
    if (detailsState.error)
      return <ErrorMessage message={detailsState.error} />;
    if (!detailsState.data) return <p>No details available to display.</p>;
    const detailsData = detailsState.data;
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
  // Read counts from the respective state objects for display
  const displaySponsoredCount =
    sponsoredState.totalCount !== null ? sponsoredState.totalCount : "?";
  const displayCosponsoredCount =
    cosponsoredState.totalCount !== null ? cosponsoredState.totalCount : "?";

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
        {/* Sponsored Tab - Use State directly */}
        <div
          className={`tab-pane ${activeTab === "sponsored" ? "active" : ""}`}
        >
          {activeTab === "sponsored" &&
            renderLegislationList(sponsoredState, "sponsored")}
        </div>
        {/* Cosponsored Tab - Use State directly */}
        <div
          className={`tab-pane ${activeTab === "cosponsored" ? "active" : ""}`}
        >
          {activeTab === "cosponsored" &&
            renderLegislationList(cosponsoredState, "cosponsored")}
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
