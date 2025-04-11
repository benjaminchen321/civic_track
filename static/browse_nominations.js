// FILE: static/browse_nominations.js
document.addEventListener("DOMContentLoaded", () => {
    console.log("Browse Nominations JS Loaded");

    // References
    const congressSelect = document.getElementById("browse-congress-filter");
    const loadButton = document.getElementById("apply-filters-btn");
    const nominationsListUl = document.getElementById("nominations-list");
    const statusDiv = document.getElementById("nominations-list-status");
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
            loader.style.display = 'block';
            nominationsListUl.style.opacity = '0.5';
            errorP.style.display = 'none'; errorP.textContent = '';
        } else {
            loader.style.display = 'none';
            nominationsListUl.style.opacity = '1';
        }
    }

    function displayError(message) {
        setLoading(false);
        errorP.textContent = message || "An error occurred.";
        errorP.style.display = 'block';
        nominationsListUl.innerHTML = '';
        paginationControls.style.display = 'none';
    }

     function parseOffsetFromUrl(url) {
        if (!url) return null;
        try {
            const fullUrl = url.startsWith('http') ? url : `https://example.com${url}`;
            const urlParams = new URLSearchParams(new URL(fullUrl).search);
            const offset = parseInt(urlParams.get('offset'), 10);
            return isNaN(offset) ? null : offset;
        } catch (e) { console.error("Error parsing offset:", url, e); return null; }
    }

    // --- Fetch and Display Nominations ---
    async function fetchNominations(offset = 0) {
        const congress = congressSelect.value; // Can be "" for All

        let titleInfo = "Listing Nominations";
        if (congress) { titleInfo += ` for Congress ${congress}`; }
        else { titleInfo += ` for All Congresses`; }
        resultsTitleSuffix.textContent = titleInfo;


        console.log(`Fetching nominations: Congress=${congress || 'All'}, Offset=${offset}`);

        setLoading(true);
        nominationsListUl.innerHTML = '<li>Loading nominations...</li>';
        paginationControls.style.display = 'none';

        const params = new URLSearchParams({
            offset: offset,
            limit: itemsPerPage
        });
        if (congress) { // Only add congress param if selected
            params.append('congress', congress);
        }

        const apiUrl = `/api/nominations?${params.toString()}`;
        console.log(`Requesting API URL: ${apiUrl}`);

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            console.log("API Response:", data);

            if (data.error) { throw new Error(data.error); }
            if (!response.ok) { throw new Error(`HTTP Error ${response.status}`); }
            if (!data || data.pagination === undefined) {
                 console.warn("API response missing expected structure. Data:", data);
                 renderNominationsList(data.nominations || []);
                 updatePagination(null, offset);
             } else {
                 renderNominationsList(data.nominations || []);
                 updatePagination(data.pagination, offset);
             }
            setLoading(false);

        } catch (err) {
            console.error("Error fetching nominations:", err);
            displayError(`Failed to load nominations: ${err.message}`);
             resultsTitleSuffix.textContent = "";
        }
    }

    function renderNominationsList(nominations) {
        nominationsListUl.innerHTML = ''; // Clear previous
        if (!nominations || nominations.length === 0) {
            nominationsListUl.innerHTML = '<li>No nominations found matching your criteria.</li>';
            return;
        }

        nominations.forEach(nom => {
            const li = document.createElement('li');
            const citation = nom.citation || `PN${nom.number}-${nom.congress}`;
            const org = nom.organization || "N/A";
            const latestActionText = nom.latestAction?.text || "N/A";
            const latestActionDate = nom.latestAction?.actionDate || "N/A";
            const receivedDate = nom.receivedDate || "N/A";
            const detailUrl = nom.detailPageUrl; // Use pre-generated internal URL

            let link = `<strong>${citation}</strong>`;
            if(detailUrl) {
                link = `<a href="${detailUrl}" title="View details for ${citation}">${citation}</a>`;
            }

            li.innerHTML = `
                <span class="nom-identifier">${link}</span> -
                <span class="nom-org">Organization: ${org}</span>
                <span class="nom-meta">(Received: ${receivedDate})</span>
                <span class="nom-latest-action">Latest Action (${latestActionDate}): ${latestActionText}</span>
            `;
            nominationsListUl.appendChild(li);
        });
    }

     function updatePagination(paginationData, currentOffset) {
        // (Same logic as browse_committees.js)
        if (!paginationData || typeof paginationData !== 'object') {
            paginationControls.style.display = 'none';
            currentTotalItems = 0; currentNextUrl = null; return;
        }
        currentTotalItems = paginationData.count || 0;
        currentNextUrl = paginationData.next || null;
        const currentPage = Math.floor(currentOffset / itemsPerPage) + 1;
        const totalPages = currentTotalItems > 0 ? Math.ceil(currentTotalItems / itemsPerPage) : 1;
        pageInfoSpan.textContent = `Page ${currentPage} of ${totalPages} (${currentTotalItems} items)`;
        prevButton.disabled = currentOffset <= 0;
        nextButton.disabled = !currentNextUrl;
        paginationControls.style.display = (currentTotalItems > itemsPerPage) ? 'flex' : 'none';
     }


    // --- Event Listeners ---
    loadButton.addEventListener("click", () => {
        currentPageOffset = 0; // Reset to first page
        fetchNominations(currentPageOffset);
    });

     prevButton.addEventListener("click", () => {
         const prevOffset = Math.max(0, currentPageOffset - itemsPerPage);
         if (prevOffset !== currentPageOffset) {
             currentPageOffset = prevOffset;
             fetchNominations(currentPageOffset);
         }
     });

     nextButton.addEventListener("click", () => {
         const nextOffset = parseOffsetFromUrl(currentNextUrl);
         if (nextOffset !== null && nextOffset !== currentPageOffset) {
             currentPageOffset = nextOffset;
             fetchNominations(currentPageOffset);
         } else {
             console.warn("Could not determine next offset from URL:", currentNextUrl);
         }
     });

    // --- Initial Load ---
    paginationControls.style.display = 'none';
     // Set initial congress filter value from backend (or global JS variable)
     if (congressSelect && initialBrowseCongress) { // Ensure variable exists
        congressSelect.value = initialBrowseCongress;
     }
    // Trigger initial load for the default view
    fetchNominations(0);


}); // End DOMContentLoaded