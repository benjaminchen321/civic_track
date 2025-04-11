// FILE: static/browse_bills.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("Browse Bills JS Loaded");

  // References
  const congressSelect = document.getElementById("browse-congress-filter");
  const billTypeSelect = document.getElementById("browse-billtype-filter");
  const loadButton = document.getElementById("apply-filters-btn");
  const billsListUl = document.getElementById("bills-list");
  const statusDiv = document.getElementById("bills-list-status");
  const errorP = statusDiv.querySelector(".error-message");
  const loader = statusDiv.querySelector(".loader");
  const paginationControls = document.getElementById("pagination-controls");
  const prevButton = document.getElementById("prev-page-btn");
  const nextButton = document.getElementById("next-page-btn");
  const pageInfoSpan = document.getElementById("page-info");
  const resultsTitleSuffix = document.getElementById("results-title-suffix");

  // State
  let currentPageOffset = 0;
  const itemsPerPage = 20; // Should match backend default/limit if possible
  let currentTotalItems = 0;
  let currentNextUrl = null;

  // --- Helper Functions ---
  function setLoading(isLoading) {
    if (isLoading) {
      loader.style.display = "block";
      billsListUl.style.opacity = "0.5";
      errorP.style.display = "none";
      errorP.textContent = "";
    } else {
      loader.style.display = "none";
      billsListUl.style.opacity = "1";
    }
  }

  function displayError(message) {
    setLoading(false);
    errorP.textContent = message || "An error occurred.";
    errorP.style.display = "block";
    billsListUl.innerHTML = ""; // Clear list on error
    paginationControls.style.display = "none"; // Hide pagination on error
  }

  function parseOffsetFromUrl(url) {
    if (!url) return null;
    try {
      const urlParams = new URLSearchParams(new URL(url).search);
      const offset = parseInt(urlParams.get("offset"), 10);
      return isNaN(offset) ? null : offset;
    } catch (e) {
      console.error("Error parsing offset from URL:", e);
      return null;
    }
  }

  // --- Fetch and Display Bills ---
  async function fetchBills(offset = 0) {
    const congress = congressSelect.value;
    const billType = billTypeSelect.value; // Can be "" for All Types
    // <<< REMOVED: sort reading >>>

    // Update results title for context
    let titleInfo = `for Congress ${congress}`;
    if (billType) {
      titleInfo += `, Type ${billType.toUpperCase()}`;
    } else {
      titleInfo += `, All Types`;
    }
    resultsTitleSuffix.textContent = titleInfo;

    console.log(
      `Fetching bills with: Congress=${congress}, Type=${
        billType || "ALL"
      }, Offset=${offset}`
    ); // Log filters

    if (!congress) {
      displayError("Please select a Congress.");
      resultsTitleSuffix.textContent = ""; // Clear context
      return;
    }

    setLoading(true);
    billsListUl.innerHTML = "<li>Loading bills...</li>";
    paginationControls.style.display = "none";

    // Construct parameters for our backend API /api/bills
    const params = new URLSearchParams({
      congress: congress,
      offset: offset,
      limit: itemsPerPage,
      // <<< NO 'sort' parameter >>>
    });
    // Only add billType if it's selected (not empty string)
    if (billType) {
      params.append("billType", billType);
    }

    const apiUrl = `/api/bills?${params.toString()}`;
    console.log(`Requesting API URL: ${apiUrl}`);

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      console.log("API Response:", data);

      // Check for error in payload first
      if (data.error) {
        throw new Error(data.error);
      }
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      if (!data || data.pagination === undefined) {
        // Check pagination existence
        console.warn(
          "API response missing expected structure (pagination). Data:",
          data
        );
        renderBillsList(data.bills || []);
        updatePagination(null, offset); // Treat as no pagination info
      } else {
        renderBillsList(data.bills || []);
        updatePagination(data.pagination, offset);
      }
      setLoading(false);
    } catch (err) {
      console.error("Error fetching bills:", err);
      displayError(`Failed to load bills: ${err.message}`);
      resultsTitleSuffix.textContent = ""; // Clear context on error
    }
  }

  // --- Render Bills List ---
  function renderBillsList(bills) {
    billsListUl.innerHTML = ""; // Clear previous
    if (!bills || bills.length === 0) {
      billsListUl.innerHTML = "<li>No bills found matching your criteria.</li>";
      return;
    }

    bills.forEach((bill) => {
      const li = document.createElement("li");
      const title = bill.title || "No Title Provided";
      const latestActionText = bill.latestAction?.text || "N/A";
      const latestActionDate = bill.latestAction?.actionDate || "N/A";
      const billNum = `${bill.type || "?"}${bill.number ?? "?"}`; // Handle potential nulls

      let link = `<strong>${billNum}</strong>`; // Default if no URL
      // Use internal detail page link if available
      if (bill.detailPageUrl) {
        link = `<a href="${bill.detailPageUrl}" title="View details for ${billNum}">${billNum}</a>`;
      } else if (bill.congressDotGovUrl) {
        // Fallback to congress.gov link
        link = `<a href="${bill.congressDotGovUrl}" target="_blank" rel="noopener noreferrer" title="View ${billNum} on Congress.gov">${billNum}</a>`;
      }

      li.innerHTML = `
                <span class="bill-identifier">${link}</span>:
                <span class="bill-title">${title}</span>
                <span class="bill-meta">(Introduced: ${
                  bill.introducedDate || "N/A"
                })</span>
                <span class="bill-latest-action">Latest Action (${latestActionDate}): ${latestActionText}</span>
            `;
      billsListUl.appendChild(li);
    });
  }

  function updatePagination(paginationData, currentOffset) {
    if (!paginationData) {
      paginationControls.style.display = "none";
      return;
    }

    currentTotalItems = paginationData.count || 0;
    currentNextUrl = paginationData.next || null;
    // The API doesn't reliably provide a 'previous' URL, so we calculate based on offset
    currentPrevUrl =
      currentOffset > 0
        ? `offset=${Math.max(0, currentOffset - itemsPerPage)}`
        : null; // Simplified representation

    const currentPage = Math.floor(currentOffset / itemsPerPage) + 1;
    const totalPages = Math.ceil(currentTotalItems / itemsPerPage);

    pageInfoSpan.textContent = `Page ${currentPage} of ${totalPages} (${currentTotalItems} items)`;

    // Enable/disable buttons
    prevButton.disabled = currentOffset <= 0;
    nextButton.disabled = !currentNextUrl; // Disable if no next URL from API

    paginationControls.style.display =
      currentTotalItems > itemsPerPage ? "flex" : "none"; // Show only if multiple pages possible
  }

  // --- Event Listeners ---
  loadButton.addEventListener("click", () => {
    currentPageOffset = 0; // Reset to first page when filters change
    fetchBills(currentPageOffset);
  });

  prevButton.addEventListener("click", () => {
    // Calculate previous offset carefully
    const prevOffset = Math.max(0, currentPageOffset - itemsPerPage);
    if (prevOffset !== currentPageOffset) {
      currentPageOffset = prevOffset;
      fetchBills(currentPageOffset);
    }
  });

  nextButton.addEventListener("click", () => {
    const nextOffset = parseOffsetFromUrl(currentNextUrl);
    if (nextOffset !== null) {
      currentPageOffset = nextOffset;
      fetchBills(currentPageOffset);
    } else {
      console.warn("Could not determine next offset from URL:", currentNextUrl);
      // As a fallback if parsing fails, increment manually (less reliable if API skips offsets)
      // currentPageOffset += itemsPerPage;
      // fetchBills(currentPageOffset);
    }
  });

  // --- Initial Load ---
  // Optionally load bills for the default congress on page load
  // fetchBills(0);
  paginationControls.style.display = "none"; // Hide pagination initially
}); // End DOMContentLoaded
