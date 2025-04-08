document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing script...");

    // --- Get references ---
    const memberSelect = document.getElementById('member-select');
    const nameSearchInput = document.getElementById('name-search');
    const partyFilters = document.querySelectorAll('input[name="party-filter"]');
    const stateFilterSelect = document.getElementById('state-filter');
    const memberInfoDiv = document.getElementById('member-info');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const memberPhoto = document.getElementById('member-photo');
    const photoLoadingError = document.getElementById('photo-loading-error');
    const memberDetailsContainer = document.getElementById('member-details-content');
    const sponsoredItemsList = document.getElementById('sponsored-bills-list');
    const voteList = document.getElementById('vote-list');
    const sponsoredItemsStatus = document.getElementById('sponsored-bills-status');
    const votesStatus = document.getElementById('votes-status');

    if (!memberSelect || !memberInfoDiv) { console.error("CRITICAL: Base UI elements missing!"); return; }

    // --- Global Variables & Constants ---
    let currentFilters = { name: '', party: 'ALL', state: 'ALL' };
    const billTypePaths = {
        'S': 'senate-bill', 'HR': 'house-bill', 'HRES': 'house-resolution',
        'SRES': 'senate-resolution', 'HJRES': 'house-joint-resolution',
        'SJRES': 'senate-joint-resolution', 'HCONRES': 'house-concurrent-resolution',
        'SCONRES': 'senate-concurrent-resolution'
    };

    // --- Helper functions ---
    function createLegislationListItem(item) { // Renamed helper
        const listItem = document.createElement('li');
        let itemDisplayNum = 'N/A'; // What we show the user
        let itemElement = document.createElement('span'); // Default to span
        const itemTitle = item.title || 'No Title'; // Use standardized title from backend

        if (item.item_type === "Bill") {
            itemDisplayNum = `${item.type || ''}${item.number || ''}`; // Use standardized keys
            const urlPathSegment = billTypePaths[item.type]; // Use standardized type for path
            // Try to create link for Bills
            if (itemDisplayNum && item.congress && item.type && urlPathSegment && item.number) {
                itemElement = document.createElement('a'); // Change to link
                itemElement.href = `https://www.congress.gov/bill/${item.congress}th-congress/${urlPathSegment}/${item.number}`;
                itemElement.target = "_blank"; itemElement.rel = "noopener noreferrer";
            } else { console.warn(`Could not form link for Bill: ${itemDisplayNum}`); }
             itemElement.textContent = itemDisplayNum || 'N/A'; // Set text content even for span
        } else if (item.item_type === "Amendment") {
            // Use number from backend, display clearly
            itemDisplayNum = `Amendment ${item.number || ''}`;
            // Don't attempt to create a link for amendments for now
            itemElement.textContent = itemDisplayNum.trim() || 'N/A'; // Display as text in the span
        } else {
            // Handle unexpected item types if necessary
            itemDisplayNum = `Unknown Type: ${item.number || 'N/A'}`;
            itemElement.textContent = itemDisplayNum;
        }

        listItem.appendChild(itemElement); // Append the link or span
        listItem.appendChild(document.createTextNode(`: ${itemTitle} `));
        if (item.introduced_date) { listItem.appendChild(document.createTextNode(`(Introduced: ${item.introduced_date}) `)); }
        listItem.appendChild(document.createTextNode(`(Latest Action: ${item.latest_action_text || 'N/A'} on ${item.latest_action_date || 'N/A'})`));
        return listItem;
    }

    function createVoteListItem(vote) {
        const listItem = document.createElement('li'); const billText = `Bill: ${vote.bill_id || 'N/A'}`;
        let voteResultText = ''; if (vote.result && vote.result !== 'N/A'){ voteResultText = ` Result: ${vote.result};`}
        listItem.textContent = `[${vote.vote || 'N/A'}] ${vote.description || 'No Description'} (${billText}, Roll Call: ${vote.roll_call || 'N/A'}, Date: ${vote.vote_date || 'N/A'}${voteResultText})`;
        return listItem;
    }

    function populateMemberDropdown() {
        if (!memberSelect) { console.error("populateMemberDropdown: Select element missing."); return; }
        memberSelect.innerHTML = '';
        const defaultOption = document.createElement('option'); defaultOption.value = ""; defaultOption.textContent = "-- Choose Member --"; memberSelect.appendChild(defaultOption);
        if (typeof allMembersData === 'undefined' || !Array.isArray(allMembersData) || allMembersData.length === 0) { console.warn("populateMemberDropdown: allMembersData invalid/empty."); defaultOption.textContent = "-- No members loaded --"; memberSelect.disabled = true; return; }
        else { memberSelect.disabled = false; }
        const nameFilter = currentFilters.name.toLowerCase(); const partyFilter = currentFilters.party; const stateFilter = currentFilters.state;
        const filteredMembers = allMembersData.filter(member => {
            if (!member) return false;
            const nameMatch = !nameFilter || (member.name && member.name.toLowerCase().includes(nameFilter));
            const stateMatch = stateFilter === 'ALL' || member.state === stateFilter;
            const partyCode = member.party_code || ''; let partyMatch = partyFilter === 'ALL';
            if (!partyMatch) { if (partyFilter === 'ID') { partyMatch = partyCode !== 'D' && partyCode !== 'R'; } else { partyMatch = partyCode === partyFilter; } }
            return nameMatch && stateMatch && partyMatch;
        }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (filteredMembers.length === 0) { defaultOption.textContent = "-- No members match filters --"; }
        else { defaultOption.textContent = `-- Select from ${filteredMembers.length} members --`; }
        filteredMembers.forEach(member => { if (member && member.bioguide_id && member.name) { const opt = document.createElement('option'); opt.value = member.bioguide_id; opt.textContent = member.name; memberSelect.appendChild(opt); } });
        console.log(`Populated dropdown. Filters: Name='${nameFilter}', Party='${partyFilter}', State='${stateFilter}'. Count: ${filteredMembers.length}`);
    }

    function displayError(statusElement, listElement, message) {
        if (listElement) listElement.innerHTML = '';
        if (statusElement) {
            statusElement.classList.remove('loading');
            if (!statusElement.querySelector('.error-message')) { statusElement.insertAdjacentHTML('afterbegin', `<p class="error-message">${message || 'An error occurred.'}</p>`); }
        } else { console.error("Cannot display error, status element missing:", statusElement); }
    }

    function switchTab(selectedButton) {
        if (!selectedButton || !tabButtons || !tabPanes) return;
        tabButtons.forEach(b => b.classList.remove('active')); tabPanes.forEach(p => p.classList.remove('active'));
        selectedButton.classList.add('active'); const targetId = selectedButton.getAttribute('data-tab');
        const targetPane = document.getElementById(targetId);
        if (targetPane) { targetPane.classList.add('active'); console.log(`Switched to tab: ${targetId}`); }
        else { console.error(`Tab pane missing: ${targetId}`); }
    }

    // --- Function to fetch data ---
    async function fetchData(memberId) {
        console.log(`Fetching data for member ${memberId}...`);
        if (!memberInfoDiv) { console.error("Info div missing!"); return; }
        memberInfoDiv.classList.remove('hidden');
        if (tabButtons.length > 0) switchTab(tabButtons[0]);

        // Show loading state (with checks)
        if (memberDetailsContainer) memberDetailsContainer.innerHTML = '<p>Loading details...</p>';
        if (memberPhoto) memberPhoto.style.display = 'none'; if (photoLoadingError) photoLoadingError.style.display = 'none';
        if (sponsoredItemsStatus) sponsoredItemsStatus.classList.add('loading'); if (votesStatus) votesStatus.classList.add('loading');
        if (sponsoredItemsList) sponsoredItemsList.innerHTML = ''; if (voteList) voteList.innerHTML = '';
        // Clear previous errors (with checks)
        const statusDivs = [sponsoredItemsStatus, votesStatus];
        statusDivs.forEach(div => { if(div){ const e = div.querySelector('.error-message'); if(e) e.remove(); }});
        if(memberDetailsContainer) { const e = memberDetailsContainer.querySelector('.error-message'); if(e) e.remove(); }
        if(photoLoadingError) { const pc = photoLoadingError.parentNode; if(pc){ const e = pc.querySelector('.error-message'); if(e && e !== photoLoadingError) e.remove(); }}


        const url = `/api/member/${memberId}`;
        try {
            const response = await fetch(url); const data = await response.json(); console.log("Data received:", data);
            if (!response.ok || data.error) { const eMsg = data.error || `HTTP error ${response.status}`; throw new Error(eMsg); }
            if (sponsoredItemsStatus) sponsoredItemsStatus.classList.remove('loading'); if (votesStatus) votesStatus.classList.remove('loading');
            updateDisplay(data);
        } catch (error) {
            console.error("Could not fetch/process data:", error);
            if (sponsoredItemsStatus) sponsoredItemsStatus.classList.remove('loading'); if (votesStatus) votesStatus.classList.remove('loading');
            if (memberDetailsContainer) memberDetailsContainer.innerHTML = `<p class="error-message">Could not load data: ${error.message}</p>`;
            displayError(sponsoredItemsStatus, sponsoredItemsList, 'Could not load sponsored items.');
            displayError(votesStatus, voteList, 'Could not load vote data.');
            if (memberPhoto) memberPhoto.style.display = 'none'; if (photoLoadingError) photoLoadingError.style.display = 'none';
        }
    }

    // --- Function to update the display ---
    function updateDisplay(data) {
        console.log("Updating display START");

        // --- Member Details & Photo Tab ---
        console.log("Updating member details & photo...");
        if (data.member_details && memberDetailsContainer) {
            const details = data.member_details;
            let detailsHtml = '';
            if (details.name) detailsHtml += `<strong>Name:</strong> ${details.name}<br>`;
            if (details.state || details.party) { detailsHtml += `<strong>State:</strong> ${details.state || 'N/A'} | <strong>Party:</strong> ${details.party || 'N/A'}`; }
            else if (details.name) { detailsHtml += '<br>'; }
            if (details.birth_year) detailsHtml += `<br><strong>Birth Year:</strong> ${details.birth_year}`;
            if(details.leadership && details.leadership.length > 0){ detailsHtml += `<br><strong>Leadership:</strong> ${details.leadership.map(l => l.type || 'N/A').join(', ')}`; }
            if (details.website_url) { let safeUrl = details.website_url; if (safeUrl && !safeUrl.startsWith('http')) { safeUrl = 'https://' + safeUrl; } if(safeUrl) { detailsHtml += ` | <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Official Website</a>`; }}
            if (detailsHtml.trim() === '') detailsHtml = '<p>Basic details not fully available.</p>';
            console.log("Attempting to set details HTML:", detailsHtml);
            memberDetailsContainer.innerHTML = detailsHtml;
            console.log("Details container innerHTML is now (first 200 chars):", memberDetailsContainer.innerHTML.substring(0, 200) + "...");

            // Photo logic
            if (details.bioguide_id && memberPhoto && photoLoadingError) {
                const photoUrl = `https://bioguide.congress.gov/bioguide/photo/${details.bioguide_id.charAt(0)}/${details.bioguide_id}.jpg`;
                memberPhoto.src = photoUrl; memberPhoto.alt = `Photo of ${details.name}`;
                memberPhoto.style.display = 'block'; photoLoadingError.style.display = 'none';
                memberPhoto.onerror = () => { console.warn(`Failed photo: ${photoUrl}`); memberPhoto.style.display = 'none'; photoLoadingError.textContent="Photo not found"; photoLoadingError.style.display = 'block'; memberPhoto.onerror = null; };
                memberPhoto.onload = () => { photoLoadingError.style.display = 'none'; };
            } else { if (memberPhoto) memberPhoto.style.display = 'none'; if (photoLoadingError) { photoLoadingError.textContent="Photo ID missing"; photoLoadingError.style.display = 'block';} }
        } else {
             const errorMsg = data.error || 'Member details not available.';
             if (memberDetailsContainer) memberDetailsContainer.innerHTML = `<p class="error-message">${errorMsg}</p>`;
             if (memberPhoto) memberPhoto.style.display = 'none'; if (photoLoadingError) { photoLoadingError.textContent="Photo not available"; photoLoadingError.style.display = 'block'; }
        }
        console.log("Member details & photo updated.");


        // --- Sponsored Legislation Tab --- (Use updated keys & helper)
        console.log("Updating sponsored legislation...");
        const sponsoredListElement = sponsoredItemsList;
        const sponsoredStatusElement = sponsoredItemsStatus;
        if (sponsoredListElement && sponsoredStatusElement) {
            sponsoredListElement.innerHTML = '';
            if(data.sponsored_items_error){ // Use correct error key
                 displayError(sponsoredStatusElement, sponsoredListElement, data.sponsored_items_error);
            } else if (data.sponsored_items && data.sponsored_items.length > 0) { // Use correct items key
                 try { data.sponsored_items.forEach(item => sponsoredListElement.appendChild(createLegislationListItem(item))); } // Use correct helper
                 catch(e) { console.error("JS Error processing sponsored legislation:", e); displayError(sponsoredStatusElement, sponsoredListElement, 'Error displaying items.');}
             } else { sponsoredListElement.innerHTML = '<li>No recently sponsored legislation found.</li>'; }
        } else { console.error("Sponsored legislation list/status element missing!"); }
        console.log("Sponsored legislation updated.");


         // --- Votes Tab ---
         console.log("Updating votes...");
         if (voteList && votesStatus) {
            voteList.innerHTML = '';
              if(data.votes_error){
                  displayError(votesStatus, voteList, data.votes_error);
              } else if (data.votes && data.votes.length > 0) {
                  try { data.votes.forEach(vote => voteList.appendChild(createVoteListItem(vote))); }
                  catch(e) { console.error("JS Error processing votes:", e); displayError(votesStatus, voteList, 'Error displaying votes.');}
              } else { voteList.innerHTML = '<li>No recent votes available or fetching is disabled.</li>'; }
         } else { console.error("Vote list element missing!"); }
        console.log("Votes updated.");

        console.log("Updating display END");
    }


    // --- Function to clear the display ---
    function clearData() {
        console.log("Clearing display data.");
        if (memberInfoDiv) memberInfoDiv.classList.add('hidden');
        if (memberDetailsContainer) memberDetailsContainer.innerHTML = '<p>Select a member to view details.</p>';
        if (memberPhoto) { memberPhoto.style.display = 'none'; memberPhoto.src = ""; } if (photoLoadingError) photoLoadingError.style.display = 'none';
        if (memberDetailsContainer) { const e = memberDetailsContainer.querySelector('.error-message'); if(e) e.remove(); }
        // Clear Bills
        if (sponsoredItemsStatus) sponsoredItemsStatus.classList.remove('loading'); if (sponsoredItemsList) sponsoredItemsList.innerHTML = '<li>Select a member to view sponsored legislation.</li>'; // Updated text
        if (sponsoredItemsStatus) { const e = sponsoredItemsStatus.querySelector('.error-message'); if(e) e.remove(); }
        // Clear Votes
        if (votesStatus) votesStatus.classList.remove('loading'); if (voteList) voteList.innerHTML = '<li>Select a member to view votes.</li>';
        if (votesStatus) { const e = votesStatus.querySelector('.error-message'); if(e) e.remove(); }
        // Reset Tab
        if(tabButtons && tabButtons.length > 0) { switchTab(tabButtons[0]); }
    }

    // --- Tab Switching Logic ---
    function switchTab(selectedButton) {
        if (!selectedButton || !tabButtons || !tabPanes) return;
        tabButtons.forEach(b => b.classList.remove('active')); tabPanes.forEach(p => p.classList.remove('active'));
        selectedButton.classList.add('active'); const targetId = selectedButton.getAttribute('data-tab');
        const targetPane = document.getElementById(targetId);
        if (targetPane) { targetPane.classList.add('active'); console.log(`Switched to tab: ${targetId}`); }
        else { console.error(`Tab pane missing: ${targetId}`); }
    }

    // --- Event Listeners Setup ---
     console.log("Setting up listeners...");
    if(memberSelect) { memberSelect.addEventListener('change', (e) => { const id = e.target.value; if (id) fetchData(id); else clearData(); }); }
    if(nameSearchInput) { let dt; nameSearchInput.addEventListener('input', (e) => { clearTimeout(dt); dt = setTimeout(() => { currentFilters.name = e.target.value; populateMemberDropdown(); }, 300); }); }
    if(partyFilters.length > 0) { partyFilters.forEach(r => { r.addEventListener('change', (e) => { currentFilters.party = e.target.value; populateMemberDropdown(); clearData(); }); }); }
    if(stateFilterSelect) { stateFilterSelect.addEventListener('change', (e) => { currentFilters.state = e.target.value; populateMemberDropdown(); clearData(); }); }
    if(tabButtons.length > 0) { tabButtons.forEach(b => { b.addEventListener('click', () => switchTab(b)); }); }


    // --- Initial Population ---
    if (typeof allMembersData !== 'undefined' && Array.isArray(allMembersData)) {
        console.log(`Initial member data confirmed in DOMContentLoaded: ${allMembersData.length} members`);
        populateMemberDropdown();
    } else {
        console.error("CRITICAL: Global 'allMembersData' missing/invalid in DOMContentLoaded.");
        const container = document.getElementById('member-select-container');
        if (container && !container.querySelector('.error-message')) { displayError(container, memberSelect, "Failed to load member list data."); }
        if(memberSelect) memberSelect.disabled = true;
    }
    clearData(); // Set initial state

}); // End DOMContentLoaded