// FILE: frontend/src/pages/MemberSearchPage.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchMembers /*, fetchCongresses */ } from "../services/api"; // Assuming fetchCongresses might be added later
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import MemberFilters from "../components/MemberFilters";
import MemberSelect from "../components/MemberSelect";
import MemberInfoDisplay from "../components/MemberInfoDisplay";
import "../styles/MemberSearchPage.css"; // Import specific styles if created

// --- Mock/Placeholder Data ---
// TODO: Replace MOCK_CONGRESSES with a fetchCongresses call if implemented
const MOCK_CONGRESSES = [
  { number: 118, name: "118th (2023-2024)", startYear: 2023, endYear: 2024 },
  { number: 117, name: "117th (2021-2022)", startYear: 2021, endYear: 2022 },
  { number: 116, name: "116th (2019-2020)", startYear: 2019, endYear: 2020 },
  // Add more historical congresses if needed for the dropdown
];
// TODO: Move STATES_LIST to a constants file or fetch if dynamic
const MOCK_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
  "American Samoa",
  "District of Columbia",
  "Federated States of Micronesia",
  "Guam",
  "Marshall Islands",
  "Northern Mariana Islands",
  "Palau",
  "Puerto Rico",
  "Virgin Islands",
].sort();
const MOCK_CHAMBERS = ["House", "Senate"]; // Static is fine

