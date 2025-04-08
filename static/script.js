// Get references to HTML elements
const memberSelect = document.getElementById('member-select');
// Filters
const nameSearchInput = document.getElementById('name-search');
const partyFilters = document.querySelectorAll('input[name="party-filter"]');
const stateFilterSelect = document.getElementById('state-filter');
// Main info container (to show/hide)
const memberInfoDiv = document.getElementById('member-info');
// Tab Navigation
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanes = document.querySelectorAll('.tab-pane');
// Detail Tab Content
const memberPhoto = document.getElementById('member-photo');
const photoLoadingError = document.getElementById('photo-loading-error');
const memberDetailsContainer = document.getElementById('member-details-content'); // Now a div
// Other Tab Content Lists & Status Wrappers
const committeeList = document.getElementById('committee-list');
const subcommitteeList = document.getElementById('subcommittee-list');
const sponsoredBillsList = document.getElementById('sponsored-bills-list');
const voteList = document.getElementById('vote-list');
const committeeStatus = document.getElementById('committee-status');
const sponsoredBillsStatus = document.getElementById('sponsored-bills-status');
const votesStatus = document.getElementById('votes-status');
// Note: member-status div wraps photo and details


// --- Global Variables ---
// 'allMembersData' is loaded via the inline script tag
let currentFilters = { // Store current filter values
    name: '',
    party: 'ALL',
    state: 'ALL'
};

// Define billTypePaths globally for mapping types to URL paths
const billTypePaths = {
    'S': 'senate-bill',
    'HR': 'house-bill',
    'HRES': 'house-resolution',
    'SRES': 'senate-resolution',
    'HJRES': 'house-joint-resolution', // <-- Added
    'SJRES': 'senate-joint-resolution', // <-- Added
    'HCONRES': 'house-concurrent-resolution',
    'SCONRES': 'senate-concurrent-resolution'
};


// --- Helper functions for creating list items ---
function createCommitteeListItem(committee) {
    const listItem = document.createElement('li');
    listItem.textContent = committee.name || 'N/A';
    return listItem;
}

function createSubcommitteeListItem(subcommittee) {
    const listItem = document.createElement('li');
    listItem.textContent = subcommittee.name || 'N/A';
    if(subcommittee.parent){
         listItem.textContent += ` (Parent: ${subcommittee.parent})`;
    }
    listItem.style.paddingLeft = '20px'; // Indent subcommittees
    return listItem;
}

function createSponsoredBillListItem(bill) {
    const listItem = document.createElement('li');
    const billNum = `${bill.type || ''}${bill.number || ''}`;
    const billCongress = bill.congress;
    const billType = bill.type;
    const billLink = document.createElement('a');

    // Lookup type in the global map
    const urlPathSegment = billTypePaths[billType];

     if(billNum && billCongress && billType && urlPathSegment && bill.number) {
        billLink.href = `https://www.congress.gov/bill/${billCongress}th-congress/${urlPathSegment}/${bill.number}`;
        billLink.textContent = billNum;
        billLink.target = "_blank";
        billLink.rel = "noopener noreferrer"; // Good practice for target="_blank"
    } else {
         // Log details for easier debugging
         console.warn(`Could not form link. Details: num=${billNum}, congress=${billCongress}, type=${billType}, pathSegment=${urlPathSegment}, number=${bill.number}`);
        billLink.textContent = billNum || 'N/A';
        // Optionally style non-links differently
        // billLink.style.color = "#555"; // Example: grey out unlinked
        // billLink.style.textDecoration = "none";
        // billLink.style.cursor = "default";
    }

    listItem.appendChild(billLink);
    listItem.appendChild(document.createTextNode(`: ${bill.title || 'No Title'} `)); // Title first
    if (bill.introduced_date) { // Add intro date if available
         listItem.appendChild(document.createTextNode(`(Introduced: ${bill.introduced_date}) `));
    }
     listItem.appendChild(document.createTextNode(`(Latest Action: ${bill.latest_action_text || 'N/A'} on ${bill.latest_action_date || 'N/A'})`));
    return listItem;
}

function createVoteListItem(vote) {
    const listItem = document.createElement('li');
    const billText = `Bill: ${vote.bill_id || 'N/A'}`;
    let voteResultText = '';
    if (vote.result && vote.result !== 'N/A'){
        voteResultText = ` Result: ${vote.result};`
    }
    listItem.textContent = `[${vote.vote || 'N/A'}] ${vote.description || 'No Description'} (${billText}, Roll Call: ${vote.roll_call || 'N/A'}, Date: ${vote.vote_date || 'N/A'}${voteResultText})`;
    return listItem;
}
 // --- End Helper functions ---


