import os

import requests
from flask import Flask, jsonify, render_template

app = Flask(__name__)

# Load API Keys from environment variables
CONGRESS_GOV_API_KEY = os.environ.get('CONGRESS_GOV_API_KEY')


def load_congress_members():
    """
    Fetches a list of current Senators from the Congress.gov API /member endpoint.
    Returns a dictionary mapping member ID (bioguideId) to member info.
    """
    members_data = {}
    if not CONGRESS_GOV_API_KEY:
        print("Warning: Congress.gov API Key not set. Cannot load member list.")
        return members_data

    # Congress.gov API uses bioguideId which is unique across House/Senate.
    # We can filter later if needed, but let's get all current members first.
    # The API is paginated, default limit might be 250. Check docs if >250 members needed.
    # Let's start with a reasonable limit for now. Max is often 250 per page.
    limit = 250
    url = f"https://api.congress.gov/v3/member?limit={limit}&api_key={CONGRESS_GOV_API_KEY}"
    print(f"Attempting to fetch member list from Congress.gov: {url}")

    try:
        response = requests.get(url)
        response.raise_for_status()  # Check for HTTP errors
        data = response.json()

        if 'members' in data:
            members = data['members']
            print(f"Successfully fetched {len(members)} members.")
            for member in members:
                # Use bioguideId as the unique key
                bioguide_id = member.get('bioguideId')
                if bioguide_id:
                    # Extract relevant info (adjust fields based on API response)
                    members_data[bioguide_id] = {
                        "name": member.get('name'),
                        "bioguide_id": bioguide_id,
                        "state": member.get('state'),
                        "party": member.get('partyName'),
                        "terms": member.get('terms')  # Terms might contain chamber info
                        # Add other fields you find useful from the response
                    }
        else:
            print(f"Congress.gov API did not return 'members' key. Response: {data}")

    except requests.exceptions.RequestException as e:
        print(f"Error fetching Congress.gov member list: {e}")
    except KeyError as e:
        print(f"Error parsing Congress.gov member list response (KeyError): {e}")
    except Exception as e:
        print(f"Unexpected error loading member data: {e}")

    if not members_data:
        print("Warning: Failed to load any member data.")

    # Optional: Filter for only current Senators if needed
    # You'd check the 'terms' data for each member for current Senate term
    # For simplicity now, we load all members returned by the basic call.

    return members_data


def get_member_votes(bioguide_id):
    """Fetches recent votes for a member using their bioguideId."""
    if not CONGRESS_GOV_API_KEY:
        print("Error: Congress.gov API Key not set.")
        return []

    # The Congress.gov API structure for votes per member might differ.
    # Check the API documentation for the best endpoint.
    # Example assuming an endpoint exists like this (Adapt based on actual docs!):
    # Let's try fetching recent votes generally and filter later,
    # or use a specific member vote endpoint if available.
    # A common pattern is /v3/vote/{chamber}/{congress}/{session}/roll-call/{roll-call-number}
    # Getting votes *by member* might require a different approach or parsing all recent votes.

    # --- Alternative approach: Get recent votes and see if member participated ---
    # This is less direct but sometimes necessary if a direct member-vote endpoint isn't simple.
    # Let's try fetching recent Senate votes (example: 118th Congress, 1st Session)
    # YOU WILL NEED TO ADJUST congress/session/chamber PARAMETERS based on current time
    # and check the real API structure. This is a placeholder structure.
    limit = 10  # Get last 10 Senate votes
    chamber = "senate"
    congress = "118"
    session = "1"  # This might change!

    # Placeholder URL - Check Congress.gov docs for the real endpoint for recent votes!
    # It might be /v3/vote/senate?limit=... or similar
    url = f"https://api.congress.gov/v3/recorded-vote/{chamber}?congress={congress}&sessionNumber={session}&limit={limit}&api_key={CONGRESS_GOV_API_KEY}"
    print(f"Attempting to fetch recent votes: {url}")  # Adjust URL based on docs

    member_votes_processed = []
    try:
        response = requests.get(url)
        response.raise_for_status()
        vote_data = response.json()

        if 'votes' in vote_data:  # Assuming the key is 'votes'
            print(f"Processing {len(vote_data['votes'])} recent votes...")
            for vote in vote_data['votes']:
                # Now, need to see if THIS member participated and how they voted.
                # The structure here is HYPOTHETICAL - check the real API response!
                member_position = "Not Recorded"  # Default

                # Check within the vote data for member positions (this structure WILL vary)
                if 'members' in vote and 'memberPositions' in vote['members']:
                    for position_info in vote['members']['memberPositions']:
                        if position_info.get('bioguideId') == bioguide_id:
                            member_position = position_info.get('votePosition', 'Unknown')
                            break  # Found the member's vote

                # Extract vote details (again, structure depends on API response)
                vote_info = vote.get('voteInformation', {})
                bill_info = vote.get('bill', {})
                member_votes_processed.append({
                    "bill_id": f"{bill_info.get('type', '')}{bill_info.get('number', '')}",
                    "vote": member_position,
                    "description": vote_info.get('voteQuestionText', 'No Description'),
                    "vote_date": vote_info.get('voteTimestamp', 'N/A'),
                    "roll_call": vote_info.get('rollCallNumber', 'N/A')
                })
            print(f"Finished processing votes for member {bioguide_id}.")
        else:
            print("No 'votes' key found in recent votes response.")

        # Return only the latest 5 for simplicity
        return member_votes_processed[:5]

    except requests.exceptions.RequestException as e:
        print(f"Error fetching/processing votes: {e}")
        return []
    except Exception as e:
        print(f"Unexpected error processing votes: {e}")
        return []


# --- Load Member Data ONCE on startup ---
MEMBERS_DATA = load_congress_members()
# --- ---


@app.route('/')
def index():
    """Serves the main HTML page."""
    # Use the dynamically loaded MEMBERS_DATA
    member_list = sorted(list(MEMBERS_DATA.values()), key=lambda m: m.get('name', ''))
    return render_template('index.html', members=member_list)  # Pass as 'members'


# Use bioguide_id in the route
@app.route('/api/member/<bioguide_id>')
def get_member_data(bioguide_id):
    """API endpoint to get legislative data for a specific member."""

    # Look up member using bioguide_id
    member_info = MEMBERS_DATA.get(bioguide_id)

    if not member_info:
        print(f"Member info not found for Bioguide ID: {bioguide_id}")
        return jsonify({"error": "Member info not found"}), 404

    print(f"Fetching vote data for {member_info.get('name')} (Bioguide: {bioguide_id})")

    # Fetch vote data using the helper function
    vote_data = get_member_votes(bioguide_id)

    # --- REMOVED DONOR DATA ---

    # Combine data for the frontend
    # Include basic member info along with votes
    combined_data = {
        "member_details": {
            "name": member_info.get('name'),
            "state": member_info.get('state'),
            "party": member_info.get('party'),
            # Add any other details from MEMBERS_DATA you want to show
        },
        "votes": vote_data
    }

    return jsonify(combined_data)


if __name__ == "__main__":
    app.run(debug=True)  # Debug mode is helpful for development
