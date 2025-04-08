import os
import json  # <-- Added json import
import requests
from flask import Flask, jsonify, render_template
from flask_caching import Cache

app = Flask(__name__)

# --- Cache Configuration ---
cache_config = {
    "CACHE_TYPE": "FileSystemCache",
    "CACHE_DIR": "flask_cache",
    "CACHE_DEFAULT_TIMEOUT": 3600,  # Default cache time: 1 hour (in seconds)
}
app.config.from_mapping(cache_config)
cache = Cache(app)
# --- End Cache Configuration ---

# Load API Key from environment variable
CONGRESS_GOV_API_KEY = os.environ.get("CONGRESS_GOV_API_KEY")


# --- Helper Functions ---


@cache.memoize(timeout=43200)  # Cache member list for 12 hours
def load_congress_members():
    """
    Fetches a list of current Members from the Congress.gov API /member endpoint.
    Returns a dictionary mapping member ID (bioguideId) to member info.
    (Cached on startup)
    """
    print("Attempting to execute load_congress_members...")
    members_data = {}
    if not CONGRESS_GOV_API_KEY:
        print(
            "CRITICAL WARNING: Congress.gov API Key not set. Cannot load member list."
        )
        return members_data

    limit = 250
    # Ensure you are using the correct endpoint and parameters for your API version
    url = f"https://api.congress.gov/v3/member?limit={limit}&api_key={CONGRESS_GOV_API_KEY}"
    print(f"Fetching member list from Congress.gov: {url}")

    try:
        print("Executing load_congress_members API call (Cache miss or expired)")
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        if "members" in data:
            members = data["members"]
            print(f"Successfully fetched {len(members)} members.")
            for member in members:
                bioguide_id = member.get("bioguideId")
                if bioguide_id:
                    # Capture website URL if available (check actual field name in API response)
                    website_url = member.get(
                        "directUrl"
                    )  # Assumes 'directUrl' field name

                    members_data[bioguide_id] = {
                        "name": member.get("name", "Unknown Name"),
                        "bioguide_id": bioguide_id,
                        "state": member.get("state"),
                        "party": member.get("partyName"),
                        "terms": member.get("terms"),
                        "website_url": website_url,  # <-- Added website URL
                    }
        else:
            print(
                f"Warning: Congress.gov API did not return 'members' key. Response: {data}"
            )

    except requests.exceptions.RequestException as e:
        print(f"CRITICAL ERROR fetching Congress.gov member list: {e}")
    except Exception as e:
        print(f"CRITICAL ERROR processing member list: {e}")

    if not members_data:
        print("Warning: Failed to load any member data. MEMBERS_DATA will be empty.")

    return members_data


# --- Functions get_member_committees, get_sponsored_bills, get_member_votes ---
# These function definitions remain unchanged from the previous version where they were added
# Ensure they are still present here.
# Example placeholder for brevity:
@cache.memoize(timeout=3600)
def get_member_committees(bioguide_id):
    # ... (Full function code from previous step) ...
    committees = []
    if not CONGRESS_GOV_API_KEY:
        print("Error: Congress.gov API Key not set for committees.")
        return committees
    url = f"https://api.congress.gov/v3/member/{bioguide_id}/committee-assignments?api_key={CONGRESS_GOV_API_KEY}"
    print(f"Fetching committee assignments for {bioguide_id} from {url}")
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        if "committeeAssignments" in data:
            print(
                f"Received {len(data['committeeAssignments'])} committee assignments."
            )
            for assignment in data["committeeAssignments"]:
                committee_info = assignment.get("committee", {})
                committees.append(
                    {
                        "name": committee_info.get("name", "Unknown Committee"),
                    }
                )
        else:
            print(f"No 'committeeAssignments' key found in response for {bioguide_id}.")
    except requests.exceptions.RequestException as e:
        print(f"Error fetching committees for {bioguide_id}: {e}")
    except Exception as e:
        print(f"Unexpected error processing committees for {bioguide_id}: {e}")
    return committees


@cache.memoize(timeout=1800)
def get_sponsored_bills(bioguide_id):
    # ... (Full function code from previous step) ...
    bills = []
    if not CONGRESS_GOV_API_KEY:
        print("Error: Congress.gov API Key not set for bills.")
        return bills
    limit = 5
    url = f"https://api.congress.gov/v3/bill?sponsorBioguideId={bioguide_id}&sort=updateDate+desc&limit={limit}&api_key={CONGRESS_GOV_API_KEY}"
    print(f"Fetching sponsored bills for {bioguide_id} from {url}")
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        if "bills" in data:
            print(f"Received {len(data['bills'])} sponsored bills for {bioguide_id}.")
            for bill in data["bills"]:
                bills.append(
                    {
                        "number": bill.get("number"),
                        "type": bill.get("type"),
                        "title": bill.get("title"),
                        "latest_action_text": bill.get("latestAction", {}).get("text"),
                        "latest_action_date": bill.get("latestAction", {}).get(
                            "actionDate"
                        ),
                        "congress": bill.get("congress"),
                    }
                )
        else:
            print(
                f"No 'bills' key found in sponsored bills response for {bioguide_id}."
            )
    except requests.exceptions.RequestException as e:
        print(f"Error fetching sponsored bills for {bioguide_id}: {e}")
    except Exception as e:
        print(f"Unexpected error processing sponsored bills for {bioguide_id}: {e}")
    return bills