function MemberSearchPage() {
  // --- State Variables ---
  const [congressList] = useState(MOCK_CONGRESSES); // Holds congress options
  const [states] = useState(MOCK_STATES);
  const [chambers] = useState(MOCK_CHAMBERS);

  const [allMembersForCongress, setAllMembersForCongress] = useState([]); // Raw list from API for selected congress
  const [filteredMembers, setFilteredMembers] = useState([]); // Members matching UI filters

  // Filter State - Initialize with default congress
  const [currentCongress, setCurrentCongress] = useState(
    MOCK_CONGRESSES[0]?.number?.toString() || ""
  );
  const [filters, setFilters] = useState({
    name: "",
    party: "ALL",
    chamber: "ALL",
    state: "ALL",
  });

  // UI State
  const [selectedMemberBioguide, setSelectedMemberBioguide] = useState(""); // Currently selected member ID in dropdown
  const [isInitialLoading, setIsInitialLoading] = useState(true); // Loading indicator for the *first* member list load
  const [memberListError, setMemberListError] = useState(null); // Error specific to member list fetching

  // --- Refs ---
  const memberSelectRef = useRef(null); // To reset dropdown selection visually if needed

  // --- Router Hooks ---
  const location = useLocation();
  const navigate = useNavigate();
  const [initialHashProcessed, setInitialHashProcessed] = useState(false); // Prevent hash processing loop

  // --- Callbacks ---

  // Load list of members for a specific congress
  const loadMemberList = useCallback(async (congressNum) => {
    if (!congressNum) {
      setAllMembersForCongress([]);
      setFilteredMembers([]);
      setMemberListError("Please select a Congress.");
      setIsInitialLoading(false); // Stop initial load indicator
      return;
    }
    console.log(`Requesting members for Congress: ${congressNum}`);
    // Keep isInitialLoading true only on first load, not subsequent congress changes
    // setIsLoadingMembers(true); // Using isInitialLoading for the very first time
    setMemberListError(null);
    setAllMembersForCongress([]); // Clear previous data immediately
    setFilteredMembers([]);

    const { data, error } = await fetchMembers(congressNum); // Call API service

    if (error) {
      setMemberListError(`Error loading members: ${error}`);
      setAllMembersForCongress([]);
    } else if (data && Array.isArray(data)) {
      // Check if data is an array
      setAllMembersForCongress(data);
      setMemberListError(null); // Clear previous errors
    } else {
      // Handle case where data is not an array (e.g., empty response or unexpected format)
      setMemberListError(
        "Received unexpected data structure for members list."
      );
      setAllMembersForCongress([]);
      console.warn("Received non-array or missing data for members:", data);
    }
    setIsInitialLoading(false); // Turn off initial loading indicator after first successful/failed load
  }, []); // Empty dependency array, relies on congressNum arg

  // Filter the raw member list based on current UI filter state
  const applyFilters = useCallback(() => {
    const { name, party, chamber, state } = filters;
    const nameLower = name.toLowerCase().trim();

    const matching = allMembersForCongress
      .filter((m) => {
        if (!m) return false;
        const nameMatch =
          !nameLower || m.name?.toLowerCase().includes(nameLower);
        const stateMatch = state === "ALL" || m.state === state;
        const chamberMatch =
          chamber === "ALL" ||
          m.chamber?.toUpperCase() === chamber.toUpperCase();
        const partyCode = m.party_code || "ID";
        const partyMatch =
          party === "ALL" ||
          (party === "ID"
            ? !["D", "R"].includes(partyCode)
            : partyCode === party);
        return nameMatch && stateMatch && chamberMatch && partyMatch;
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    setFilteredMembers(matching);

    // Clear selection if the selected member is filtered out
    if (
      selectedMemberBioguide &&
      !matching.some((m) => m.bioguide_id === selectedMemberBioguide)
    ) {
      console.log(
        "Selected member",
        selectedMemberBioguide,
        "filtered out. Clearing selection."
      );
      setSelectedMemberBioguide("");
      if (memberSelectRef.current) {
        memberSelectRef.current.value = "";
      }
    }
  }, [allMembersForCongress, filters, selectedMemberBioguide]);

  // --- Effects ---

  // TODO: Fetch Congress list dynamically
  // useEffect(() => { fetchCongresses()... }, []);

  // Load members when selected congress changes
  useEffect(() => {
    if (currentCongress) {
      setIsInitialLoading(true); // Set loading true when congress changes
      loadMemberList(currentCongress);
    } else {
      // Handle case where no congress is selected (e.g., if 'All Congresses' was an option)
      setAllMembersForCongress([]);
      setFilteredMembers([]);
      setIsInitialLoading(false);
    }
  }, [currentCongress, loadMemberList]); // Rerun when congress changes

  // Apply filters when raw list or filters change
  useEffect(() => {
    // Check if members have loaded before applying filters
    if (!isInitialLoading || allMembersForCongress.length > 0) {
      applyFilters();
    }
  }, [allMembersForCongress, filters, applyFilters, isInitialLoading]);

  // Handle initial member selection via URL hash
  useEffect(() => {
    // Process only once after the initial members have potentially loaded
    if (
      !initialHashProcessed &&
      !isInitialLoading &&
      allMembersForCongress.length > 0
    ) {
      const hash = location.hash;
      if (hash && hash.startsWith("#member=")) {
        const bioguideIdFromHash = hash.substring(8);
        console.log(
          "Hash detected, attempting to select member:",
          bioguideIdFromHash
        );

        const memberExists = allMembersForCongress.some(
          (m) => m.bioguide_id === bioguideIdFromHash
        );
        if (memberExists) {
          console.log(
            "Member found in list, setting selected ID and clearing hash."
          );
          setSelectedMemberBioguide(bioguideIdFromHash);
          navigate(location.pathname, { replace: true }); // Clear hash
        } else {
          console.warn("Member from hash not found in current Congress list.");
          setMemberListError(
            `Member ${bioguideIdFromHash} from link not found in Congress ${currentCongress}.`
          );
          navigate(location.pathname, { replace: true }); // Clear hash anyway
        }
      }
      setInitialHashProcessed(true); // Mark hash as processed for this load
    }
  }, [
    location,
    navigate,
    allMembersForCongress,
    isInitialLoading,
    initialHashProcessed,
  ]); // Depend on loading state

  // --- Event Handlers ---
  const handleCongressChange = (event) => {
    const newCongress = event.target.value;
    setCurrentCongress(newCongress);
    // Reset filters and clear selection when congress changes
    setFilters({ name: "", party: "ALL", chamber: "ALL", state: "ALL" });
    setSelectedMemberBioguide("");
    setInitialHashProcessed(false); // Allow hash processing again for new congress
    // loadMemberList is triggered by useEffect
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters); // Update filter state which triggers applyFilters effect
  };

  const handleMemberSelect = (bioguideId) => {
    setSelectedMemberBioguide(bioguideId); // Update selected member ID
  };

  // --- Render ---
  if (isInitialLoading && !memberListError) {
    // --- FIX: More accurate initial loading message ---
    return (
      <div className="initial-loading-container">
        <LoadingSpinner />
        <p>Loading members for Congress {currentCongress || "selected"}...</p>
      </div>
    );
  }
  if (isInitialLoading && memberListError) {
    return (
      <div className="initial-loading-container">
        <ErrorMessage message={memberListError} />
        <p>Please select a different Congress or check API status.</p>
        {/* Keep filters visible to allow recovery */}
        <MemberFilters
          congresses={congressList}
          states={states}
          chambers={chambers}
          currentCongress={currentCongress}
          filters={filters}
          onCongressChange={handleCongressChange}
          onFilterChange={handleFilterChange}
          isLoading={false}
        />
      </div>
    );
  }

  // --- Main Render after initial load ---
  return (
    <div className="member-search-container">
      <MemberFilters
        congresses={congressList}
        states={states}
        chambers={chambers}
        currentCongress={currentCongress}
        filters={filters}
        onCongressChange={handleCongressChange}
        onFilterChange={handleFilterChange}
        isLoading={false} // Filters always usable after initial load attempt
      />

      <MemberSelect
        members={filteredMembers}
        selectedMemberBioguide={selectedMemberBioguide}
        onMemberSelect={handleMemberSelect}
        isLoading={false} // Don't disable dropdown, message inside handles state
        error={memberListError}
        selectRef={memberSelectRef}
      />

      {/* Show list loading error here if it happened *after* initial load (e.g., switching congress failed) */}
      {memberListError && !isInitialLoading && (
        <ErrorMessage message={memberListError} />
      )}

      {/* Member Info Display Area */}
      {selectedMemberBioguide && (
        <MemberInfoDisplay
          key={selectedMemberBioguide} // Force remount on ID change
          bioguideId={selectedMemberBioguide}
        />
      )}
      {/* Prompt to select member if none selected and no list error */}
      {!selectedMemberBioguide && !memberListError && (
        <div className="select-member-prompt">
          {
            allMembersForCongress.length > 0 && filteredMembers.length === 0
              ? "No members match the current filters."
              : allMembersForCongress.length > 0
              ? "Select a member from the dropdown above to see details."
              : !isInitialLoading // Only show if not in initial load state
              ? `No members found or loaded for Congress ${currentCongress}.`
              : "" // Should be showing initial loader
          }
        </div>
      )}
    </div>
  );
}
export default MemberSearchPage;
