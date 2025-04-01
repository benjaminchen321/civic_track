const senatorSelect = document.getElementById('senator-select');
const donorChartContainer = document.getElementById('donor-chart-container');
const voteList = document.getElementById('vote-list');
const donorChartElement = document.getElementById('donorChart').getContext('2d');
let currentChart = null; // To hold the chart instance

senatorSelect.addEventListener('change', (event) => {
    const senatorId = event.target.value;
    if (senatorId) {
        fetchData(senatorId);
    } else {
        // Clear data if default option selected
        clearData();
    }
});

async function fetchData(senatorId) {
    console.log(`Fetching data for ${senatorId}...`);
    try {
        const response = await fetch(`/api/senator/${senatorId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Data received:", data);
        updateDisplay(data);
    } catch (error) {
        console.error("Could not fetch data:", error);
        voteList.innerHTML = '<li>Error loading data.</li>';
        if (currentChart) {
           currentChart.destroy(); // Clear previous chart on error
           currentChart = null;
        }
    }
}

function updateDisplay(data) {
    // Update Donor Chart
    const labels = data.donors.map(d => d.industry);
    const amounts = data.donors.map(d => d.amount);

    if (currentChart) {
        currentChart.destroy(); // Destroy previous chart before drawing new one
    }
    currentChart = new Chart(donorChartElement, {
        type: 'bar', // Bar chart for donors
        data: {
            labels: labels,
            datasets: [{
                label: 'Contribution Amount ($)',
                data: amounts,
                backgroundColor: 'rgba(75, 192, 192, 0.6)', // Teal color
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Update Vote List
    voteList.innerHTML = ''; // Clear previous list
    if (data.votes.length > 0) {
        data.votes.forEach(vote => {
            const listItem = document.createElement('li');
            listItem.textContent = `[${vote.vote}] ${vote.description} (Bill: ${vote.bill_id})`;
            voteList.appendChild(listItem);
        });
    } else {
        voteList.innerHTML = '<li>No recent votes found.</li>';
    }
}

function clearData() {
     if (currentChart) {
        currentChart.destroy();
        currentChart = null;
     }
     voteList.innerHTML = '<li>Select a senator to view data.</li>';
}

// Initial clear state
clearData();