def get_member_votes(bioguide_id):
    # ... (Full function code from previous step, including potential need for debugging/refining based on API response) ...
    if not CONGRESS_GOV_API_KEY:
        print("Error: Congress.gov API Key not set for votes.")
        return []
    limit = 10
    chamber = "senate"
    congress = "118"
    session = "1"
    url = f"https://api.congress.gov/v3/recorded-vote/{chamber}?congress={congress}&sessionNumber={session}&limit={limit}&api_key={CONGRESS_GOV_API_KEY}"
    print(f"Attempting to fetch recent votes: {url}")
    member_votes_processed = []
    try:
        response = requests.get(url)
        response.raise_for_status()
        vote_data = response.json()
        if "votes" in vote_data:
            print(
                f"Processing {len(vote_data['votes'])} recent votes for member {bioguide_id} participation..."
            )
            for vote in vote_data["votes"]:
                member_position = "Not Recorded"
                members_section = vote.get("members")
                if (
                    members_section
                    and isinstance(members_section, dict)
                    and "memberPositions" in members_section
                ):
                    if isinstance(members_section["memberPositions"], list):
                        for position_info in members_section["memberPositions"]:
                            if (
                                isinstance(position_info, dict)
                                and position_info.get("bioguideId") == bioguide_id
                            ):
                                member_position = position_info.get(
                                    "votePosition", "Unknown"
                                )
                                break
                vote_info = vote.get("voteInformation", {})
                bill_info = vote.get("bill", {})
                member_votes_processed.append(
                    {
                        "bill_id": f"{bill_info.get('type', '')}{bill_info.get('number', '')}",
                        "vote": member_position,
                        "description": vote_info.get(
                            "voteQuestionText", "No Description"
                        ),
                        "vote_date": vote_info.get("voteTimestamp", "N/A"),
                        "roll_call": vote_info.get("rollCallNumber", "N/A"),
                    }
                )
            print(f"Finished vote processing for member {bioguide_id}.")
        else:
            print(f"No 'votes' key found in recent votes response at {url}")
        return member_votes_processed[:5]
    except requests.exceptions.RequestException as e:
        print(f"Error fetching/processing votes for {bioguide_id}: {e}")
        return []
    except Exception as e:
        print(f"Unexpected error processing votes for {bioguide_id}: {e}")
        return []


# --- End Helper Functions ---


# --- Load Member Data ONCE on startup ---
MEMBERS_DATA = load_congress_members()
if not MEMBERS_DATA:
    print(
        "FATAL WARNING: MEMBERS_DATA is empty after startup load. Dropdown will be empty."
    )
else:
    print(f"Loaded {len(MEMBERS_DATA)} members into MEMBERS_DATA.")
# --- ---


# --- Flask Routes ---
@app.route("/")
def index():
    """Serves the main HTML page."""
    print("Serving index page...")
    all_members_dict = MEMBERS_DATA if MEMBERS_DATA else {}

    # Convert dictionary values to a list of member objects for JSON serialization
    all_members_list = list(all_members_dict.values())

    # Use json.dumps for safe JSON serialization for embedding in HTML
    try:
        all_members_json_string = json.dumps(all_members_list)
        print(f"Passing {len(all_members_list)} members as JSON to template.")
    except TypeError as e:
        print(f"Error serializing member data to JSON: {e}")
        all_members_json_string = "[]"  # Pass empty list as fallback

    return render_template(
        "index.html",
        # We are not looping in the template anymore, JS handles population
        all_members_json=all_members_json_string,  # Pass JSON string
    )


@app.route("/api/member/<bioguide_id>")
def get_member_data(bioguide_id):
    """API endpoint to get legislative data for a specific member."""
    print(f"API call received for member: {bioguide_id}")
    member_info = MEMBERS_DATA.get(bioguide_id)

    if not member_info:
        print(f"Member info not found in MEMBERS_DATA for Bioguide ID: {bioguide_id}")
        return jsonify({"error": "Member info not found"}), 404

    # Fetch data using helper functions
    committee_data = get_member_committees(bioguide_id)
    sponsored_bills_data = get_sponsored_bills(bioguide_id)
    vote_data = get_member_votes(bioguide_id)

    combined_data = {
        "member_details": {
            "name": member_info.get("name"),
            "state": member_info.get("state"),
            "party": member_info.get("party"),
            "website_url": member_info.get("website_url"),  # <-- Include website URL
        },
        "votes": vote_data,
        "committees": committee_data,
        "sponsored_bills": sponsored_bills_data,
    }
    return jsonify(combined_data)


# --- End Flask Routes ---

if __name__ == "__main__":
    app.run(debug=True)