// --- Function to Populate Dropdown based on ALL filters ---
function populateMemberDropdown() {
    if (!memberSelect) { console.error("Member select DDL missing"); return; }
    memberSelect.innerHTML = ''; // Clear

    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "-- Choose Member --";
    memberSelect.appendChild(defaultOption);

    if (!allMembersData || allMembersData.length === 0) {
        defaultOption.textContent = "-- No members loaded --";
        memberSelect.disabled = true; return;
    } else {
         memberSelect.disabled = false;
    }

    const nameFilter = currentFilters.name.toLowerCase();
    const partyFilter = currentFilters.party;
    const stateFilter = currentFilters.state;

    const filteredMembers = allMembersData
        .filter(member => {
            if (!member) return false;
            const nameMatch = !nameFilter || (member.name && member.name.toLowerCase().includes(nameFilter));
            const stateMatch = stateFilter === 'ALL' || member.state === stateFilter;
            const partyUpper = (member.party || '').toUpperCase();
            let partyMatch = partyFilter === 'ALL';
            if (!partyMatch) {
                if (partyFilter === 'ID') {
                    partyMatch = partyUpper !== 'DEMOCRAT' && partyUpper !== 'REPUBLICAN';
                } else {
                    const checkParty = member.party_code || partyUpper; // Use code if available
                    partyMatch = checkParty.startsWith(partyFilter);
                }
            }
            return nameMatch && stateMatch && partyMatch;
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (filteredMembers.length === 0) {
         defaultOption.textContent = "-- No members match filters --";
    } else {
         defaultOption.textContent = `-- Select from ${filteredMembers.length} members --`;
    }

    filteredMembers.forEach(member => {
        if (member && member.bioguide_id && member.name) {
             const option = document.createElement('option');
            option.value = member.bioguide_id;
            option.textContent = member.name;
            memberSelect.appendChild(option);
        }
    });
    console.log(`Populated dropdown. Filters: Name='${nameFilter}', Party='${partyFilter}', State='${stateFilter}'. Count: ${filteredMembers.length}`);
}


// --- Function to display error messages ---
function displayError(statusElement, listElement, message) {
    if (listElement) listElement.innerHTML = ''; // Clear list content too
    if (statusElement) {
        statusElement.classList.remove('loading');
        if (!statusElement.querySelector('.error-message')) {
             statusElement.insertAdjacentHTML('afterbegin', `<p class="error-message">${message}</p>`);
        }
    } else {
        console.error("Cannot display error, status element not found for message:", message);
    }
}


// --- Function to fetch data ---
async function fetchData(memberId) {
    console.log(`Fetching data for member ${memberId}...`);
    memberInfoDiv.classList.remove('hidden');
    switchTab(tabButtons[0]); // Reset to first tab

    // Show loading state
    memberDetailsContainer.innerHTML = '<p>Loading details...</p>';
    memberPhoto.style.display = 'none';
    photoLoadingError.style.display = 'none';
    committeeStatus.classList.add('loading');
    sponsoredBillsStatus.classList.add('loading');
    votesStatus.classList.add('loading');
    committeeList.innerHTML = '';
    subcommitteeList.innerHTML = '';
    sponsoredBillsList.innerHTML = '';
    voteList.innerHTML = '';
    // Clear previous errors
    const statusDivs = [committeeStatus, sponsoredBillsStatus, votesStatus];
    statusDivs.forEach(div => {
        const errorMsg = div.querySelector('.error-message');
        if(errorMsg) errorMsg.remove();
    });
    const photoContainerError = photoLoadingError.parentNode.querySelector('.error-message'); // Clear detail error too if needed
    if(photoContainerError && photoContainerError !== photoLoadingError) photoContainerError.remove();


    const url = `/api/member/${memberId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try { const errorData = await response.json(); errorMsg += ` - ${errorData.error || 'Unknown server error'}`; } catch(e) {}
            throw new Error(errorMsg);
         }
        const data = await response.json();
        console.log("Data received:", data);

        // Remove loading state
        committeeStatus.classList.remove('loading');
        sponsoredBillsStatus.classList.remove('loading');
        votesStatus.classList.remove('loading');

        updateDisplay(data);

    } catch (error) {
        console.error("Could not fetch data:", error);
        // Remove loading state and display errors
        committeeStatus.classList.remove('loading');
        sponsoredBillsStatus.classList.remove('loading');
        votesStatus.classList.remove('loading');
        memberDetailsContainer.innerHTML = `<p class="error-message">Error loading details.</p>`;
        displayError(committeeStatus, committeeList, 'Error loading committees.');
        displayError(sponsoredBillsStatus, sponsoredBillsList, 'Error loading bills.');
        displayError(votesStatus, voteList, 'Error loading votes.');
    }
}


// --- Function to update the display ---
function updateDisplay(data) {
    console.log("Updating display START");

    // --- Member Details & Photo Tab ---
    console.log("Updating member details & photo...");
    if (data.member_details) {
        const details = data.member_details;
        let detailsHtml = `
            <strong>Name:</strong> ${details.name || 'N/A'} <br>
            <strong>State:</strong> ${details.state || 'N/A'} |
            <strong>Party:</strong> ${details.party || 'N/A'}
        `;
        if (details.website_url) {
             let safeUrl = details.website_url;
            if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) { safeUrl = 'https://' + safeUrl; } // Default to https
            detailsHtml += ` | <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Official Website</a>`;
        }
        memberDetailsContainer.innerHTML = detailsHtml;

        // Photo
        if (details.bioguide_id) {
            // Use bioguide.congress.gov URL
            const photoUrl = `https://bioguide.congress.gov/bioguide/photo/${details.bioguide_id.charAt(0)}/${details.bioguide_id}.jpg`;
            console.log("Attempting to load photo from:", photoUrl);

            memberPhoto.src = photoUrl;
            memberPhoto.alt = `Photo of ${details.name}`;
            memberPhoto.style.display = 'block';
            photoLoadingError.style.display = 'none';

             memberPhoto.onerror = () => {
                 console.warn(`Failed to load photo for ${details.bioguide_id} from ${photoUrl}`);
                 memberPhoto.style.display = 'none';
                 photoLoadingError.style.display = 'block';
                 memberPhoto.onerror = null;
             };
             memberPhoto.onload = () => {
                 photoLoadingError.style.display = 'none'; // Hide error if loads successfully
             };
        } else {
             memberPhoto.style.display = 'none';
             photoLoadingError.textContent = "Photo ID missing"; // More specific error
             photoLoadingError.style.display = 'block';
        }
    } else {
         memberDetailsContainer.innerHTML = '<p>Details not available.</p>';
         memberPhoto.style.display = 'none';
         photoLoadingError.textContent = "Photo not available";
         photoLoadingError.style.display = 'block';
    }
    console.log("Member details & photo updated.");

    // --- Committees Tab ---
    console.log("Updating committees...");
    committeeList.innerHTML = '';
    subcommitteeList.innerHTML = ''; // Ensure both cleared
    if (data.committees) {
         // Main Committees
         if (data.committees.main && data.committees.main.length > 0) {
             try {
                 data.committees.main.forEach(committee => {
                    committeeList.appendChild(createCommitteeListItem(committee));
                });
             } catch(e) { console.error("Error processing main committees:", e); displayError(committeeStatus, committeeList, 'Error displaying main committees.');}
         } else {
            committeeList.innerHTML = '<li>No main committee assignments found.</li>';
         }
         // Subcommittees
         if (data.committees.sub && data.committees.sub.length > 0) {
              try {
                 data.committees.sub.forEach(subcommittee => {
                    subcommitteeList.appendChild(createSubcommitteeListItem(subcommittee));
                });
              } catch(e) { console.error("Error processing subcommittees:", e); displayError(committeeStatus, subcommitteeList,'Error displaying subcommittees.'); /* Update subcommittee list or status div */ }
         } else {
             subcommitteeList.innerHTML = '<li>No subcommittee assignments found.</li>';
         }
    } else {
         // Handle case where committee data structure itself is missing/null
         displayError(committeeStatus, committeeList, 'Committee data unavailable.');
         subcommitteeList.innerHTML = '<li>Subcommittee data unavailable.</li>'; // Also clear/set subcommittees
    }
    console.log("Committees updated.");


    // --- Sponsored Bills Tab ---
    console.log("Updating sponsored bills...");
    sponsoredBillsList.innerHTML = '';
     if (data.sponsored_bills && data.sponsored_bills.length > 0) {
         try {
             data.sponsored_bills.forEach(bill => {
                sponsoredBillsList.appendChild(createSponsoredBillListItem(bill));
             });
         } catch(e) { console.error("Error processing sponsored bills:", e); displayError(sponsoredBillsStatus, sponsoredBillsList, 'Error displaying bills.');}
     } else {
        sponsoredBillsList.innerHTML = '<li>No recently sponsored bills found.</li>';
    }
    console.log("Sponsored bills updated.");


     // --- Votes Tab ---
     console.log("Updating votes...");
    voteList.innerHTML = '';
      if (data.votes && data.votes.length > 0) {
          try {
             data.votes.forEach(vote => {
                voteList.appendChild(createVoteListItem(vote));
             });
          } catch(e) { console.error("Error processing votes:", e); displayError(votesStatus, voteList, 'Error displaying votes.');}
      } else {
         voteList.innerHTML = '<li>No recent votes found or processed.</li>';
      }
    console.log("Votes updated.");

    console.log("Updating display END");
}


