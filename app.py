import os
import json
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
    Fetches initial Member list for dropdown population.
    Returns a dictionary mapping member ID (bioguideId) to member info.
    (Cached on startup)
    """
    print("Attempting to execute load_congress_members...")
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
        print("Executing load_congress_members API call (Cache miss or expired)")
        response = requests.get(url, timeout=15)  # Add a timeout
        response.raise_for_status()  # Check for HTTP errors (4xx, 5xx)
        data = response.json()

        if "members" in data:
            members = data["members"]
            print(f"Successfully fetched {len(members)} members.")
            for member in members:
                bioguide_id = member.get("bioguideId")
                if bioguide_id:
                    # Attempt to get standard party code (D, R, ID)
                    party_name = member.get("partyName", "")
                    print(f"party_name: {party_name}")
                    party_code = None
                    if party_name == "Democratic":
                        party_code = "D"
                    elif party_name == "Republican":
                        party_code = "R"
                    elif party_name == "Independent":
                        party_code = "ID"

                    members_data[bioguide_id] = {
                        "name": member.get("name", "Unknown Name"),  # Provide default
                        "bioguide_id": bioguide_id,
                        "state": member.get("state"),
                        "party": party_name,  # Full party name for display
                        "party_code": party_code,  # Code for filtering
                        # We only need basic info for filtering/dropdown here
                    }
        else:
            print(
                f"Warning: Congress.gov API did not return 'members' key. Response: {data}"
            )

    except requests.exceptions.Timeout:
        print(f"CRITICAL ERROR: Timeout fetching Congress.gov member list from {url}")
    except requests.exceptions.RequestException as e:
        print(f"CRITICAL ERROR fetching Congress.gov member list: {e}")
    except Exception as e:  # Catch other potential errors like JSONDecodeError
        print(f"CRITICAL ERROR processing member list: {e}")

    if not members_data:
        print("Warning: Failed to load any member data. MEMBERS_DATA will be empty.")

    return members_data


@cache.memoize(timeout=3600)
def get_member_details(bioguide_id):
    """Fetches detailed info. Returns {"details": {...}, "error": None}"""
    # Note: Removed committee parsing from here as it wasn't reliable in this endpoint
    member_payload = {"details": None, "error": None}
    if not CONGRESS_GOV_API_KEY:
        member_payload["error"] = "API Key missing"
        return member_payload
    url = f"https://api.congress.gov/v3/member/{bioguide_id}?api_key={CONGRESS_GOV_API_KEY}"
    print(f"Fetching detailed member info for {bioguide_id} from {url}")
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        # Print the raw response for debugging details if needed
        # print(f"Response data for {bioguide_id}: {json.dumps(data, indent=2)}")
        if "member" in data:
            member_data = data["member"]
            party_name = member_data.get("partyHistory", [{}])[-1].get("partyName", "")
            member_payload["details"] = {
                "name": member_data.get("directOrderName")
                or member_data.get("invertedOrderName"),
                "bioguide_id": member_data.get("bioguideId"),
                "state": member_data.get("state"),
                "party": party_name,
                "birth_year": member_data.get("birthYear"),
                "leadership": member_data.get("leadership", []),
                "website_url": member_data.get("directUrl") or member_data.get("url"),
            }
            print(f"Successfully processed details for {bioguide_id}")
        else:
            print(f"Warn: 'member' key not found for {bioguide_id}")
            member_payload["error"] = "Member data format unexpected"
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code
        print(f"HTTP Error {status_code} fetching details...")
        member_payload["error"] = (
            f"Member Not Found ({status_code})"
            if status_code == 404
            else f"API Error ({status_code})"
        )
    except requests.exceptions.Timeout:
        print("Timeout fetching details...")
        member_payload["error"] = "Request timed out"
    except requests.exceptions.RequestException as e:
        print(f"Request Error fetching details... {e}")
        member_payload["error"] = "Network error"
    except Exception as e:
        print(f"Unexpected error processing details... {e}")
        member_payload["error"] = "Processing error"
    return member_payload


@cache.memoize(timeout=1800)
def get_sponsored_legislation(bioguide_id):
    """
    Fetches recent sponsored legislation (bills OR amendments) and returns
    a standardized list under the 'items' key.
    Returns a dictionary: {"items": [], "error": None}
    """
    legislation_data = {"items": [], "error": None}
    if not CONGRESS_GOV_API_KEY:
        legislation_data["error"] = "API Key missing"
        return legislation_data
    limit = 10
    url = f"https://api.congress.gov/v3/member/{bioguide_id}/sponsored-legislation?limit={limit}&api_key={CONGRESS_GOV_API_KEY}"
    print(f"Fetching sponsored legislation for {bioguide_id} from {url}")
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        item_list_key = next(
            (
                k
                for k in ["sponsoredLegislation", "legislation", "items"]
                if k in data and isinstance(data.get(k), list)
            ),
            None,
        )

        if item_list_key:
            item_list = data[item_list_key]
            print(
                f"Processing {len(item_list)} sponsored items for {bioguide_id} via key '{item_list_key}'."
            )
            for index, item in enumerate(item_list):
                # print(f"  Item {index} data: {json.dumps(item, indent=2)}") # Optional debug

                latest_action = item.get("latestAction")
                latest_action_text = None
                latest_action_date = None
                if isinstance(latest_action, dict):
                    latest_action_text = latest_action.get("text")
                    latest_action_date = latest_action.get("actionDate")

                # ---> START: Standardize Output Structure <---
                item_data = {
                    "item_type": None,  # Will be 'Bill' or 'Amendment'
                    "number": None,
                    "type": item.get("type"),  # Store original type if present
                    "title": item.get("title")
                    or item.get("officialTitle"),  # Prioritize bill titles
                    "congress": item.get("congress"),
                    "introduced_date": item.get("introducedDate"),
                    "latest_action_text": latest_action_text,
                    "latest_action_date": latest_action_date,
                    # Add raw keys for JS linking if needed
                    "raw_type": item.get("type"),
                    "raw_bill_number": item.get("number"),
                    "raw_amendment_number": item.get("amendmentNumber"),
                }

                if (
                    item.get("number") is not None and item.get("type") is not None
                ):  # Looks like a Bill
                    item_data["item_type"] = "Bill"
                    item_data["number"] = item.get("number")
                    # Title already attempted above
                    if not item_data["title"]:
                        item_data["title"] = (
                            f"Bill {item.get('type')}{item.get('number')}"  # Fallback title
                        )

                elif item.get("amendmentNumber") is not None:  # Looks like an Amendment
                    item_data["item_type"] = "Amendment"
                    item_data["number"] = item.get(
                        "amendmentNumber"
                    )  # Use amendment number as 'number'
                    # Attempt to use purpose as title, otherwise construct one
                    item_data["title"] = (
                        item.get("purpose") or f"Amendment {item_data['number']}"
                    )
                    # Amendment 'type' might be like 'samdt', store it raw but maybe display differently
                else:
                    print(f"Warn: Item {index} for {bioguide_id} unrecognized: {item}")
                    continue  # Skip

                legislation_data["items"].append(item_data)
                # ---> END: Standardize Output Structure <---
        else:
            print(
                f"Warn: Expected legislation list key not found/invalid for {bioguide_id}."
            )
    # ... (Keep existing except blocks, ensure they set legislation_data['error']) ...
    except Exception as e:
        print(f"Unexpected error processing sponsored legis... {e}")
        legislation_data["error"] = "Error processing data"
    return legislation_data


# --- End Helper Functions ---

# --- Load Initial Member List ---
INITIAL_MEMBERS_DATA = load_congress_members()
if not INITIAL_MEMBERS_DATA:
    print("FATAL WARNING: INITIAL_MEMBERS_DATA is empty.")
else:
    print(f"Loaded {len(INITIAL_MEMBERS_DATA)} members into INITIAL_MEMBERS_DATA.")
# --- ---


# --- Flask Routes ---
@app.route("/")
def index():
    """Serves the main HTML page and initial member data for JS filtering."""
    print("Serving index page...")
    all_members_dict = INITIAL_MEMBERS_DATA if INITIAL_MEMBERS_DATA else {}
    all_members_list = list(all_members_dict.values())
    states = sorted(
        list(set(m["state"] for m in all_members_list if m and m.get("state")))
    )
    try:
        all_members_json_string = json.dumps(all_members_list)
        print(
            f"Passing {len(all_members_list)} members as JSON and {len(states)} states to template."
        )
    except TypeError as e:
        print(f"Error serializing member data to JSON: {e}")
        all_members_json_string = "[]"
    return render_template(
        "index.html", all_members_json=all_members_json_string, states=states
    )


@app.route("/api/member/<bioguide_id>")
def get_member_data(bioguide_id):
    """API endpoint fetching all data for a member."""
    print(f"API call received for member: {bioguide_id}")
    member_data = get_member_details(
        bioguide_id
    )  # Returns {"details": {...}, "error": ...}

    if member_data.get("error"):
        # status_code = 500  # Determine code...
        # print(f"Error fetching core details for {bioguide_id}: {member_data['error']}")
        # # Return consistent structure with errors populated
        # return (
        #     jsonify(
        #         {
        #             "error": member_data["error"],
        #             "member_details": None,
        #             "committees": None,  # Correctly null
        #             "committees_error": "Committee data not directly available.",  # Correct message
        #             "sponsored_items": [],  # Correct key
        #             "sponsored_items_error": "Did not fetch due to member details error",  # Correct key
        #             "votes": [],
        #             "votes_error": "Did not fetch due to member details error",
        #         }
        #     ),
        #     status_code,
        # )
        pass

    # Fetch sponsored legislation only if core details succeeded
    sponsored_legis_data = get_sponsored_legislation(
        bioguide_id
    )  # Use renamed function
    vote_data = {"votes": [], "error": "Vote fetching temporarily disabled."}

    # Construct the final response with CORRECT keys
    combined_data = {
        "error": None,
        "member_details": member_data.get("details"),
        "committees": None,
        "committees_error": "Committee data not available via this endpoint.",
        # ---> Use the standardized 'items' key from get_sponsored_legislation <---
        "sponsored_items": sponsored_legis_data["items"],
        "sponsored_items_error": sponsored_legis_data["error"],
        "votes": vote_data["votes"],
        "votes_error": vote_data["error"],
    }
    print(f"Returning combined data for {bioguide_id}")
    return jsonify(combined_data)


# --- End Flask Routes ---

if __name__ == "__main__":
    app.run(debug=True)
