// FILE: static/script.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Loaded. Initializing CivicTrack...");

  // --- References ---
  const memberSelect = document.getElementById("member-select");
  const memberListLoader = document.getElementById("member-list-loader");
  const memberListError = document.getElementById("member-list-error");
  const congressFilterSelect = document.getElementById("congress-filter");
  const nameSearchInput = document.getElementById("name-search");
  const partyFilters = document.querySelectorAll('input[name="party-filter"]');
  const chamberFilters = document.querySelectorAll(
    'input[name="chamber-filter"]'
  );
  const stateFilterSelect = document.getElementById("state-filter");

  const memberInfoDiv = document.getElementById("member-info");
  const tabNav = document.querySelector(".tab-nav"); // Reference to the tab container
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabPanes = document.querySelectorAll(".tab-pane");

  // Tab Content References (Status divs and Lists)
  const memberDetailsStatusDiv = document.getElementById(
    "member-details-status"
  );
  const memberDetailsCoreContainer = document.getElementById(
    "member-details-core"
  );
  const memberPhoto = document.getElementById("member-photo");
  const photoLoadingError = document.getElementById("photo-loading-error");
  const photoAttribution = document.getElementById("photo-attribution");
  const termHistoryList = document.getElementById("term-history-list");
  const partyHistoryList = document.getElementById("party-history-list");
  const leadershipHistoryList = document.getElementById(
    "leadership-history-list"
  );

  const committeesStatusDiv = document.getElementById("committees-status");
  const committeesList = document.getElementById("committees-list");

  const sponsoredStatusDiv = document.getElementById("sponsored-items-status");
  const sponsoredList = document.getElementById("sponsored-items-list");
  const sponsoredCountSpan = document.getElementById("sponsored-count");

  const cosponsoredStatusDiv = document.getElementById(
    "cosponsored-items-status"
  );
  const cosponsoredList = document.getElementById("cosponsored-items-list");
  const cosponsoredCountSpan = document.getElementById("cosponsored-count");

  const votesStatusDiv = document.getElementById("votes-status");
  const votesList = document.getElementById("votes-list");

  // Map tab data-tab attribute to the corresponding elements and API path segment
  const tabDataMap = {
    "details-tab": {
      statusDiv: memberDetailsStatusDiv,
      listEl: null,
      apiSegment: "details",
      loaded: false,
    },
    "committees-tab": {
      statusDiv: committeesStatusDiv,
      listEl: committeesList,
      apiSegment: "committees",
      loaded: false,
    },
    "sponsored-tab": {
      statusDiv: sponsoredStatusDiv,
      listEl: sponsoredList,
      apiSegment: "sponsored",
      loaded: false,
      countSpan: sponsoredCountSpan,
    },
    "cosponsored-tab": {
      statusDiv: cosponsoredStatusDiv,
      listEl: cosponsoredList,
      apiSegment: "cosponsored",
      loaded: false,
      countSpan: cosponsoredCountSpan,
    },
    "votes-tab": {
      statusDiv: votesStatusDiv,
      listEl: votesList,
      apiSegment: "votes",
      loaded: false,
    },
  };

  // --- Globals and Constants ---
  let currentFilters = {
    congress: initialCongress || null,
    name: "",
    party: "ALL",
    state: "ALL",
    chamber: "ALL",
  };
  let allMembersData = []; // Raw list of members for selected congress
  let currentBioguideId = null; // Track the currently selected member

  // Used for generating congress.gov links - must match backend
  const billTypePaths = {
    HR: "house-bill",
    S: "senate-bill",
    HRES: "house-resolution",
    SRES: "senate-resolution",
    HJRES: "house-joint-resolution",
    SJRES: "senate-joint-resolution",
    HCONRES: "house-concurrent-resolution",
    SCONRES: "senate-concurrent-resolution",
    SAMDT: "senate-amendment",
    HAMDT: "house-amendment",
    SA: "senate-amendment",
    HA: "house-amendment",
    SUAMDT: "senate-unamendable-amendment",
  };

  // --- Helper Functions ---

  /** Creates LI element for legislation (Bill/Amendment) */
  function createLegislationListItem(item) {
    const li = document.createElement("li");
    if (
      !item ||
      !item.item_type ||
      !item.type ||
      item.number === null ||
      !item.congress ||
      !item.url
    ) {
      // Check item.url now
      li.textContent = "Invalid item data received.";
      li.style.color = "red";
      console.warn("Cannot render invalid legislation item:", item);
      return li;
    }

    const itemType = item.item_type;
    const typeCode = item.type;
    const number = item.number;
    const title =
      item.title ||
      (itemType === "Amendment"
        ? `Amendment ${typeCode} ${number}`
        : "No Title Provided");
    const introducedDate = item.introduced_date || "N/A";
    const latestActionText = item.latest_action_text || "No recorded action";
    const latestActionDate = item.latest_action_date || "";
    const linkUrl = item.url; // Use URL directly from backend detail fetch

    let linkEl;
    const displayText =
      itemType === "Amendment"
        ? `${typeCode} ${number}`
        : `${typeCode}${number}`;
    if (linkUrl) {
      linkEl = document.createElement("a");
      linkEl.href = linkUrl;
      linkEl.target = "_blank";
      linkEl.rel = "noopener noreferrer";
      linkEl.textContent = displayText;
    } else {
      linkEl = document.createElement("strong");
      linkEl.textContent = displayText;
    }

    const titleSpan = document.createElement("span");
    titleSpan.className = "legislation-title";
    titleSpan.textContent = `: ${title}`;

    const metaSpan = document.createElement("span");
    metaSpan.className = "legislation-meta";
    let metaHtml = `<span>Introduced: ${introducedDate}</span>`;
    if (latestActionDate) {
      metaHtml += `<span>Latest Action: ${latestActionDate} (${latestActionText})</span>`;
    } else {
      metaHtml += `<span>(${latestActionText})</span>`;
    }
    if (item.actions_count !== undefined)
      metaHtml += `<span>Actions: ${item.actions_count}</span>`;
    if (item.cosponsors_count !== undefined)
      metaHtml += `<span>Cosponsors: ${item.cosponsors_count}</span>`;

    metaSpan.innerHTML = metaHtml;

    li.appendChild(linkEl);
    li.appendChild(titleSpan);
    li.appendChild(metaSpan);
    return li;
  }

  /** Displays error in a status container */
  function displayError(statusDiv, listEl, msg) {
    if (!statusDiv) return;
    setLoading(statusDiv, false); // Ensure loading spinner is off
    statusDiv.classList.add("error");
    if (listEl) listEl.innerHTML = "";

    const errorP = statusDiv.querySelector(".error-message");
    if (errorP) {
      errorP.textContent = msg || "An unexpected error occurred.";
      // errorP.style.display = 'block'; // CSS handles display via .error class
    } else {
      console.error("Error <p> element not found in statusDiv:", statusDiv);
    }
  }

  /** Clears error message */
  function clearError(statusDiv) {
    if (!statusDiv) return;
    statusDiv.classList.remove("error");
    const errorP = statusDiv.querySelector(".error-message");
    if (errorP) {
      errorP.textContent = "";
      // errorP.style.display = 'none'; // CSS handles display via .error class removal
    }
  }

  /** Sets loading state, explicitly hides/shows loader */
  function setLoading(statusDiv, isLoading) {
    if (!statusDiv) return;
    const loader = statusDiv.querySelector(".loader");

    clearError(statusDiv); // Clear any previous errors first

    if (isLoading) {
      statusDiv.classList.add("loading");
      statusDiv.classList.remove("loaded"); // Remove loaded if setting to loading
      if (loader) loader.style.display = "block";
    } else {
      statusDiv.classList.remove("loading");
      if (loader) loader.style.display = "none"; // Explicitly hide loader
      // For details tab, mark as loaded so CSS can show content
      if (statusDiv.id === "member-details-status") {
        statusDiv.classList.add("loaded");
      }
    }
  }

  /** Switches active tab, triggers lazy loading if needed */
  function switchTab(targetButton) {
    if (!targetButton || targetButton.classList.contains("active")) return; // Already active

    const targetTabId = targetButton.getAttribute("data-tab");
    if (!targetTabId) return;

    console.log(`Switching to tab: ${targetTabId}`);

    // Deactivate old tabs
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabPanes.forEach((p) => p.classList.remove("active"));

    // Activate new tab
    targetButton.classList.add("active");
    const targetPane = document.getElementById(targetTabId);
    if (targetPane) {
      targetPane.classList.add("active");
      // Trigger lazy load if data for this tab hasn't been loaded yet for the current member
      if (
        tabDataMap[targetTabId] &&
        !tabDataMap[targetTabId].loaded &&
        targetTabId !== "details-tab"
      ) {
        console.log(`Lazy loading data for ${targetTabId}`);
        loadTabData(targetTabId); // Fetch and populate data for this tab
      }
    } else {
      // Fallback to details tab if target somehow doesn't exist
      tabButtons[0]?.classList.add("active");
      tabPanes[0]?.classList.add("active");
      console.warn("Target tab pane not found:", targetTabId);
    }
  }

  // --- Fetch Functions ---

  /** Fetches list of members for a Congress */
  async function fetchCongressMembers(congressNum) {
    console.log(`Fetching members for Congress ${congressNum}...`);
    if (!memberSelect || !memberListLoader || !memberListError) return;

    memberSelect.disabled = true;
    memberListLoader.style.display = "inline-block";
    memberListError.style.display = "none";
    memberListError.textContent = "";
    memberSelect.innerHTML = '<option value="">-- Loading Members --</option>';
    allMembersData = [];

    try {
      const response = await fetch(`/api/members?congress=${congressNum}`);
      if (!response.ok) {
        let errorMsg = `Error: ${response.status}`;
        try {
          errorMsg = (await response.json()).error || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }
      const members = await response.json();
      if (!Array.isArray(members))
        throw new Error("Invalid member data format.");

      allMembersData = members;
      console.log(
        `Fetched ${allMembersData.length} members for Congress ${congressNum}.`
      );
      memberListLoader.style.display = "none";
      populateMemberDropdown();
    } catch (err) {
      console.error("Error fetching congress members:", err);
      memberListLoader.style.display = "none";
      memberListError.textContent = `Failed to load: ${err.message}`;
      memberListError.style.display = "inline-block";
      memberSelect.innerHTML = '<option value="">-- Error --</option>';
      allMembersData = [];
      memberSelect.disabled = true;
    }
  }

  /** Populates member dropdown based on fetched data and filters */
  function populateMemberDropdown() {
    // (No changes needed from previous version, logic is sound)
    if (!memberSelect || !memberListError) return;
    memberListError.style.display = "none";
    memberListError.textContent = "";
    memberSelect.innerHTML = "";

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    memberSelect.appendChild(placeholderOption);

    if (!allMembersData?.length) {
      placeholderOption.textContent = "-- No Members Found --";
      memberSelect.disabled = true;
      return;
    }

    const nameFilter = currentFilters.name.toLowerCase().trim();
    const partyFilter = currentFilters.party;
    const stateFilter = currentFilters.state;
    const chamberFilter = currentFilters.chamber;

    const filteredMembers = allMembersData
      .filter((m) => {
        if (!m) return false;
        const nameMatch =
          !nameFilter || (m.name && m.name.toLowerCase().includes(nameFilter));
        const stateMatch = stateFilter === "ALL" || m.state === stateFilter;
        const chamberMatch =
          chamberFilter === "ALL" ||
          (m.chamber &&
            m.chamber.toUpperCase() === chamberFilter.toUpperCase());
        const partyCode = m.party_code || "";
        const partyMatch =
          partyFilter === "ALL" ||
          (partyFilter === "ID"
            ? partyCode !== "D" && partyCode !== "R"
            : partyCode === partyFilter);
        return nameMatch && stateMatch && partyMatch && chamberMatch;
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    if (filteredMembers.length === 0) {
      placeholderOption.textContent = "-- No Matching Members --";
      memberSelect.disabled = true;
    } else {
      placeholderOption.textContent = `-- Select Member (${filteredMembers.length}) --`;
      memberSelect.disabled = false;
      filteredMembers.forEach((m) => {
        if (m?.bioguide_id && m?.name) {
          const option = document.createElement("option");
          option.value = m.bioguide_id;
          let displayText = m.name;
          if (m.party_code && m.state)
            displayText += ` (${m.party_code}-${m.state})`;
          else if (m.party_code) displayText += ` (${m.party_code})`;
          else if (m.state) displayText += ` (${m.state})`;
          option.textContent = displayText;
          memberSelect.appendChild(option);
        }
      });
    }
  }

  /** Fetches ONLY the basic details for a specific member */
  async function fetchMemberDetailData(bioguideId) {
    currentBioguideId = bioguideId; // Store current member ID
    if (!memberInfoDiv) return;

    // Reset loaded flags for all tabs when a new member is selected
    Object.values(tabDataMap).forEach((tab) => (tab.loaded = false));

    if (!bioguideId) {
      clearMemberData();
      return;
    }

    console.log(`Fetching details for member ${bioguideId}...`);
    memberInfoDiv.classList.remove("hidden");
    switchTab(tabButtons[0]); // Ensure Details tab is active

    // Set loading ONLY for details tab initially
    setLoading(memberDetailsStatusDiv, true);
    // Set initial state for other tabs (e.g., "Loading..." placeholder)
    Object.entries(tabDataMap).forEach(([tabId, tabInfo]) => {
      if (tabId !== "details-tab" && tabInfo.statusDiv && tabInfo.listEl) {
        clearError(tabInfo.statusDiv);
        tabInfo.statusDiv.classList.remove("loading"); // Not loading yet
        tabInfo.listEl.innerHTML = `<li>Click tab to load...</li>`; // Placeholder
        if (tabInfo.countSpan) tabInfo.countSpan.textContent = ""; // Clear counts
      }
    });

    // Clear photo area
    if (memberPhoto) memberPhoto.style.display = "none";
    if (photoLoadingError) {
      photoLoadingError.style.display = "none";
      photoLoadingError.textContent = "";
    }
    if (photoAttribution) photoAttribution.textContent = "";

    const detailsApiUrl = `/api/member/${bioguideId}/details`;
    try {
      const response = await fetch(detailsApiUrl);
      const data = await response.json(); // Expecting { details: {...}, error: ... }
      console.log("Received member details:", data);

      if (!response.ok) {
        throw new Error(data?.error || `HTTP Error ${response.status}`);
      }
      if (data.error) {
        // Handle error within successful response
        throw new Error(data.error);
      }
      if (!data.details) {
        throw new Error("No member details found in response.");
      }

      // Update display ONLY with details data
      updateMemberDetailsDisplay(data.details);
      tabDataMap["details-tab"].loaded = true; // Mark details as loaded

      setLoading(memberDetailsStatusDiv, false); // Stop details spinner
    } catch (err) {
      console.error("Error fetching member details:", err);
      clearMemberData(); // Clear partial data
      memberInfoDiv.classList.remove("hidden");
      displayError(
        memberDetailsStatusDiv,
        null,
        `Failed to load details for ${bioguideId}: ${err.message}`
      );
      setLoading(memberDetailsStatusDiv, false);
    }
  }

  /** Fetches and populates data for a specific tab (Lazy Load) */
  async function loadTabData(tabId) {
    if (!currentBioguideId || !tabDataMap[tabId]) return;

    const tabInfo = tabDataMap[tabId];
    const { statusDiv, listEl, apiSegment, countSpan } = tabInfo;

    if (!statusDiv || !apiSegment) return; // Should not happen for configured tabs

    console.log(`Fetching data for tab ${tabId} (API: ${apiSegment})`);
    setLoading(statusDiv, true);
    if (listEl) listEl.innerHTML = ""; // Clear placeholder/old data
    if (countSpan) countSpan.textContent = ""; // Clear count

    // Handle non-list tabs or future implementations
    if (apiSegment === "committees" || apiSegment === "votes") {
      displayError(
        statusDiv,
        listEl,
        `${
          apiSegment.charAt(0).toUpperCase() + apiSegment.slice(1)
        } data not yet implemented.`
      );
      // setLoading(statusDiv, false); // Already handled by displayError
      tabInfo.loaded = true; // Mark as "loaded" to prevent re-fetch
      return;
    }

    const apiUrl = `/api/member/${currentBioguideId}/${apiSegment}`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json(); // Expecting { items: [...], error: ..., count: ... }
      console.log(`Received data for tab ${tabId}:`, data);

      if (!response.ok) {
        throw new Error(data?.error || `HTTP Error ${response.status}`);
      }
      if (data.error) {
        // Handle error within successful response
        throw new Error(data.error);
      }

      // Populate List
      if (listEl) {
        if (data.items && data.items.length > 0) {
          data.items.forEach((item) => {
            listEl.appendChild(createLegislationListItem(item));
          });
        } else {
          listEl.innerHTML = `<li>No ${apiSegment} items found.</li>`;
        }
      }

      // Update Count Span
      if (countSpan) {
        countSpan.textContent = `(${
          data.count !== undefined ? data.count : "N/A"
        })`;
      }

      tabInfo.loaded = true; // Mark tab as loaded successfully
      setLoading(statusDiv, false);
    } catch (err) {
      console.error(`Error fetching data for tab ${tabId}:`, err);
      displayError(
        statusDiv,
        listEl,
        `Failed to load ${apiSegment} data: ${err.message}`
      );
      // setLoading(statusDiv, false); // Already handled by displayError
      // Do not mark as loaded on error, so user can retry by switching tabs
      tabInfo.loaded = false;
    }
  }

  /** Updates ONLY the member details tab display */
  function updateMemberDetailsDisplay(details) {
    console.log("Updating member details display START");
    if (!details || typeof details !== "object") {
      console.error(
        "updateMemberDetailsDisplay called with invalid details:",
        details
      );
      displayError(
        memberDetailsStatusDiv,
        null,
        "Internal error: Invalid details data."
      );
      return;
    }

    memberDetailsStatusDiv.classList.add("loaded"); // Allow CSS to show content

    // -- Core Details --
    if (memberDetailsCoreContainer) {
      let coreHtml = "";
      const honorific = details.honorificName
        ? `${details.honorificName}. `
        : "";
      const displayName = honorific + (details.name || "N/A");
      coreHtml += `<strong>Name:</strong><span>${displayName}</span>`;

      let infoLine = "";
      if (details.party) infoLine += details.party;
      if (details.state) infoLine += `${infoLine ? " | " : ""}${details.state}`;
      let latestChamber = "Unknown";
      if (details.terms && details.terms.length > 0) {
        const latestTerm = details.terms[0]; // Assumes sorted by backend
        if (latestTerm?.chamber) latestChamber = latestTerm.chamber;
        // Handle full names like "House of Representatives"
        if (latestChamber.includes("House")) latestChamber = "House";
        else if (latestChamber.includes("Senate")) latestChamber = "Senate";
      }
      infoLine += `${infoLine ? " | " : ""}${latestChamber}`;
      if (infoLine)
        coreHtml += `<strong>Info:</strong><span>${infoLine}</span>`;

      if (details.birth_year)
        coreHtml += `<strong>Born:</strong><span>${details.birth_year}</span>`;
      if (details.website_url) {
        let safeUrl = details.website_url.trim();
        if (safeUrl && !safeUrl.startsWith("http"))
          safeUrl = "https://" + safeUrl;
        try {
          new URL(safeUrl);
          coreHtml += `<strong>Website:</strong><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Official Website</a>`;
        } catch (_) {
          coreHtml += `<strong>Website:</strong><span>(Invalid URL)</span>`;
        }
      }
      memberDetailsCoreContainer.innerHTML = coreHtml;
    }

    // -- Term History --
    if (termHistoryList) {
      termHistoryList.innerHTML = "";
      if (details.terms && details.terms.length > 0) {
        details.terms.forEach((term) => {
          // Already sorted by backend
          const li = document.createElement("li");
          const termYears = `${term.startYear || "?"} - ${
            term.endYear || "Present"
          }`;
          const stateDisplay = term.stateName || term.stateCode || "?";
          const location = term.district
            ? `${stateDisplay} (Dist. ${term.district})`
            : stateDisplay;
          li.innerHTML = `<strong>${
            term.congress || "?"
          }th Congress</strong> (${termYears})<br><span>${
            term.chamber || "?"
          } - ${location}</span>`;
          termHistoryList.appendChild(li);
        });
      } else {
        termHistoryList.innerHTML = "<li>No term history available.</li>";
      }
    }

    // -- Party History --
    if (partyHistoryList) {
      partyHistoryList.innerHTML = "";
      if (details.partyHistory && details.partyHistory.length > 0) {
        details.partyHistory.sort(
          (a, b) => (b.startYear || 0) - (a.startYear || 0)
        ); // Sort client-side just in case
        details.partyHistory.forEach((p) => {
          const li = document.createElement("li");
          const dateRange =
            p.startYear && p.endYear
              ? `${p.startYear} - ${p.endYear}`
              : p.startYear
              ? `${p.startYear} - Present`
              : "? - ?";
          li.innerHTML = `<strong>${
            p.partyName || "?"
          }</strong> <span>(${dateRange})</span>`;
          partyHistoryList.appendChild(li);
        });
      } else {
        partyHistoryList.innerHTML = "<li>No party history available.</li>";
      }
    }

    // -- Leadership History --
    if (leadershipHistoryList) {
      leadershipHistoryList.innerHTML = "";
      if (details.leadership && details.leadership.length > 0) {
        details.leadership.sort(
          (a, b) =>
            (b.congress || 0) - (a.congress || 0) ||
            (b.startDate || "").localeCompare(a.startDate || "")
        ); // Sort client-side
        details.leadership.forEach((l) => {
          const li = document.createElement("li");
          const dateInfo =
            l.startDate && l.endDate
              ? `${l.startDate} - ${l.endDate}`
              : l.startDate
              ? `${l.startDate} - Present`
              : "";
          li.innerHTML =
            `<strong>${l.type || "?"}</strong> (Congress ${
              l.congress || "?"
            })` + (dateInfo ? `<br><span>${dateInfo}</span>` : "");
          leadershipHistoryList.appendChild(li);
        });
      } else {
        leadershipHistoryList.innerHTML =
          "<li>No leadership history available.</li>";
      }
    }

    // -- Photo --
    if (memberPhoto && photoLoadingError && photoAttribution) {
      let imageUrl = null;
      let attributionText = "";
      if (details.depiction?.imageUrl) {
        imageUrl = details.depiction.imageUrl;
        attributionText = details.depiction.attribution || "";
      } else if (details.bioguide_id) {
        imageUrl = `https://bioguide.congress.gov/bioguide/photo/${details.bioguide_id[0]}/${details.bioguide_id}.jpg`;
        attributionText = "Bioguide Photo";
      }

      photoLoadingError.style.display = "none";
      photoLoadingError.textContent = "";
      photoAttribution.innerHTML = attributionText;

      if (imageUrl) {
        memberPhoto.src = imageUrl;
        memberPhoto.alt = `Photo of ${details.name || "member"}`;
        memberPhoto.style.display = "block";
        memberPhoto.onload = () => {
          memberPhoto.onerror = null;
        };
        memberPhoto.onerror = () => {
          memberPhoto.style.display = "none";
          photoLoadingError.textContent = "Photo not available";
          photoLoadingError.style.display = "block";
          photoAttribution.textContent = "";
          memberPhoto.onerror = null;
        };
      } else {
        memberPhoto.style.display = "none";
        photoLoadingError.textContent = "Photo not available";
        photoLoadingError.style.display = "block";
        photoAttribution.textContent = "";
      }
    }
    console.log("Member details display update END");
  }

  /** Clears all member-specific data from the display */
  function clearMemberData() {
    console.log("Clearing member data display.");
    currentBioguideId = null; // Clear current member ID
    if (memberInfoDiv) memberInfoDiv.classList.add("hidden");

    // Reset loaded flags
    Object.values(tabDataMap).forEach((tab) => (tab.loaded = false));

    // Clear Details Tab
    if (memberDetailsStatusDiv) {
      memberDetailsStatusDiv.classList.remove("loading", "error", "loaded");
      clearError(memberDetailsStatusDiv); // Ensure error p is cleared
    }
    if (memberDetailsCoreContainer) memberDetailsCoreContainer.innerHTML = "";
    if (termHistoryList) termHistoryList.innerHTML = "";
    if (partyHistoryList) partyHistoryList.innerHTML = "";
    if (leadershipHistoryList) leadershipHistoryList.innerHTML = "";
    if (memberPhoto) {
      memberPhoto.style.display = "none";
      memberPhoto.src = "";
    }
    if (photoLoadingError) {
      photoLoadingError.style.display = "none";
      photoLoadingError.textContent = "";
    }
    if (photoAttribution) photoAttribution.textContent = "";

    // Clear Other Tabs
    Object.values(tabDataMap).forEach((tabInfo) => {
      if (tabInfo.statusDiv) {
        tabInfo.statusDiv.classList.remove("loading", "error");
        clearError(tabInfo.statusDiv);
      }
      if (tabInfo.listEl) tabInfo.listEl.innerHTML = "";
      if (tabInfo.countSpan) tabInfo.countSpan.textContent = "";
    });

    // Reset to details tab visually
    if (tabButtons?.length > 0) {
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));
      tabButtons[0].classList.add("active");
      tabPanes[0].classList.add("active");
    }
  }

  // --- Event Listeners ---
  if (congressFilterSelect) {
    congressFilterSelect.addEventListener("change", (e) => {
      const selectedCongress = e.target.value;
      if (!selectedCongress) {
        memberSelect.innerHTML =
          '<option value="">-- Select Congress --</option>';
        memberSelect.disabled = true;
        allMembersData = [];
        clearMemberData();
        return;
      }
      currentFilters.congress = selectedCongress;
      clearMemberData();
      memberSelect.value = "";
      fetchCongressMembers(selectedCongress);
    });
  }

  if (memberSelect) {
    memberSelect.addEventListener("change", (e) => {
      fetchMemberDetailData(e.target.value); // Fetch details for the selected member
    });
  }

  // --- NEW: Delegate listener for internal member links ---
  // Add this listener to the body or a closer static container
  // This handles clicks on links added dynamically to cosponsor lists etc.
  document.body.addEventListener("click", (e) => {
    // Check if the clicked element is an internal member link
    if (e.target.matches("a.member-link-internal")) {
      e.preventDefault(); // Prevent default link navigation

      const bioguideId = e.target.dataset.bioguide; // Get ID from data attribute
      console.log("Internal member link clicked:", bioguideId);

      if (bioguideId) {
        // --- Option 1: Redirect back to homepage and load member ---
        // This is simpler if the detail page isn't part of the main SPA structure
        window.location.href = `/#member=${bioguideId}`;

        // --- Option 2: If detail page was part of a larger SPA structure (more complex) ---
        // You would need functions to hide the detail view, show the main view,
        // and then trigger the member load.
        // hideBillDetailView(); // Hypothetical function
        // showMainMemberView(); // Hypothetical function
        // // Ensure member dropdown exists and select the member
        // if (memberSelect) {
        //     memberSelect.value = bioguideId;
        //     // Trigger the change event manually if needed, or directly call fetch
        //     fetchMemberDetailData(bioguideId);
        // }
      }
    }
  });

  // Filter Listeners (Name, Party, Chamber, State) - No changes needed, they re-populate dropdown
  if (nameSearchInput) {
    let debounceTimeout;
    nameSearchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        currentFilters.name = e.target.value;
        populateMemberDropdown();
        memberSelect.value = "";
        // Don't clear member data on filter change, only on new selection or congress change
      }, 300);
    });
  }
  if (partyFilters.length > 0)
    partyFilters.forEach((radio) =>
      radio.addEventListener("change", (e) => {
        if (e.target.checked) {
          currentFilters.party = e.target.value;
          populateMemberDropdown();
          memberSelect.value = "";
        }
      })
    );
  if (chamberFilters.length > 0)
    chamberFilters.forEach((radio) =>
      radio.addEventListener("change", (e) => {
        if (e.target.checked) {
          currentFilters.chamber = e.target.value;
          populateMemberDropdown();
          memberSelect.value = "";
        }
      })
    );
  if (stateFilterSelect)
    stateFilterSelect.addEventListener("change", (e) => {
      currentFilters.state = e.target.value;
      populateMemberDropdown();
      memberSelect.value = "";
    });

  // Tab Button Clicks - Now uses switchTab which handles lazy loading
  if (tabButtons.length > 0) {
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => switchTab(button));
    });
  }

  // --- Initial Load ---
  clearMemberData();
  const initialCongressValue = congressFilterSelect
    ? congressFilterSelect.value
    : null;
  if (
    initialCongressValue &&
    initialCongressValue === String(initialCongress)
  ) {
    currentFilters.congress = initialCongressValue;
    fetchCongressMembers(initialCongressValue);
  } else if (initialCongress) {
    console.warn(
      "Mismatch between filter value and initialCongress. Forcing load for:",
      initialCongress
    );
    if (congressFilterSelect) congressFilterSelect.value = initialCongress;
    currentFilters.congress = initialCongress;
    fetchCongressMembers(initialCongress);
  } else {
    console.error("Initial congress value not available.");
    memberSelect.innerHTML = '<option value="">-- Select Congress --</option>';
    memberSelect.disabled = true;
    memberListError.textContent = "Select Congress.";
    memberListError.style.display = "inline-block";
  }

  console.log("CivicTrack Initialized.");
}); // End DOMContentLoaded