// --- Function to clear the display ---
function clearData() {
    console.log("Clearing display data.");
    memberInfoDiv.classList.add('hidden'); // Hide the whole info area

    // Reset details tab
    memberDetailsContainer.innerHTML = '<p>Select a member to view details.</p>';
    memberPhoto.style.display = 'none';
    memberPhoto.src = "";
    photoLoadingError.style.display = 'none';

    // Reset other tabs
    committeeStatus.classList.remove('loading');
    committeeList.innerHTML = '<li>Select a member to view committees.</li>';
    subcommitteeList.innerHTML = '<li>Select a member to view subcommittees.</li>';
    const committeeError = committeeStatus.querySelector('.error-message');
    if (committeeError) committeeError.remove();

    sponsoredBillsStatus.classList.remove('loading');
    sponsoredBillsList.innerHTML = '<li>Select a member to view sponsored bills.</li>';
     const billsError = sponsoredBillsStatus.querySelector('.error-message');
    if (billsError) billsError.remove();


    votesStatus.classList.remove('loading');
    voteList.innerHTML = '<li>Select a member to view votes.</li>';
     const votesError = votesStatus.querySelector('.error-message');
    if (votesError) votesError.remove();

    // Reset to first tab visually if tab buttons exist
     if(tabButtons && tabButtons.length > 0) {
         switchTab(tabButtons[0]);
     }
}

