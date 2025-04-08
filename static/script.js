// Get references to HTML elements
const memberSelect = document.getElementById('member-select');
const memberDetailsContainer = document.getElementById('member-details-content');
const committeeList = document.getElementById('committee-list');
const sponsoredBillsList = document.getElementById('sponsored-bills-list');
const voteList = document.getElementById('vote-list');

// Event listener for the dropdown
memberSelect.addEventListener('change', (event) => {
    const memberId = event.target.value; // This is the bioguideId
    if (memberId) {
        fetchData(memberId); // Call fetchData when an option is selected
    } else {
        clearData(); // Clear if the default option is selected
    }
});

// Function to fetch data from the backend API
async function fetchData(memberId) {
    console.log(`Fetching data for ${memberId}...`); // Should see this in browser console now

    // ---> START: Show loading state <---
    memberDetailsContainer.textContent = 'Loading details...';
    committeeList.innerHTML = '<li>Loading committees...</li>';
    sponsoredBillsList.innerHTML = '<li>Loading sponsored bills...</li>';
    voteList.innerHTML = '<li>Loading votes...</li>';
    // ---> END: Show loading state <---

    // Construct the API endpoint URL
    const url = `/api/member/${memberId}`;
    try {
        const response = await fetch(url); // Perform the actual fetch
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Data received:", data); // Should see backend response
        updateDisplay(data); // Update the UI with received data
    } catch (error) {
        console.error("Could not fetch data:", error);
        // Display error messages (replaces loading message)
        memberDetailsContainer.textContent = 'Error loading details.';
        committeeList.innerHTML = '<li>Error loading committees.</li>';
        sponsoredBillsList.innerHTML = '<li>Error loading bills.</li>';
        voteList.innerHTML = '<li>Error loading votes.</li>';
    }
}

// Function to update the HTML with fetched data
function updateDisplay(data) {
    console.log("Updating display START"); // <-- Log start

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
    committeeList.innerHTML = ''; // Clear previous list
    if (data.committees && data.committees.length > 0) {
        try { // Add try...catch around loops for robustness
            data.committees.forEach(committee => {
                const listItem = document.createElement('li');
                listItem.textContent = committee.name || 'N/A';
                committeeList.appendChild(listItem);
            });
        } catch(e) { console.error("Error processing committees:", e); committeeList.innerHTML = '<li>Error displaying committees.</li>';}
    } else {
        committeeList.innerHTML = '<li>No committee assignments found.</li>';
    }
    console.log("Committees updated.");

    // Update Sponsored Bills List
    console.log("Updating sponsored bills...");
    sponsoredBillsList.innerHTML = ''; // Clear previous list
    if (data.sponsored_bills && data.sponsored_bills.length > 0) {

        // Bill Type to URL Path Mapping
        const billTypePaths = {
            'S': 'senate-bill',
            'HR': 'house-bill',
            'HRES': 'house-resolution',
            'SRES': 'senate-resolution',
            'HJRES': 'house-joint-resolution',
            'SJRES': 'senate-joint-resolution',
            'HCONRES': 'house-concurrent-resolution',
            'SCONRES': 'senate-concurrent-resolution'
            // Add more mappings if needed based on API data
        };

        try { // Add try...catch
            data.sponsored_bills.forEach(bill => {
                const listItem = document.createElement('li');
                const billNum = `${bill.type || ''}${bill.number || ''}`;
                const billCongress = bill.congress;
                const billType = bill.type; // Get the type from API data

                const billLink = document.createElement('a');

                // Use mapping for URL
                const urlPathSegment = billTypePaths[billType]; // Look up the path segment

                if(billNum && billCongress && billType && urlPathSegment && bill.number) {
                    // Construct URL using the mapped path segment
                    billLink.href = `https://www.congress.gov/bill/${billCongress}th-congress/${urlPathSegment}/${bill.number}`;
                    billLink.textContent = billNum;
                    billLink.target = "_blank";
                } else {
                    console.warn(`Could not form link for bill: ${billNum} (Type: ${billType}, Congress: ${billCongress})`);
                    billLink.textContent = billNum || 'N/A'; // Fallback if link cannot be formed
                }

                listItem.appendChild(billLink);
                listItem.appendChild(document.createTextNode(`: ${bill.title || 'No Title'} (Latest Action: ${bill.latest_action_text || 'N/A'} on ${bill.latest_action_date || 'N/A'})`));
                sponsoredBillsList.appendChild(listItem);
            });
        } catch(e) { console.error("Error processing sponsored bills:", e); sponsoredBillsList.innerHTML = '<li>Error displaying bills.</li>';}
    } else {
        sponsoredBillsList.innerHTML = '<li>No recently sponsored bills found.</li>';
    }
    console.log("Sponsored bills updated.");


    // Update Vote List
    console.log("Updating votes...");
    voteList.innerHTML = ''; // Clear previous list
    if (data.votes && data.votes.length > 0) {
        try { // Add try...catch
            data.votes.forEach(vote => {
                const listItem = document.createElement('li');
                const billText = `Bill: ${vote.bill_id || 'N/A'}`;
                listItem.textContent = `[${vote.vote || 'N/A'}] ${vote.description || 'No Description'} (${billText}, Roll Call: ${vote.roll_call || 'N/A'}, Date: ${vote.vote_date || 'N/A'})`;
                voteList.appendChild(listItem);
            });
        } catch(e) { console.error("Error processing votes:", e); voteList.innerHTML = '<li>Error displaying votes.</li>';}
    } else {
        voteList.innerHTML = '<li>No recent votes found or processed.</li>';
    }
    console.log("Votes updated.");

    console.log("Updating display END"); // <-- Log end
}

// Function to clear the display
function clearData() {
    memberDetailsContainer.textContent = 'Select a member to view details.';
    committeeList.innerHTML = '<li>Select a member to view committees.</li>';
    sponsoredBillsList.innerHTML = '<li>Select a member to view sponsored bills.</li>';
    voteList.innerHTML = '<li>Select a member to view votes.</li>';
}

// Initial clear state
clearData();