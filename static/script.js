// Get references to HTML elements
const memberSelect = document.getElementById('member-select');
const memberDetailsContainer = document.getElementById('member-details-content');
const committeeList = document.getElementById('committee-list');
const sponsoredBillsList = document.getElementById('sponsored-bills-list');
const voteList = document.getElementById('vote-list');
// Status elements for loading/error/aria
const memberStatus = document.getElementById('member-status'); // Used indirectly via memberDetailsContainer
const committeeStatus = document.getElementById('committee-status');
const sponsoredBillsStatus = document.getElementById('sponsored-bills-status');
const votesStatus = document.getElementById('votes-status');

// --- Helper functions for creating list items ---
function createCommitteeListItem(committee) {
    const listItem = document.createElement('li');
    listItem.textContent = committee.name || 'N/A';
    return listItem;
}

// Make mapping accessible globally or pass it around
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
    listItem.textContent = `[${vote.vote || 'N/A'}] ${vote.description || 'No Description'} (${billText}, Roll Call: ${vote.roll_call || 'N/A'}, Date: ${vote.vote_date || 'N/A'})`;
    return listItem;
}
 // --- End Helper functions ---


// Event listener for the dropdown
memberSelect.addEventListener('change', (event) => {
    const memberId = event.target.value; // This is the bioguideId
    if (memberId) {
        fetchData(memberId); // Call fetchData when an option is selected
    } else {
        clearData(); // Clear if the default option is selected
    }
});

// Function to display error messages within status divs
function displayError(statusElement, listElement, message) {
    if (listElement) listElement.innerHTML = ''; // Clear the list content
    if (statusElement) {
        statusElement.innerHTML = `<p class="error-message">${message}</p>`; // Use the error class
    }
}

// Function to fetch data from the backend API
async function fetchData(memberId) {
    console.log(`Fetching data for ${memberId}...`);

    // ---> START: Show loading state using CSS class <---
    memberDetailsContainer.textContent = 'Loading details...'; // Keep simple text update
    committeeStatus.classList.add('loading');
    sponsoredBillsStatus.classList.add('loading');
    votesStatus.classList.add('loading');
    // Clear previous list content *before* showing loader visually
    committeeList.innerHTML = '';
    sponsoredBillsList.innerHTML = '';
    voteList.innerHTML = '';
    // Remove potential error messages from previous attempts
    const committeeError = committeeStatus.querySelector('.error-message');
    if (committeeError) committeeError.remove();
    const billsError = sponsoredBillsStatus.querySelector('.error-message');
    if (billsError) billsError.remove();
    const votesError = votesStatus.querySelector('.error-message');
    if (votesError) votesError.remove();
    // ---> END: Show loading state <---


    const url = `/api/member/${memberId}`;
    try {
        const response = await fetch(url); // Perform the actual fetch
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Data received:", data);

         // ---> START: Remove loading state before updating <---
        committeeStatus.classList.remove('loading');
        sponsoredBillsStatus.classList.remove('loading');
        votesStatus.classList.remove('loading');
         // ---> END: Remove loading state <---

        updateDisplay(data); // Update with real data

    } catch (error) {
        console.error("Could not fetch data:", error);

        // ---> START: Remove loading state and display errors <---
        committeeStatus.classList.remove('loading');
        sponsoredBillsStatus.classList.remove('loading');
        votesStatus.classList.remove('loading');

        // Display specific errors in their sections
        memberDetailsContainer.textContent = 'Error loading details.';
        displayError(committeeStatus, committeeList, 'Error loading committees.'); // Use error display func
        displayError(sponsoredBillsStatus, sponsoredBillsList, 'Error loading bills.');
        displayError(votesStatus, voteList, 'Error loading votes.');
         // ---> END: Remove loading state and display errors <---
    }
}

// Function to update the HTML with fetched data
function updateDisplay(data) {
    console.log("Updating display START");

    // Update Member Details section
    console.log("Updating member details...");
    if (data.member_details) {
        memberDetailsContainer.textContent = `Name: ${data.member_details.name || 'N/A'} | State: ${data.member_details.state || 'N/A'} | Party: ${data.member_details.party || 'N/A'}`;
    } else {
        memberDetailsContainer.textContent = 'Details not available.';
    }
    console.log("Member details updated.");

    // Update Committee List
    console.log("Updating committees...");
    committeeList.innerHTML = ''; // Ensure list is clear before populating
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
    sponsoredBillsList.innerHTML = ''; // Ensure list is clear before populating
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
    voteList.innerHTML = ''; // Ensure list is clear before populating
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


// Function to clear the display
function clearData() {
    console.log("Clearing display data.");
    // Reset text and remove any error messages/loading classes
    memberDetailsContainer.textContent = 'Select a member to view details.';

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

// Initial clear state
clearData();