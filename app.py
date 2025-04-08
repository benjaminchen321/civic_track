import os
import json  # Ensure json is imported
import requests
from flask import Flask, jsonify, render_template
from flask_caching import Cache

app = Flask(__name__)

# --- Cache Configuration ---
cache_config = {
    "CACHE_TYPE": "FileSystemCache",
    "CACHE_DIR": "flask_cache",
    "CACHE_DEFAULT_TIMEOUT": 3600,
}
app.config.from_mapping(cache_config)
cache = Cache(app)
# --- End Cache Configuration ---

# Load API Key
CONGRESS_GOV_API_KEY = os.environ.get("CONGRESS_GOV_API_KEY")


# --- Helper Functions ---


@cache.memoize(timeout=43200)
def load_congress_members():
    """Fetches Member list, including website URL if available."""
    print("Attempting to execute load_congress_members...")
    members_data = {}
    if not CONGRESS_GOV_API_KEY:
        print("CRITICAL WARNING: Congress.gov API Key not set.")
        return members_data

    limit = 250
    url = f"https://api.congress.gov/v3/member?limit={limit}&api_key={CONGRESS_GOV_API_KEY}"
    print(f"Fetching member list from Congress.gov: {url}")

    try:
        print("Executing load_congress_members API call (Cache miss or expired)")
        response = requests.get(url, timeout=15)  # Add a timeout
        response.raise_for_status()
        data = response.json()

        if "members" in data:
            members = data["members"]
            print(f"Successfully fetched {len(members)} members.")
            for member in members:
                bioguide_id = member.get("bioguideId")
                if bioguide_id:
                    # Attempt to get standard party code (D, R, ID)
                    party_name = member.get("partyName", "")
                    party_code = "ID"  # Default to Independent/Other
                    if party_name.lower() == "democrat":
                        party_code = "D"
                    elif party_name.lower() == "republican":
                        party_code = "R"

                    members_data[bioguide_id] = {
                        "name": member.get("name", "Unknown Name"),
                        "bioguide_id": bioguide_id,
                        "state": member.get("state"),
                        "party": party_name,  # Full party name for display
                        "party_code": party_code,  # Code for filtering
                        "terms": member.get("terms"),
                        # Check common keys for website, adapt if API uses a different one
                        "website_url": member.get("directUrl") or member.get("url"),
                    }
        else:
            print(
                f"Warning: Congress.gov API did not return 'members' key. Response: {data}"
            )

    except requests.exceptions.Timeout:
        print(f"CRITICAL ERROR: Timeout fetching Congress.gov member list from {url}")
    except requests.exceptions.RequestException as e:
        print(f"CRITICAL ERROR fetching Congress.gov member list: {e}")
    except Exception as e:
        print(f"CRITICAL ERROR processing member list: {e}")

    if not members_data:
        print("Warning: Failed to load any member data.")

    return members_data


@cache.memoize(timeout=3600)
def get_member_committees(bioguide_id):
    """Fetches committee and potentially subcommittee assignments."""
    committees_data = {"main": [], "sub": []}  # Separate main and subcommittees
    if not CONGRESS_GOV_API_KEY:
        return committees_data
    # Ensure using correct endpoint, check API docs if this is right
    url = f"https://api.congress.gov/v3/member/{bioguide_id}/committee-assignments?api_key={CONGRESS_GOV_API_KEY}"
    print(f"Fetching committee assignments for {bioguide_id} from {url}")
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        if "committeeAssignments" in data:
            print(f"Received {len(data['committeeAssignments'])} assignments.")
            for assignment in data["committeeAssignments"]:
                committee_info = assignment.get("committee", {})
                committee_name = committee_info.get("name", "Unknown Committee")
                # Check for typical subcommittee naming patterns or specific fields
                # This logic is highly dependent on API response structure
                if (
                    committee_info.get("type") == "Subcommittee"
                    or "subcommittee" in committee_name.lower()
                ):
                    # Attempt to find parent committee if provided
                    parent_committee = committee_info.get("parentCommittee", {}).get(
                        "name", ""
                    )
                    committees_data["sub"].append(
                        {"name": committee_name, "parent": parent_committee}
                    )
                else:
                    committees_data["main"].append({"name": committee_name})
        else:
            print(f"No 'committeeAssignments' key found for {bioguide_id}.")
    except requests.exceptions.Timeout:
        print(f"Timeout fetching committees for {bioguide_id}")
    except requests.exceptions.RequestException as e:
        print(f"Error fetching committees for {bioguide_id}: {e}")
    except Exception as e:
        print(f"Unexpected error processing committees for {bioguide_id}: {e}")
    return committees_data  # Return dict with main/sub lists


