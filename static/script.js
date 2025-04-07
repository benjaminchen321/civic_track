// Get references to HTML elements
const memberSelect = document.getElementById('member-select'); // Updated ID
const memberDetailsContainer = document.getElementById('member-details-content'); // New element
const voteList = document.getElementById('vote-list');
// REMOVED chart variables

// Event listener for the dropdown
memberSelect.addEventListener('change', (event) => {
    const memberId = event.target.value; // This is now the bioguideId
    if (memberId) {
        fetchData(memberId);
    } else {
        clearData();
    }
});

// Function to fetch data from the backend API
async function fetchData(memberId) {
    console.log(`Fetching data for ${memberId}...`);
    // Update the API endpoint URL
    const url = `/api/member/${memberId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Data received:", data);
        updateDisplay(data);
    } catch (error) {
        console.error("Could not fetch data:", error);
        memberDetailsContainer.textContent = 'Error loading details.'; // Update error display
        voteList.innerHTML = '<li>Error loading votes.</li>';
        // REMOVED chart clearing
    }
}

// Function to update the HTML with fetched data
function updateDisplay(data) {
    // Update Member Details section
    if (data.member_details) {
        memberDetailsContainer.textContent = `Name: ${data.member_details.name || 'N/A'} | State: ${data.member_details.state || 'N/A'} | Party: ${data.member_details.party || 'N/A'}`;
        // Add more details as needed
    } else {
        memberDetailsContainer.textContent = 'Details not available.';
    }

    // --- REMOVED Chart Drawing Logic ---

    // Update Vote List
    voteList.innerHTML = ''; // Clear previous list
    if (data.votes && data.votes.length > 0) {
        data.votes.forEach(vote => {
            const listItem = document.createElement('li');
            // Adjust text content based on the fields returned by your get_member_votes function
            listItem.textContent = `[${vote.vote || 'N/A'}] ${vote.description || 'No Description'} (Roll Call: ${vote.roll_call || 'N/A'}, Date: ${vote.vote_date || 'N/A'}, Bill: ${vote.bill_id || 'N/A'})`;
            voteList.appendChild(listItem);
        });
    } else {
        voteList.innerHTML = '<li>No recent votes found or processed.</li>';
    }
}

// Function to clear the display
function clearData() {
    memberDetailsContainer.textContent = 'Select a member to view details.';
    voteList.innerHTML = '<li>Select a member to view votes.</li>';
    // REMOVED chart clearing
}

// Initial clear state
clearData();