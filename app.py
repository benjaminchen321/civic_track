from flask import Flask, render_template, jsonify

app = Flask(__name__)

# --- Mock Data ---
# In a real app, this would come from a database/API calls
SENATORS = {
    "senator_a": {"name": "Senator Alex Adams", "id": "senator_a"},
    "senator_b": {"name": "Senator Brenda Blue", "id": "senator_b"}
}

MOCK_DATA = {
    "senator_a": {
        "donors": [
            {"industry": "Finance", "amount": 50000},
            {"industry": "Healthcare", "amount": 35000},
            {"industry": "Tech", "amount": 30000},
        ],
        "votes": [
            {
                "bill_id": "HB001",
                "vote": "Yea",
                "description": "Infrastructure Bill"
            },
            {
                "bill_id": "SB002",
                "vote": "Nay",
                "description": "Energy Regulation Act"
            },
            {
                "bill_id": "HB003",
                "vote": "Yea",
                "description": "Tech Privacy Law"
            },
        ]
    },
    "senator_b": {
        "donors": [
            {"industry": "Energy", "amount": 60000},
            {"industry": "Agriculture", "amount": 40000},
            {"industry": "Finance", "amount": 25000},
        ],
        "votes": [
            {
                "bill_id": "HB001",
                "vote": "Nay",
                "description": "Infrastructure Bill"
            },
            {
                "bill_id": "SB002",
                "vote": "Yea",
                "description": "Energy Regulation Act"
            },
            {
                "bill_id": "HB003",
                "vote": "Nay",
                "description": "Tech Privacy Law"
            },
        ]
    }
}
# --- End Mock Data ---


@app.route('/')
def index():
    """Serves the main HTML page."""
    senator_list = list(SENATORS.values())  # Pass list of senators to template
    return render_template('index.html', senators=senator_list)


@app.route('/api/senator/<senator_id>')
def get_senator_data(senator_id):
    """API endpoint to get data for a specific senator."""
    data = MOCK_DATA.get(senator_id)
    if data:
        return jsonify(data)
    else:
        return jsonify({"error": "Senator not found"}), 404


if __name__ == '__main__':
    app.run(debug=True)  # Debug mode is helpful for development