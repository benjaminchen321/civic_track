import os
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
    print("Attempting to execute load_congress_members...")  # Log start of attempt
    members_data = {}
    if not CONGRESS_GOV_API_KEY:
        print(
            "CRITICAL WARNING: Congress.gov API Key not set. Cannot load member list."
        )
        return members_data  # Return empty if no key

    limit = 250
    url = f"https://api.congress.gov/v3/member?limit={limit}&api_key={CONGRESS_GOV_API_KEY}"
    print(f"Fetching member list from Congress.gov: {url}")

    try:
        print(
            "Executing load_congress_members API call (Cache miss or expired)"
        )  # Log actual execution
        response = requests.get(url)
        response.raise_for_status()  # Check for HTTP errors (4xx, 5xx)
        data = response.json()

        if "members" in data:
            members = data["members"]
            print(f"Successfully fetched {len(members)} members.")
            for member in members:
                bioguide_id = member.get("bioguideId")
                if bioguide_id:
                    members_data[bioguide_id] = {
                        "name": member.get("name", "Unknown Name"),  # Provide default
                        "bioguide_id": bioguide_id,
                        "state": member.get("state"),
                        "party": member.get("partyName"),
                        "terms": member.get("terms"),
                    }
        else:
            print(
                f"Warning: Congress.gov API did not return 'members' key. Response: {data}"
            )

    except requests.exceptions.RequestException as e:
        print(f"CRITICAL ERROR fetching Congress.gov member list: {e}")
    except Exception as e:  # Catch other potential errors like JSONDecodeError
        print(f"CRITICAL ERROR processing member list: {e}")

    if not members_data:
        print("Warning: Failed to load any member data. MEMBERS_DATA will be empty.")

    return members_data


@cache.memoize(timeout=3600)  # Cache committee data per member for 1 hour
def get_member_committees(bioguide_id):
    """Fetches committee assignments for a member."""
    # ... (function content remains the same as previous version) ...
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


@cache.memoize(timeout=1800)  # Cache sponsored bills per member for 30 mins
def get_sponsored_bills(bioguide_id):
    """Fetches recent bills sponsored by a member."""
    # ... (function content remains the same as previous version) ...
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


# Note: get_member_votes might need significant debugging based on API structure
# We are keeping the previous version here for completeness
def get_member_votes(bioguide_id):
    """Fetches recent votes for a member using their bioguideId."""
    # ... (function content remains the same as previous version) ...
    if not CONGRESS_GOV_API_KEY:
        print("Error: Congress.gov API Key not set for votes.")
        return []
    limit = 10
    chamber = "senate"  # Might need adjustment based on member's chamber
    congress = "118"  # Might need adjustment
    session = "1"  # Might need adjustment
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
                # Hypothetical structure check - needs validation against actual API response
                members_section = vote.get("members")  # Example path
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
                # More robust check needed ^^^ based on actual data

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
# Critical: This call populates the data used by the index route
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
    # Convert dictionary values to a list for the template
    # Sort alphabetically by name for the dropdown
    # Ensure MEMBERS_DATA is accessed correctly
    try:
        member_list = (
            sorted(
                list(MEMBERS_DATA.values()),
                key=lambda m: m.get("name", "ZZZ"),  # Sort unnamed last
            )
            if MEMBERS_DATA
            else []
        )  # Handle case where MEMBERS_DATA is empty
        print(f"Passing {len(member_list)} members to template.")
    except Exception as e:
        print(f"Error processing MEMBERS_DATA for index route: {e}")
        member_list = []  # Pass empty list on error

    # Ensure the variable name 'members' matches the template {% for member in members %}
    return render_template("index.html", members=member_list)


@app.route("/api/member/<bioguide_id>")
def get_member_data(bioguide_id):
    """API endpoint to get legislative data for a specific member."""
    print(f"API call received for member: {bioguide_id}")
    member_info = MEMBERS_DATA.get(bioguide_id)

    if not member_info:
        print(f"Member info not found in MEMBERS_DATA for Bioguide ID: {bioguide_id}")
        return jsonify({"error": "Member info not found"}), 404

    # Fetch data using helper functions
    # Note: These calls might be slow if not cached
    committee_data = get_member_committees(bioguide_id)
    sponsored_bills_data = get_sponsored_bills(bioguide_id)
    vote_data = get_member_votes(bioguide_id)

    combined_data = {
        "member_details": {
            "name": member_info.get("name"),
            "state": member_info.get("state"),
            "party": member_info.get("party"),
        },
        "votes": vote_data,
        "committees": committee_data,
        "sponsored_bills": sponsored_bills_data,
    }
    return jsonify(combined_data)


# --- End Flask Routes ---


if __name__ == "__main__":
    # Set debug=False if deploying to production via gunicorn later
    app.run(debug=True)
