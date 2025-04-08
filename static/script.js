// Get references to HTML elements
const memberSelect = document.getElementById('member-select');
const filterControls = document.getElementById('filter-controls'); // Filter container
const partyFilters = document.querySelectorAll('input[name="party-filter"]'); // Filter radio buttons

const memberDetailsContainer = document.getElementById('member-details-content'); // Now a div
const committeeList = document.getElementById('committee-list');
const sponsoredBillsList = document.getElementById('sponsored-bills-list');
const voteList = document.getElementById('vote-list');

// Status divs containing loaders/lists/errors
const memberStatus = document.getElementById('member-status');
const committeeStatus = document.getElementById('committee-status');
const sponsoredBillsStatus = document.getElementById('sponsored-bills-status');
const votesStatus = document.getElementById('votes-status');


// --- Global Variable for Original Data ---
// 'allMembersData' is loaded via the inline script tag in index.html


// --- Helper functions for creating list items ---
function createCommitteeListItem(committee) {
    const listItem = document.createElement('li');
    listItem.textContent = committee.name || 'N/A';
    return listItem;
}

// Make mapping accessible globally or ensure it's defined where needed
const billTypePaths = {
    'S': 'senate-bill',
    'HR': 'house-bill',
    'HRES': 'house-resolution',
    'SRES': 'senate-resolution',
    'HJRES': 'house-joint-resolution',
    'SJRES': 'senate-joint-resolution',
    'HCONRES': 'house-concurrent-resolution',
    'SCONRES': 'senate-concurrent-resolution'
};

function createSponsoredBillListItem(bill) {
    const listItem = document.createElement('li');
    const billNum = `${bill.type || ''}${bill.number || ''}`;
    const billCongress = bill.congress;
    const billType = bill.type;
    const billLink = document.createElement('a');
    const urlPathSegment = billTypePaths[billType];

     if(billNum && billCongress && billType && urlPathSegment && bill.number) {
        billLink.href = `https://www.congress.gov/bill/${billCongress}th-congress/${urlPathSegment}/${bill.number}`;
        billLink.textContent = billNum;
        billLink.target = "_blank";
        billLink.rel = "noopener noreferrer"; // Good practice for target="_blank"
    } else {
         console.warn(`Could not form link for bill: ${billNum} (Type: ${billType}, Congress: ${billCongress})`);
        billLink.textContent = billNum || 'N/A';
    }

    listItem.appendChild(billLink);
    listItem.appendChild(document.createTextNode(`: ${bill.title || 'No Title'} (Latest Action: ${bill.latest_action_text || 'N/A'} on ${bill.latest_action_date || 'N/A'})`));
    return listItem;
}

function createVoteListItem(vote) {
    const listItem = document.createElement('li');
    const billText = `Bill: ${vote.bill_id || 'N/A'}`;
    // Add more details if needed, potentially link the bill ID here too
    listItem.textContent = `[${vote.vote || 'N/A'}] ${vote.description || 'No Description'} (${billText}, Roll Call: ${vote.roll_call || 'N/A'}, Date: ${vote.vote_date || 'N/A'})`;
    return listItem;
}
 // --- End Helper functions ---