@cache.memoize(timeout=1800)
def get_sponsored_bills(bioguide_id):
    """Fetches recent sponsored bills, tries to include intro date."""
    bills = []
    if not CONGRESS_GOV_API_KEY:
        return bills
    limit = 5
    url = f"https://api.congress.gov/v3/bill?sponsorBioguideId={bioguide_id}&sort=updateDate+desc&limit={limit}&api_key={CONGRESS_GOV_API_KEY}"
    print(f"Fetching sponsored bills for {bioguide_id} from {url}")
    try:
        response = requests.get(url, timeout=10)
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
                        "introduced_date": bill.get(
                            "introducedDate"
                        ),  # Add intro date if available
                    }
                )
        else:
            print(f"No 'bills' key found for {bioguide_id}.")
    except requests.exceptions.Timeout:
        print(f"Timeout fetching sponsored bills for {bioguide_id}")
    except requests.exceptions.RequestException as e:
        print(f"Error fetching sponsored bills for {bioguide_id}: {e}")
    except Exception as e:
        print(f"Unexpected error processing sponsored bills for {bioguide_id}: {e}")
    return bills


# Keeping get_member_votes simple for now, as details are hard to parse reliably
# from the general list endpoint. Placeholder for where more detail *could* go.
def get_member_votes(bioguide_id):
    """Fetches recent votes, basic info only."""
    if not CONGRESS_GOV_API_KEY:
        return []
    limit = 10
    chamber = "senate"  # This might need to be dynamic based on the member
    congress = "118"  # Update as needed
    session = "1"  # Update as needed
    url = f"https://api.congress.gov/v3/recorded-vote/{chamber}?congress={congress}&sessionNumber={session}&limit={limit}&api_key={CONGRESS_GOV_API_KEY}"
    print(f"Attempting to fetch recent votes: {url}")
    member_votes_processed = []
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        vote_data = response.json()
        if "votes" in vote_data:
            print(
                f"Processing {len(vote_data['votes'])} recent votes for {bioguide_id}..."
            )
            for vote in vote_data["votes"]:
                member_position = "Not Recorded"
                # Simplified check - Real API response needed for robust parsing
                members_section = vote.get("members")
                if (
                    isinstance(members_section, dict)
                    and "memberPositions" in members_section
                    and isinstance(members_section["memberPositions"], list)
                ):
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
                result = vote_info.get("voteResult", "")  # Get Pass/Fail if available

                member_votes_processed.append(
                    {
                        "bill_id": f"{bill_info.get('type', '')}{bill_info.get('number', '')}",
                        "vote": member_position,
                        "description": vote_info.get(
                            "voteQuestionText", "No Description"
                        ),
                        "vote_date": vote_info.get("voteTimestamp", "N/A"),
                        "roll_call": vote_info.get("rollCallNumber", "N/A"),
                        "result": result,  # Add result if API provides it here
                        # Placeholders for data not easily available in this call:
                        "party_breakdown": "N/A",
                    }
                )
            print(f"Finished vote processing for {bioguide_id}.")
        else:
            print(f"No 'votes' key found at {url}")
        return member_votes_processed[:5]  # Return latest 5 processed
    except requests.exceptions.Timeout:
        print(f"Timeout fetching votes for {bioguide_id}")
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
    print("FATAL WARNING: MEMBERS_DATA is empty. App functionality will be limited.")
else:
    print(f"Loaded {len(MEMBERS_DATA)} members into MEMBERS_DATA.")
# --- ---


# --- Flask Routes ---
@app.route("/")
def index():
    """Serves the main HTML page and member data for JS."""
    print("Serving index page...")
    all_members_dict = MEMBERS_DATA if MEMBERS_DATA else {}
    all_members_list = list(all_members_dict.values())

    # Create list of unique states for state filter dropdown
    states = sorted(
        list(set(m["state"] for m in all_members_list if m and m.get("state")))
    )

    try:
        # Pass member list as JSON string
        all_members_json_string = json.dumps(all_members_list)
        print(
            f"Passing {len(all_members_list)} members as JSON and {len(states)} states to template."
        )
    except TypeError as e:
        print(f"Error serializing member data to JSON: {e}")
        all_members_json_string = "[]"

    return render_template(
        "index.html",
        all_members_json=all_members_json_string,
        states=states,  # Pass the list of states
    )


@app.route("/api/member/<bioguide_id>")
def get_member_data(bioguide_id):
    """API endpoint for member details, committees, bills, votes."""
    print(f"API call received for member: {bioguide_id}")
    member_info = MEMBERS_DATA.get(bioguide_id)

    if not member_info:
        print(f"Member info not found for Bioguide ID: {bioguide_id}")
        return jsonify({"error": "Member info not found"}), 404

    committee_data = get_member_committees(bioguide_id)
    sponsored_bills_data = get_sponsored_bills(bioguide_id)
    vote_data = get_member_votes(bioguide_id)

    combined_data = {
        "member_details": {
            "name": member_info.get("name"),
            "state": member_info.get("state"),
            "party": member_info.get("party"),
            "website_url": member_info.get("website_url"),
            "bioguide_id": bioguide_id,  # Include Bioguide ID for photo URL construction
        },
        # Note: committee_data is now a dict {'main': [], 'sub': []}
        "committees": committee_data,
        "sponsored_bills": sponsored_bills_data,
        "votes": vote_data,
    }
    return jsonify(combined_data)


# --- End Flask Routes ---

if __name__ == "__main__":
    app.run(debug=True)
