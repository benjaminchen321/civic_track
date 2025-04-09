document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Loaded. Initializing script...");

  // --- Get references ---
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
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const memberPhoto = document.getElementById("member-photo");
  const photoLoadingError = document.getElementById("photo-loading-error");
  const memberDetailsContainer = document.getElementById(
    "member-details-content"
  );
  const sponsoredItemsList = document.getElementById("sponsored-items-list");
  const sponsoredItemsStatus = document.getElementById(
    "sponsored-items-status"
  );
  const cosponsoredItemsList = document.getElementById(
    "cosponsored-items-list"
  );
  const cosponsoredItemsStatus = document.getElementById(
    "cosponsored-items-status"
  );

  // --- Global Variables & Constants ---
  let currentFilters = {
    congress: initialCongress || null,
    name: "",
    party: "ALL",
    state: "ALL",
    chamber: "ALL",
  };
  let allMembersData = [];

  // --- START: Updated billTypePaths with Amendment types ---
  const billTypePaths = {
    // Bills
    HR: "house-bill",
    S: "senate-bill",
    // Resolutions
    HRES: "house-resolution",
    SRES: "senate-resolution",
    HJRES: "house-joint-resolution",
    SJRES: "senate-joint-resolution",
    HCONRES: "house-concurrent-resolution",
    SCONRES: "senate-concurrent-resolution",
    // Amendments (Verify paths on congress.gov if possible)
    SAMDT: "senate-amendment", // Official Senate Amendment
    HAMDT: "house-amendment", // Official House Amendment
    SA: "senate-amendment", // Simple Senate Amendment (might map to same place)
    HA: "house-amendment", // Simple House Amendment (might map to same place)
    // Add others like SCONRESAMDT if needed
  };
  // --- END: Updated billTypePaths ---

  // --- Helper functions ---
  function createLegislationListItem(item) {
    const listItem = document.createElement("li");
    let itemElement = document.createElement("span");
    itemElement.textContent = "N/A";
    const itemTitle = item.title || "No Title Available";
    const congressNum = item.congress;
    const itemTypeCode = item.type; // Use the actual type code from backend (e.g., S, HR, SAMDT, SA)
    const itemNum = item.number;

    if (!item || typeof item !== "object") return listItem; // Return empty li if item invalid

    // --- Logic using item.item_type set by backend ---
    if (
      item.item_type === "Bill" &&
      congressNum &&
      itemTypeCode &&
      itemNum !== null
    ) {
      let itemDisplayNum = `${itemTypeCode}${itemNum}`;
      const urlPathSegment = billTypePaths[itemTypeCode]; // Look up path using Type Code
      if (urlPathSegment) {
        const url = `https://www.congress.gov/bill/${congressNum}th-congress/${urlPathSegment}/${itemNum}`;
        itemElement = document.createElement("a");
        itemElement.href = url;
        itemElement.target = "_blank";
        itemElement.rel = "noopener noreferrer";
        itemElement.textContent = itemDisplayNum;
      } else {
        console.warn(`No URL path found for Bill type: ${itemTypeCode}`);
        itemElement.textContent = itemDisplayNum; // Show text even without link
      }
    } else if (
      item.item_type === "Amendment" &&
      congressNum &&
      itemTypeCode &&
      itemNum !== null
    ) {
      // Display text like "SA 123" or "HAMDT 456" based on type code
      let itemDisplayNum = `${itemTypeCode} ${itemNum}`;
      const urlPathSegment = billTypePaths[itemTypeCode]; // Look up path using Type Code (SA, SAMDT etc.)
      if (urlPathSegment) {
        // Construct Amendment URL (Using structure consistent with billTypePaths)
        const url = `https://www.congress.gov/amendment/${congressNum}th-congress/${urlPathSegment}/${itemNum}`;
        itemElement = document.createElement("a");
        itemElement.href = url;
        itemElement.target = "_blank";
        itemElement.rel = "noopener noreferrer";
        itemElement.textContent = itemDisplayNum; // Display "SA 123" as link text
      } else {
        console.warn(`No URL path found for Amendment type: ${itemTypeCode}`);
        itemElement.textContent = itemDisplayNum; // Show text even without link
      }
    } else {
      // Fallback if item_type wasn't set or data missing
      itemElement.textContent = `Item: ${itemTypeCode || "?"}${itemNum || "?"}`;
      console.warn("Could not classify or link item:", item);
    }
    // --- End logic ---

    listItem.appendChild(itemElement);
    listItem.appendChild(document.createTextNode(`: ${itemTitle} `));
    if (item.introduced_date) {
      listItem.appendChild(
        document.createTextNode(`(Introduced: ${item.introduced_date}) `)
      );
    }
    if (item.latest_action_text && item.latest_action_text !== "N/A") {
      listItem.appendChild(
        document.createTextNode(
          `(Latest Action: ${item.latest_action_text} on ${
            item.latest_action_date || "N/A"
          })`
        )
      );
    } else if (item.introduced_date) {
      listItem.appendChild(document.createTextNode(`(No recent action)`));
    } // Show only if intro date exists
    return listItem;
  }

  function displayError(statusElement, listElement, message) {
    if (!statusElement) {
      console.error("Cannot display error, status element is missing.");
      return;
    }
    // Ensure loading spinner is hidden
    statusElement.classList.remove("loading");
    const loader = statusElement.querySelector(".loader");
    if (loader) loader.style.display = "none";

    // Clear existing list content if listElement provided
    if (listElement) listElement.innerHTML = "";

    // Add or update error message
    let errorPara = statusElement.querySelector(".error-message");
    if (!errorPara) {
      errorPara = document.createElement("p");
      errorPara.className = "error-message";
      // Prepend error message so it appears before potential empty list styling
      statusElement.prepend(errorPara);
    }
    errorPara.textContent = message || "An error occurred. Please try again.";
    errorPara.style.display = "block"; // Ensure it's visible
  }

  function switchTab(selectedButton) {
    if (!selectedButton || !tabButtons || !tabPanes) {
      console.warn("Tab switching elements missing.");
      return;
    }
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabPanes.forEach((p) => p.classList.remove("active"));

    selectedButton.classList.add("active");
    const targetId = selectedButton.getAttribute("data-tab");
    const targetPane = document.getElementById(targetId);

    if (targetPane) {
      targetPane.classList.add("active");
      console.log(`Switched to tab: ${targetId}`);
    } else {
      console.error(`Tab pane with ID '${targetId}' not found.`);
      // Optionally activate the first tab as a fallback
      if (tabPanes.length > 0) tabPanes[0].classList.add("active");
      if (tabButtons.length > 0) tabButtons[0].classList.add("active");
    }
  }

  // --- Function to Fetch Member List for a Congress ---
  async function fetchCongressMembers(congressNumber) {
    console.log(`Fetching members for Congress ${congressNumber}...`);
    if (!memberSelect || !memberListLoader || !memberListError) {
      console.error("Member selection elements missing, cannot fetch members.");
      return;
    }

    memberSelect.disabled = true; // Disable dropdown while loading
    memberListLoader.style.display = "inline-block"; // Show loader
    memberListError.style.display = "none"; // Hide error
    memberSelect.innerHTML = '<option value="">-- Loading Members --</option>'; // Update placeholder
    allMembersData = []; // Clear previous congress data

    try {
      // Use the new API endpoint
      const response = await fetch(`/api/members?congress=${congressNumber}`);
      if (!response.ok) {
        let errorMsg = `Error fetching members: ${response.status} ${response.statusText}`;
        try {
          // Try to parse more specific error from backend JSON response
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg; // Use backend error message if available
        } catch (e) {
          // Ignore if response body isn't JSON or is empty
          console.log("Could not parse error response as JSON.");
        }
        throw new Error(errorMsg);
      }
      const members = await response.json();

      // Validate the received data
      if (!Array.isArray(members)) {
        throw new Error(
          "Invalid data format received for members (expected an array)."
        );
      }

      allMembersData = members; // Store the fetched members globally
      console.log(`allMembersData:`, allMembersData);
      console.log(
        `Successfully fetched ${allMembersData.length} members for Congress ${congressNumber}.`
      );
      memberListLoader.style.display = "none"; // Hide loader on success
      populateMemberDropdown(); // Populate dropdown with the new data
    } catch (error) {
      console.error("Failed to fetch congress members:", error);
      memberListLoader.style.display = "none"; // Hide loader on error
      memberListError.textContent = `Error loading members: ${error.message}`;
      memberListError.style.display = "inline-block"; // Show error message
      memberSelect.innerHTML =
        '<option value="">-- Error Loading Members --</option>';
      allMembersData = []; // Ensure data is empty on error
      memberSelect.disabled = true; // Keep disabled on error
    }
  }

  // --- Function to Populate Dropdown (Uses global allMembersData) ---
  function populateMemberDropdown() {
    if (!memberSelect || !memberListError) {
      console.error(
        "Member select or error element missing, cannot populate dropdown."
      );
      return;
    }

    memberListError.style.display = "none"; // Hide error message when populating
    memberSelect.innerHTML = ""; // Clear existing options first

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Choose Member --";
    memberSelect.appendChild(defaultOption);

    // Check if the global allMembersData (for the current congress) is available
    if (!Array.isArray(allMembersData) || allMembersData.length === 0) {
      // This case might happen if fetch failed or returned empty
      defaultOption.textContent =
        "-- No members available for this Congress --";
      memberSelect.disabled = true; // Ensure disabled if no data
      console.warn("populateMemberDropdown called with no member data.");
      return;
    }

    // Enable select now that we have data (or will filter existing)
    memberSelect.disabled = false;

    // Apply local filters (name, party, state, chamber) to the current congress's members
    const nameFilter = currentFilters.name.toLowerCase().trim();
    const partyFilter = currentFilters.party;
    const stateFilter = currentFilters.state;
    const chamberFilter = currentFilters.chamber;

    console.log(
      `Filtering ${allMembersData.length} members (Congress ${currentFilters.congress}) with Party=${partyFilter}, Chamber=${chamberFilter}, State=${stateFilter}, Name=${nameFilter}`
    );

    let membersPassedCount = 0;
    const filteredMembers = allMembersData // Filter the globally stored list
      .filter((member) => {
        // Basic validation of member object
        if (!member || typeof member !== "object") return false;

        // Name Match (case-insensitive)
        const nameMatch =
          !nameFilter ||
          (member.name &&
            typeof member.name === "string" &&
            member.name.toLowerCase().includes(nameFilter));

        // State Match
        const stateMatch =
          stateFilter === "ALL" || member.state === stateFilter;

        // Chamber Match (case-insensitive)
        const chamberMatch =
          chamberFilter === "ALL" ||
          (member.chamber &&
            typeof member.chamber === "string" &&
            member.chamber.toUpperCase() === chamberFilter.toUpperCase());

        // Party Match
        const partyCode = member.party_code || ""; // Use party_code generated in backend
        let partyMatch = partyFilter === "ALL";
        if (!partyMatch) {
          if (partyFilter === "ID") {
            // Independents/Other
            partyMatch = partyCode !== "D" && partyCode !== "R";
          } else {
            // Specific party (D or R)
            partyMatch = partyCode === partyFilter;
          }
        }

        // Check if all filters pass
        const passesAll = nameMatch && stateMatch && partyMatch && chamberMatch;
        if (passesAll) {
          membersPassedCount++;
        }
        return passesAll;
      })
      .sort((a, b) => {
        // Sort alphabetically by name, handling potential nulls
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB);
      });

    console.log(`Total members passed filters: ${membersPassedCount}`);

    if (filteredMembers.length === 0) {
      defaultOption.textContent = "-- No members match filters --";
    } else {
      defaultOption.textContent = `-- Select from ${filteredMembers.length} members --`;
    }

    filteredMembers.forEach((member) => {
      // Check for essential properties before creating option
      if (member && member.bioguide_id && member.name) {
        const opt = document.createElement("option");
        opt.value = member.bioguide_id;
        // Add more info to dropdown text if desired
        // opt.textContent = `${member.name} (${member.party_code || '?'}-${member.state || '?'})`;
        opt.textContent = member.name; // Keep it simple for now
        memberSelect.appendChild(opt);
      } else {
        console.warn("Skipping member due to missing ID or name:", member);
      }
    });
    console.log(
      `Finished Populating dropdown. Rendered Options: ${filteredMembers.length}`
    );
  }

  // --- Function to fetch member detail data ---
  async function fetchMemberDetailData(memberId) {
    console.log(`Fetching details for member ${memberId}...`);
    if (!memberInfoDiv) {
      console.error("Member info container not found.");
      return;
    }
    if (!memberId) {
      console.warn("fetchMemberDetailData called with no memberId.");
      clearData(); // Clear display if ID is missing
      return;
    }

    memberInfoDiv.classList.remove("hidden");
    if (tabButtons.length > 0) switchTab(tabButtons[0]); // Reset to first tab

    // Show loading states reliably
    if (memberDetailsContainer) {
      memberDetailsContainer.innerHTML = ""; // Clear previous content
      memberDetailsContainer.classList.add("loading"); // Add loading class for styling spinner etc.
    }
    if (memberPhoto) memberPhoto.style.display = "none";
    if (photoLoadingError) photoLoadingError.style.display = "none";
    if (sponsoredItemsStatus) {
      sponsoredItemsStatus.classList.add("loading");
      if (sponsoredItemsList) sponsoredItemsList.innerHTML = ""; // Clear list while loading
    }
    if (cosponsoredItemsStatus) {
      cosponsoredItemsStatus.classList.add("loading");
      if (cosponsoredItemsList) cosponsoredItemsList.innerHTML = ""; // Clear list while loading
    }

    // Clear previous error messages from all status divs
    const statusDivs = [
      sponsoredItemsStatus,
      cosponsoredItemsStatus,
      memberDetailsContainer,
    ];
    statusDivs.forEach((div) => {
      if (div) {
        const errorElement = div.querySelector(".error-message");
        if (errorElement) errorElement.remove();
      }
    });
    if (photoLoadingError.parentNode) {
      // Clear errors near photo
      const photoContainerErrors =
        photoLoadingError.parentNode.querySelectorAll(".error-message");
      photoContainerErrors.forEach((e) => e.remove());
      photoLoadingError.style.display = "none"; // Ensure specific photo error is hidden too
    }

    const url = `/api/member/${memberId}`; // Use existing member detail API
    let responseData = null; // To store response data for error reporting

    try {
      const response = await fetch(url);
      responseData = await response.json(); // Try parsing JSON regardless of status for error messages
      console.log("Member detail data received:", responseData);

      if (!response.ok) {
        // Prioritize error message from JSON body if available
        const errorMsg =
          responseData?.error ||
          responseData?.member_details_error ||
          `HTTP error ${response.status} ${response.statusText}`;
        throw new Error(errorMsg);
      }
      // Additional check if response is ok but data structure is weird
      if (!responseData || typeof responseData !== "object") {
        throw new Error("Invalid response format from server.");
      }

      // --- Update Display on Success ---
      // Remove loading states first
      if (memberDetailsContainer)
        memberDetailsContainer.classList.remove("loading");
      if (sponsoredItemsStatus)
        sponsoredItemsStatus.classList.remove("loading");
      if (cosponsoredItemsStatus)
        cosponsoredItemsStatus.classList.remove("loading");

      updateDisplay(responseData); // Update display with fetched details
    } catch (error) {
      console.error("Could not fetch or process member detail data:", error);
      // Remove loading states on error
      if (memberDetailsContainer)
        memberDetailsContainer.classList.remove("loading");
      if (sponsoredItemsStatus)
        sponsoredItemsStatus.classList.remove("loading");
      if (cosponsoredItemsStatus)
        cosponsoredItemsStatus.classList.remove("loading");

      // --- Display Errors ---
      // Display primary error in the details section
      if (memberDetailsContainer) {
        memberDetailsContainer.innerHTML = ""; // Clear potential loading text
        displayError(
          memberDetailsContainer,
          null,
          `Could not load details: ${error.message}`
        );
      } else {
        // Fallback if details container missing
        alert(`Error loading member details: ${error.message}`);
      }

      // Display specific errors in other sections if available from response, else generic
      const sponsoredErrorMsg =
        responseData?.sponsored_items_error ||
        "Could not load sponsored items.";
      displayError(sponsoredItemsStatus, sponsoredItemsList, sponsoredErrorMsg);

      const cosponsoredErrorMsg =
        responseData?.cosponsored_items_error ||
        "Could not load cosponsored items.";
      displayError(
        cosponsoredItemsStatus,
        cosponsoredItemsList,
        cosponsoredErrorMsg
      );

      // Ensure photo/photo error are hidden
      if (memberPhoto) memberPhoto.style.display = "none";
      if (photoLoadingError) photoLoadingError.style.display = "none";
    }
  }

  // --- Function to update the display (Member Details) ---
  function updateDisplay(data) {
    console.log("Updating member display START");

    // Ensure data is an object
    if (!data || typeof data !== "object") {
      console.error("updateDisplay called with invalid data:", data);
      // Optionally display a generic error
      if (memberDetailsContainer)
        displayError(
          memberDetailsContainer,
          null,
          "Failed to process member data."
        );
      return;
    }

    // --- Member Details & Photo Tab ---
    const details = data.member_details; // Get details sub-object
    if (details && typeof details === "object" && memberDetailsContainer) {
      let detailsHtml = "";
      // Name
      if (details.name)
        detailsHtml += `<strong>Name:</strong> ${details.name}<br>`;
      // State & Party
      if (details.state || details.party) {
        detailsHtml += `<strong>State:</strong> ${
          details.state || "N/A"
        } | <strong>Party:</strong> ${details.party || "N/A"}`;
      }
      // Chamber (using data from initial list load for consistency)
      const memberFromList = allMembersData.find(
        (m) => m.bioguide_id === details.bioguide_id
      );
      if (memberFromList && memberFromList.chamber) {
        detailsHtml += ` | <strong>Chamber:</strong> ${memberFromList.chamber}`;
      } else if (
        details.terms &&
        Array.isArray(details.terms) &&
        details.terms.length > 0
      ) {
        // Fallback: try to get from terms if available in details API (less reliable for *current* chamber)
        const latestTerm = details.terms.sort(
          (a, b) => (b.congress || 0) - (a.congress || 0)
        )[0];
        if (latestTerm && latestTerm.chamber)
          detailsHtml += ` | <strong>Chamber:</strong> ${latestTerm.chamber}`;
      }

      detailsHtml += "<br>"; // Line break after first line

      // Birth Year
      if (details.birth_year)
        detailsHtml += `<strong>Birth Year:</strong> ${details.birth_year} `;
      // Leadership Roles
      if (
        details.leadership &&
        Array.isArray(details.leadership) &&
        details.leadership.length > 0
      ) {
        detailsHtml += `<br><strong>Leadership:</strong> ${details.leadership
          .map((l) => l?.type || "N/A")
          .join(", ")}`;
      }
      // Website Link
      if (details.website_url) {
        let safeUrl = details.website_url.trim();
        // Basic check if it looks like a URL, add https if missing protocol
        if (
          safeUrl &&
          !safeUrl.startsWith("http://") &&
          !safeUrl.startsWith("https://")
        ) {
          safeUrl = "https://" + safeUrl;
        }
        // Simple validation for potentially valid URL structure
        try {
          new URL(safeUrl); // Test if it parses
          detailsHtml += ` | <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Official Website</a>`;
        } catch (_) {
          console.warn(
            "Could not parse member website URL:",
            details.website_url
          );
          // Optionally display the text without a link: detailsHtml += ` | Website: ${details.website_url}`;
        }
      }

      // Fallback if no details rendered
      if (detailsHtml.trim().replace("<br>", "") === "") {
        // Check if only <br> exists
        detailsHtml = "<p>Member details not available.</p>";
      }

      // Append specific details error if it occurred
      if (data.member_details_error) {
        detailsHtml += `<p class="error-message" style="margin-top:10px;">Details Error: ${data.member_details_error}</p>`;
      }
      memberDetailsContainer.innerHTML = detailsHtml; // Set the generated HTML

      // Photo logic
      if (details.bioguide_id && memberPhoto && photoLoadingError) {
        const photoUrl = `https://bioguide.congress.gov/bioguide/photo/${details.bioguide_id.charAt(
          0
        )}/${details.bioguide_id}.jpg`;
        memberPhoto.src = photoUrl;
        memberPhoto.alt = `Photo of ${details.name || "member"}`; // Use name in alt text
        memberPhoto.style.display = "block"; // Show image container
        photoLoadingError.style.display = "none"; // Hide error message initially

        memberPhoto.onerror = () => {
          console.warn(`Failed to load photo: ${photoUrl}`);
          memberPhoto.style.display = "none"; // Hide broken image
          photoLoadingError.textContent = "Photo not found";
          photoLoadingError.style.display = "block"; // Show error message
          memberPhoto.onerror = null; // Prevent infinite loops if error itself fails
        };
        memberPhoto.onload = () => {
          // Photo loaded successfully
          photoLoadingError.style.display = "none"; // Ensure error is hidden
          memberPhoto.onerror = null; // Clear error handler
        };
      } else {
        // No bioguide ID or photo elements missing
        if (memberPhoto) memberPhoto.style.display = "none";
        if (photoLoadingError) {
          photoLoadingError.textContent = details.bioguide_id
            ? "Photo unavailable"
            : "Photo ID missing";
          photoLoadingError.style.display = "block";
        }
      }
    } else {
      // Handle case where member_details object is missing or container isn't found
      const errorMsg =
        data.member_details_error || "Member details could not be loaded.";
      if (memberDetailsContainer) {
        memberDetailsContainer.innerHTML = ""; // Clear first
        displayError(memberDetailsContainer, null, errorMsg);
      }
      if (memberPhoto) memberPhoto.style.display = "none";
      if (photoLoadingError) photoLoadingError.style.display = "none"; // Hide photo error if details failed
    }
    console.log("Member details & photo updated.");

    // --- Sponsored Legislation Tab ---
    console.log("Updating sponsored legislation...");
    const sponsoredListElement = sponsoredItemsList;
    const sponsoredStatusElement = sponsoredItemsStatus;
    if (sponsoredListElement && sponsoredStatusElement) {
      sponsoredListElement.innerHTML = ""; // Clear previous content
      if (data.sponsored_items_error) {
        displayError(
          sponsoredStatusElement,
          sponsoredListElement,
          data.sponsored_items_error
        );
      } else if (
        data.sponsored_items &&
        Array.isArray(data.sponsored_items) &&
        data.sponsored_items.length > 0
      ) {
        try {
          data.sponsored_items.forEach((item) => {
            if (item && typeof item === "object") {
              // Check item validity
              sponsoredListElement.appendChild(createLegislationListItem(item));
            }
          });
          // Remove potential lingering error message if items were loaded
          const existingError =
            sponsoredStatusElement.querySelector(".error-message");
          if (existingError) existingError.remove();
        } catch (e) {
          console.error("JS Error processing sponsored legislation:", e);
          displayError(
            sponsoredStatusElement,
            sponsoredListElement,
            "Error displaying sponsored items."
          );
        }
      } else {
        // No error, but no items
        sponsoredListElement.innerHTML =
          "<li>No recently sponsored legislation found for this member.</li>";
        // Remove potential lingering error message
        const existingError =
          sponsoredStatusElement.querySelector(".error-message");
        if (existingError) existingError.remove();
      }
    } else {
      console.error("Sponsored legislation list or status element missing!");
    }
    console.log("Sponsored legislation updated.");

    // --- Cosponsored Legislation Tab ---
    console.log("Updating cosponsored legislation...");
    const cosponsoredListElement = cosponsoredItemsList;
    const cosponsoredStatusElement = cosponsoredItemsStatus;
    if (cosponsoredListElement && cosponsoredStatusElement) {
      cosponsoredListElement.innerHTML = ""; // Clear previous content
      if (data.cosponsored_items_error) {
        displayError(
          cosponsoredStatusElement,
          cosponsoredListElement,
          data.cosponsored_items_error
        );
      } else if (
        data.cosponsored_items &&
        Array.isArray(data.cosponsored_items) &&
        data.cosponsored_items.length > 0
      ) {
        try {
          data.cosponsored_items.forEach((item) => {
            if (item && typeof item === "object") {
              // Check item validity
              cosponsoredListElement.appendChild(
                createLegislationListItem(item)
              );
            }
          });
          const existingError =
            cosponsoredStatusElement.querySelector(".error-message");
          if (existingError) existingError.remove();
        } catch (e) {
          console.error("JS Error processing cosponsored legislation:", e);
          displayError(
            cosponsoredStatusElement,
            cosponsoredListElement,
            "Error displaying cosponsored items."
          );
        }
      } else {
        // No error, but no items
        cosponsoredListElement.innerHTML =
          "<li>No recently cosponsored legislation found for this member.</li>";
        const existingError =
          cosponsoredStatusElement.querySelector(".error-message");
        if (existingError) existingError.remove();
      }
    } else {
      console.error("Cosponsored legislation list or status element missing!");
    }
    console.log("Cosponsored legislation updated.");

    console.log("Updating member display END");
  }

  // --- Function to clear the display ---
  function clearData() {
    console.log("Clearing member display data.");
    if (memberInfoDiv) memberInfoDiv.classList.add("hidden"); // Hide the whole section

    // Reset details tab
    if (memberDetailsContainer) {
      memberDetailsContainer.innerHTML =
        "<p>Select a member to view details.</p>";
      memberDetailsContainer.classList.remove("loading"); // Remove loading class
      const e = memberDetailsContainer.querySelector(".error-message");
      if (e) e.remove(); // Remove error message
    }
    if (memberPhoto) {
      memberPhoto.style.display = "none";
      memberPhoto.src = ""; // Clear src
    }
    if (photoLoadingError) {
      photoLoadingError.style.display = "none"; // Hide photo error
      const pe = photoLoadingError.parentNode?.querySelector(".error-message"); // Clear general errors near photo
      if (pe) pe.remove();
    }

    // Clear Sponsored Tab
    if (sponsoredItemsStatus) {
      sponsoredItemsStatus.classList.remove("loading");
      const e = sponsoredItemsStatus.querySelector(".error-message");
      if (e) e.remove();
    }
    if (sponsoredItemsList)
      sponsoredItemsList.innerHTML =
        "<li>Select a member to view sponsored legislation.</li>"; // Reset placeholder

    // Clear Cosponsored Tab
    if (cosponsoredItemsStatus) {
      cosponsoredItemsStatus.classList.remove("loading");
      const e = cosponsoredItemsStatus.querySelector(".error-message");
      if (e) e.remove();
    }
    if (cosponsoredItemsList)
      cosponsoredItemsList.innerHTML =
        "<li>Select a member to view cosponsored legislation.</li>"; // Reset placeholder

    // Reset Tab selection to default (first tab)
    if (tabButtons && tabButtons.length > 0) {
      switchTab(tabButtons[0]);
    }
  }

  // --- Tab Switching Logic --- (Keep as before, ensure it's robust)
  function switchTab(selectedButton) {
    if (!selectedButton || !tabButtons || !tabPanes) return;
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabPanes.forEach((p) => p.classList.remove("active"));

    selectedButton.classList.add("active");
    const targetId = selectedButton.getAttribute("data-tab");
    const targetPane = document.getElementById(targetId);
    if (targetPane) {
      targetPane.classList.add("active");
      // console.log(`Switched to tab: ${targetId}`); // Optional log
    } else {
      console.error(`Tab pane missing: ${targetId}`);
      // Fallback to first tab if target is missing
      if (tabButtons.length > 0) tabButtons[0].classList.add("active");
      if (tabPanes.length > 0) tabPanes[0].classList.add("active");
    }
  }

  // --- Event Listeners Setup ---
  console.log("Setting up listeners...");

  // --- Congress Filter Listener ---
  if (congressFilterSelect) {
    congressFilterSelect.addEventListener("change", (e) => {
      const selectedCongress = e.target.value;
      if (!selectedCongress) {
        console.warn("Congress selection cleared or invalid.");
        // Optionally disable member select and clear data
        memberSelect.innerHTML =
          '<option value="">-- Select Congress --</option>';
        memberSelect.disabled = true;
        clearData();
        return;
      }
      console.log(`Congress selection changed to: ${selectedCongress}`);
      currentFilters.congress = selectedCongress;
      clearData(); // Clear member details display
      memberSelect.value = ""; // Reset member dropdown selection
      // Fetch members for the newly selected Congress
      fetchCongressMembers(selectedCongress);
    });
  } else {
    console.warn("Congress filter select element not found.");
  }

  // --- Member Select Listener ---
  if (memberSelect) {
    memberSelect.addEventListener("change", (e) => {
      const memberId = e.target.value;
      if (memberId) {
        fetchMemberDetailData(memberId); // Fetch details for selected member
      } else {
        clearData(); // Clear display if "-- Choose Member --" or similar is selected
      }
    });
  } else {
    console.error("Member select dropdown element not found!");
  }

  // --- Other Filter Listeners (Party, Chamber, State, Name) ---
  // These ONLY trigger repopulating the *existing* dropdown based on `allMembersData`
  if (nameSearchInput) {
    let debounceTimeout;
    nameSearchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        currentFilters.name = e.target.value;
        populateMemberDropdown(); // Repopulate dropdown from currentCongressMembers
        // Don't necessarily clear data pane unless you want filter changes to always reset view
        // clearData();
        // Reset dropdown selection to default('-- Select ...') when filters change
        memberSelect.value = "";
        // If a member was selected, changing filters should clear the detail view
        if (memberInfoDiv && !memberInfoDiv.classList.contains("hidden")) {
          clearData();
        }
      }, 300); // Debounce input
    });
  }
  if (partyFilters.length > 0) {
    partyFilters.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        if (e.target.checked) {
          // Ensure it's the selected radio
          currentFilters.party = e.target.value;
          populateMemberDropdown(); // Repopulate dropdown
          memberSelect.value = ""; // Reset selection
          if (memberInfoDiv && !memberInfoDiv.classList.contains("hidden"))
            clearData(); // Clear details
        }
      });
    });
  }
  if (chamberFilters.length > 0) {
    chamberFilters.forEach((radio) => {
      radio.addEventListener("change", (event) => {
        if (event.target.checked) {
          currentFilters.chamber = event.target.value;
          populateMemberDropdown(); // Repopulate dropdown
          memberSelect.value = ""; // Reset selection
          if (memberInfoDiv && !memberInfoDiv.classList.contains("hidden"))
            clearData(); // Clear details
        }
      });
    });
  }
  if (stateFilterSelect) {
    stateFilterSelect.addEventListener("change", (e) => {
      currentFilters.state = e.target.value;
      populateMemberDropdown(); // Repopulate dropdown
      memberSelect.value = ""; // Reset selection
      if (memberInfoDiv && !memberInfoDiv.classList.contains("hidden"))
        clearData(); // Clear details
    });
  }

  // Tab Button Listeners
  if (tabButtons.length > 0) {
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => switchTab(button));
    });
  } else {
    console.warn("Tab buttons not found.");
  }

  // --- Initial Population ---
  clearData(); // Set initial state (cleared display)

  // Fetch members for the initially selected Congress (if one is selected)
  const initialCongressValue = congressFilterSelect
    ? congressFilterSelect.value
    : null;
  if (initialCongressValue) {
    console.log(
      `Initial load: Fetching members for Congress ${initialCongressValue}`
    );
    currentFilters.congress = initialCongressValue; // Ensure filter state matches dropdown
    fetchCongressMembers(initialCongressValue);
  } else {
    console.warn(
      "Initial Congress not selected in dropdown, cannot fetch members on load."
    );
    memberSelect.innerHTML = '<option value="">-- Select Congress --</option>';
    memberSelect.disabled = true;
  }
}); // End DOMContentLoaded