// --- Tab Switching Logic ---
function switchTab(selectedButton) {
     if (!selectedButton) {
         console.warn("SwitchTab called with invalid button.");
         return;
     }
    tabButtons.forEach(button => button.classList.remove('active'));
    tabPanes.forEach(pane => pane.classList.remove('active'));

    selectedButton.classList.add('active');
    const targetTabId = selectedButton.getAttribute('data-tab');
    const targetPane = document.getElementById(targetTabId);
    if (targetPane) {
        targetPane.classList.add('active');
        console.log(`Switched to tab: ${targetTabId}`);
    } else {
        console.error(`Tab pane not found for ID: ${targetTabId}`);
    }
}

// --- Event Listeners Setup ---
// Run setup after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Setting up listeners and initial state.");

    // Member Select Listener
    if(memberSelect) {
        memberSelect.addEventListener('change', (event) => {
            const memberId = event.target.value;
            if (memberId) { fetchData(memberId); } else { clearData(); }
        });
    } else { console.error("Member select DDL missing at listener setup."); }

     // Name Search Listener
     if(nameSearchInput) {
         nameSearchInput.addEventListener('input', (event) => {
             currentFilters.name = event.target.value;
             populateMemberDropdown();
             // Optional: Debounce this if it feels laggy on large lists
             // clearData(); // Don't clear data on just typing, only on filter *change*
         });
          // Clear data when search is cleared or loses focus maybe? Or keep as is.
     } else { console.warn("Name search input missing."); }


    // Party Filter Listener
    if(partyFilters.length > 0) {
        partyFilters.forEach(radio => {
            radio.addEventListener('change', (event) => {
                currentFilters.party = event.target.value;
                populateMemberDropdown();
                clearData(); // Clear details when major filter changes
            });
        });
    } else { console.warn("Party filters missing."); }

     // State Filter Listener
     if(stateFilterSelect) {
         stateFilterSelect.addEventListener('change', (event) => {
            currentFilters.state = event.target.value;
             populateMemberDropdown();
             clearData(); // Clear details when major filter changes
         });
     } else { console.warn("State filter select missing."); }

      // Tab Button Listeners
      if(tabButtons.length > 0) {
          tabButtons.forEach(button => {
              button.addEventListener('click', () => switchTab(button));
          });
      } else { console.warn("Tab buttons missing."); }


    // --- Initial Population ---
    // Check if allMembersData was loaded correctly from the template script tag
    if (typeof allMembersData !== 'undefined' && allMembersData && Array.isArray(allMembersData)) {
        console.log(`Initial member data loaded in JS: ${allMembersData.length} members`);
        populateMemberDropdown(); // Initial population with "ALL" filters
    } else {
        console.error("Global 'allMembersData' not found, empty, or not an array. Cannot populate dropdown initially.");
        const container = document.getElementById('member-select-container');
        if (container && !container.querySelector('.error-message')) {
            displayError(container, memberSelect, "Failed to load member list data for dropdown.");
        }
         if(memberSelect) memberSelect.disabled = true;
    }
    clearData(); // Set initial cleared state and hide #member-info
}); // End DOMContentLoaded