// --- Function to Populate Dropdown ---
function populateMemberDropdown(filterParty = 'ALL') {
    // Check if memberSelect exists before manipulating it
    if (!memberSelect) {
        console.error("Member select dropdown not found!");
        return;
    }
    memberSelect.innerHTML = ''; // Clear existing options

    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "-- Please choose a member --";
    memberSelect.appendChild(defaultOption);

    // Check if allMembersData is populated
    if (!allMembersData || allMembersData.length === 0) {
        console.warn("allMembersData is empty, cannot populate dropdown.");
         defaultOption.textContent = "-- No members loaded --"; // Update default option text
        memberSelect.disabled = true; // Disable dropdown if no data
        return;
    } else {
        memberSelect.disabled = false; // Ensure dropdown is enabled if data exists
    }


    const filteredMembers = allMembersData
        .filter(member => {
            if (!member || !member.party) return filterParty === 'ALL'; // Handle potential bad data, allow ALL
            const partyUpper = member.party.toUpperCase();
            if (filterParty === 'ALL') return true;
            if (filterParty === 'ID') {
                return partyUpper !== 'DEMOCRAT' && partyUpper !== 'REPUBLICAN';
            }
            return partyUpper.startsWith(filterParty); // Check D or R start
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')); // Sort safely

    filteredMembers.forEach(member => {
        if (member && member.bioguide_id && member.name) { // Extra safety check
             const option = document.createElement('option');
            option.value = member.bioguide_id;
            option.textContent = member.name;
            memberSelect.appendChild(option);
        }
    });

    console.log(`Populated dropdown with ${filteredMembers.length} members (Filter: ${filterParty})`);
}


// --- Function to display error messages ---
function displayError(statusElement, listElement, message) {
    if (listElement) listElement.innerHTML = ''; // Clear the list content
    if (statusElement) {
        // Ensure loader isn't showing when error appears
        statusElement.classList.remove('loading');
        statusElement.innerHTML = `<p class="error-message">${message}</p>`;
    } else {
        console.error("Cannot display error, status element not found for message:", message)
    }
}


// --- Function to fetch data from the backend API ---
async function fetchData(memberId) {
    console.log(`Fetching data for ${memberId}...`);

    // Show loading state
    memberDetailsContainer.innerHTML = 'Loading details...'; // Use innerHTML for consistency
    committeeStatus.classList.add('loading');
    sponsoredBillsStatus.classList.add('loading');
    votesStatus.classList.add('loading');
    committeeList.innerHTML = ''; // Clear lists before showing loader
    sponsoredBillsList.innerHTML = '';
    voteList.innerHTML = '';
    const committeeError = committeeStatus.querySelector('.error-message'); // Clear previous errors
    if (committeeError) committeeError.remove();
    const billsError = sponsoredBillsStatus.querySelector('.error-message');
    if (billsError) billsError.remove();
    const votesError = votesStatus.querySelector('.error-message');
    if (votesError) votesError.remove();


    const url = `/api/member/${memberId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Try to get error message from backend if available
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg += ` - ${errorData.error || 'Unknown server error'}`;
            } catch(e) { /* Ignore if response isn't JSON */ }
            throw new Error(errorMsg);
        }
        const data = await response.json();
        console.log("Data received:", data);

        // Remove loading state
        committeeStatus.classList.remove('loading');
        sponsoredBillsStatus.classList.remove('loading');
        votesStatus.classList.remove('loading');

        updateDisplay(data); // Update with real data

    } catch (error) {
        console.error("Could not fetch data:", error);

        // Remove loading state and display errors
        committeeStatus.classList.remove('loading');
        sponsoredBillsStatus.classList.remove('loading');
        votesStatus.classList.remove('loading');

        // Display specific errors
        memberDetailsContainer.innerHTML = `<p class="error-message">Error loading details.</p>`;
        displayError(committeeStatus, committeeList, 'Error loading committees.');
        displayError(sponsoredBillsStatus, sponsoredBillsList, 'Error loading bills.');
        displayError(votesStatus, voteList, 'Error loading votes.');
    }
}


// --- Function to update the HTML with fetched data ---
function updateDisplay(data) {
    console.log("Updating display START");

    // Update Member Details section
    console.log("Updating member details...");
    if (data.member_details) {
        let detailsHtml = `
            <strong>Name:</strong> ${data.member_details.name || 'N/A'} <br>
            <strong>State:</strong> ${data.member_details.state || 'N/A'} |
            <strong>Party:</strong> ${data.member_details.party || 'N/A'}
        `;
        if (data.member_details.website_url) {
            // Ensure URL starts with http:// or https:// for safety
             let safeUrl = data.member_details.website_url;
            if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) {
                safeUrl = 'http://' + safeUrl; // Basic fallback, might not always work
            }
            detailsHtml += ` | <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Official Website</a>`;
        }
        memberDetailsContainer.innerHTML = detailsHtml; // Use innerHTML to render link
    } else {
         memberDetailsContainer.innerHTML = '<p>Details not available.</p>';
    }
    console.log("Member details updated.");

    // Update Committee List
    console.log("Updating committees...");
    committeeList.innerHTML = ''; // Ensure clear
    if (data.committees && data.committees.length > 0) {
         try {
            data.committees.forEach(committee => {
                committeeList.appendChild(createCommitteeListItem(committee));
            });
         } catch(e) { console.error("Error processing committees:", e); displayError(committeeStatus, committeeList, 'Error displaying committees.');}
    } else {
        committeeList.innerHTML = '<li>No committee assignments found.</li>';
    }
    console.log("Committees updated.");


    // Update Sponsored Bills List
    console.log("Updating sponsored bills...");
    sponsoredBillsList.innerHTML = ''; // Ensure clear
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


     // Update Vote List
     console.log("Updating votes...");
    voteList.innerHTML = ''; // Ensure clear
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
    // Reset text/HTML and remove any error messages/loading classes
    memberDetailsContainer.innerHTML = '<p>Select a member to view details.</p>'; // Use innerHTML consistently

    committeeStatus.classList.remove('loading');
    committeeList.innerHTML = '<li>Select a member to view committees.</li>';
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
}

// --- Event Listeners Setup ---
if(memberSelect) {
    memberSelect.addEventListener('change', (event) => {
        const memberId = event.target.value;
        if (memberId) {
            fetchData(memberId);
        } else {
            clearData();
        }
    });
} else {
    console.error("Member select dropdown element not found on page load.");
}

if(partyFilters.length > 0) {
    partyFilters.forEach(radio => {
        radio.addEventListener('change', (event) => {
            const selectedParty = event.target.value;
            console.log("Party filter changed to:", selectedParty);
            populateMemberDropdown(selectedParty); // Re-populate dropdown
            clearData(); // Clear displayed member data when filter changes
        });
    });
} else {
    console.warn("Party filter controls not found.");
}

// --- Initial Setup ---
// Ensure this runs after the DOM is ready and 'allMembersData' is defined
document.addEventListener('DOMContentLoaded', (event) => {
    // Check if allMembersData was loaded correctly from the template
    if (typeof allMembersData !== 'undefined' && allMembersData) {
        console.log(`Initial member data loaded in JS: ${allMembersData.length} members`);
        populateMemberDropdown(); // Initial population with "ALL"
    } else {
        console.error("Global 'allMembersData' not found or empty. Cannot populate dropdown initially.");
        // Optionally display an error message near the dropdown
        const container = document.getElementById('member-select-container');
        if (container && !container.querySelector('.error-message')) { // Prevent duplicate errors
            const errorP = document.createElement('p');
            errorP.className = 'error-message'; // Use error style
            errorP.textContent = "Failed to load member list data for dropdown.";
            container.appendChild(errorP);
        }
         if(memberSelect) memberSelect.disabled = true; // Disable dropdown
    }
    clearData(); // Ensure data sections are initially clear/reset
});