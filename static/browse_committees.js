// FILE: static/browse_committees.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("Browse Committees JS Loaded");

  // --- Read initial data from data attribute ---
  const bodyElement = document.body;
  const initialBrowseCongress = bodyElement.dataset.initialCongress || null; // Read from data-* attribute
  console.log("Initial Congress from data attribute:", initialBrowseCongress);

  // References
  const congressSelect = document.getElementById("browse-congress-filter");
  const chamberSelect = document.getElementById("browse-chamber-filter");
  const loadButton = document.getElementById("apply-filters-btn");
  const committeesListUl = document.getElementById("committees-list");
  const statusDiv = document.getElementById("committees-list-status");
  const errorP = statusDiv.querySelector(".error-message");
  const loader = statusDiv.querySelector(".loader");
  const paginationControls = document.getElementById("pagination-controls");
  const prevButton = document.getElementById("prev-page-btn");
  const nextButton = document.getElementById("next-page-btn");
  const pageInfoSpan = document.getElementById("page-info");
  const resultsTitleSuffix = document.getElementById("results-title-suffix");

  // State
  let currentPageOffset = 0;
  const itemsPerPage = 25; // Match backend default/limit
  let currentTotalItems = 0;
  let currentNextUrl = null;

  // --- Helper Functions ---
  function setLoading(isLoading) {
    if (isLoading) {
      loader.style.display = "block";
      committeesListUl.style.opacity = "0.5";
      errorP.style.display = "none";
      errorP.textContent = "";
    } else {
      loader.style.display = "none";
      committeesListUl.style.opacity = "1";
    }
  }

  function displayError(message) {
    setLoading(false);
    errorP.textContent = message || "An error occurred.";
    errorP.style.display = "block";
    committeesListUl.innerHTML = "";
    paginationControls.style.display = "none";
  }

  function parseOffsetFromUrl(url) {
    if (!url) return null;
    try {
      // Ensure URL is absolute for constructor
      const fullUrl = url.startsWith("http")
        ? url
        : `https://example.com${url}`; // Dummy base if relative
      const urlParams = new URLSearchParams(new URL(fullUrl).search);
      const offset = parseInt(urlParams.get("offset"), 10);
      return isNaN(offset) ? null : offset;
    } catch (e) {
      console.error("Error parsing offset from URL:", url, e);
      return null;
    }
  }

  // --- Fetch and Display Committees ---
  async function fetchCommittees(offset = 0) {
    const congress = congressSelect.value; // Can be ""
    const chamber = chamberSelect.value; // Can be ""

    let titleInfo = "Listing Committees";
    if (congress) titleInfo += ` for Congress ${congress}`;
    if (chamber)
      titleInfo += ` (${chamber.charAt(0).toUpperCase() + chamber.slice(1)})`;
    resultsTitleSuffix.textContent = titleInfo;

    console.log(
      `Fetching committees: Congress=${congress || "All"}, Chamber=${
        chamber || "All"
      }, Offset=${offset}`
    );

    setLoading(true);
    committeesListUl.innerHTML = "<li>Loading committees...</li>";
    paginationControls.style.display = "none";

    const params = new URLSearchParams({
      offset: offset,
      limit: itemsPerPage,
    });
    if (congress) params.append("congress", congress);
    if (chamber) params.append("chamber", chamber);

    const apiUrl = `/api/committees?${params.toString()}`;
    console.log(`Requesting API URL: ${apiUrl}`);

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      console.log("API Response:", data);

      if (data.error) {
        throw new Error(data.error);
      }
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      if (!data || data.pagination === undefined) {
        console.warn("API response missing expected structure. Data:", data);
        renderCommitteesList(data.committees || []);
        updatePagination(null, offset);
      } else {
        renderCommitteesList(data.committees || []);
        updatePagination(data.pagination, offset);
      }
      setLoading(false);
    } catch (err) {
      console.error("Error fetching committees:", err);
      displayError(`Failed to load committees: ${err.message}`);
      resultsTitleSuffix.textContent = "";
    }
  }

  function renderCommitteesList(committees) {
    committeesListUl.innerHTML = ""; // Clear previous
    if (!committees || committees.length === 0) {
      committeesListUl.innerHTML =
        "<li>No committees found matching your criteria.</li>";
      return;
    }

    committees.forEach((committee) => {
      const li = document.createElement("li");
      const name = committee.name || "Unknown Committee";
      const type = committee.committeeTypeCode || committee.type || "N/A"; // API uses both 'type' and 'committeeTypeCode'
      const chamber = committee.chamber || "N/A";
      const systemCode = committee.systemCode || "N/A";
      const detailUrl = committee.detailPageUrl; // Use pre-generated internal URL

      let link = name;
      if (detailUrl) {
        link = `<a href="${detailUrl}" title="View details for ${name}">${name}</a>`;
      }

      li.innerHTML = `
                <span class="committee-name">${link}</span>
                <span class="committee-meta">(${chamber} - ${type}) - Code: ${systemCode}</span>
                ${
                  committee.subcommittees
                    ? `<span class="committee-subs">(${committee.subcommittees.length} Subcommittees)</span>`
                    : ""
                }
            `; // Show subcommittee count if available directly in list item
      committeesListUl.appendChild(li);
    });
  }

  function updatePagination(paginationData, currentOffset) {
    if (!paginationData || typeof paginationData !== "object") {
      paginationControls.style.display = "none";
      currentTotalItems = 0;
      currentNextUrl = null;
      return;
    }
    currentTotalItems = paginationData.count || 0;
    currentNextUrl = paginationData.next || null;
    const currentPage = Math.floor(currentOffset / itemsPerPage) + 1;
    const totalPages =
      currentTotalItems > 0 ? Math.ceil(currentTotalItems / itemsPerPage) : 1;
    pageInfoSpan.textContent = `Page ${currentPage} of ${totalPages} (${currentTotalItems} items)`;
    prevButton.disabled = currentOffset <= 0;
    nextButton.disabled = !currentNextUrl;
    paginationControls.style.display =
      currentTotalItems > itemsPerPage ? "flex" : "none";
  }

  // --- Event Listeners ---
  loadButton.addEventListener("click", () => {
    currentPageOffset = 0; // Reset to first page
    fetchCommittees(currentPageOffset);
  });

  prevButton.addEventListener("click", () => {
    const prevOffset = Math.max(0, currentPageOffset - itemsPerPage);
    if (prevOffset !== currentPageOffset) {
      currentPageOffset = prevOffset;
      fetchCommittees(currentPageOffset);
    }
  });

  nextButton.addEventListener("click", () => {
    const nextOffset = parseOffsetFromUrl(currentNextUrl);
    if (nextOffset !== null && nextOffset !== currentPageOffset) {
      currentPageOffset = nextOffset;
      fetchCommittees(currentPageOffset);
    } else {
      console.warn("Could not determine next offset from URL:", currentNextUrl);
    }
  });

  // --- Initial Load ---
  paginationControls.style.display = "none";
  // Set initial congress filter value using the value read from the data attribute
  if (congressSelect && initialBrowseCongress) {
    congressSelect.value = initialBrowseCongress;
  } else if (congressSelect) {
    // If no initial congress, maybe default to "All Congresses" or the first option
    congressSelect.value = ""; // Default to "All Congresses" if specified in HTML
  }
  // Trigger initial load using the potentially set value
  fetchCommittees(0);
}); // End DOMContentLoaded
