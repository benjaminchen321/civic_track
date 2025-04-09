import os
import json
import requests
from flask import Flask, jsonify, render_template, request
from flask_caching import Cache
from urllib.parse import urlparse, parse_qs  # Import urlparse

app = Flask(__name__)

# --- Cache Configuration ---
cache_config = {
    "CACHE_TYPE": "FileSystemCache",
    "CACHE_DIR": "flask_cache",
    "CACHE_DEFAULT_TIMEOUT": 3600,  # Cache default 1 hour
}
app.config.from_mapping(cache_config)
cache = Cache(app)
# --- End Cache Configuration ---

# Load API Key
CONGRESS_GOV_API_KEY = os.environ.get("CONGRESS_GOV_API_KEY")
if not CONGRESS_GOV_API_KEY:
    print("CRITICAL WARNING: CONGRESS_GOV_API_KEY environment variable not set.")
    # exit(1)

API_BASE_URL = "https://api.congress.gov/v3"


# --- START: Generic API Helper ---
# (Keep _make_api_request function exactly as corrected in the previous response)
def _make_api_request(endpoint, params=None, timeout=15):
    """
    Makes a request to the Congress.gov API.
    (No changes needed in this helper function from the previous version)
    """
    if not CONGRESS_GOV_API_KEY:
        return None, "API Key not configured."
    request_params = params.copy() if params else {}
    request_params["api_key"] = CONGRESS_GOV_API_KEY
    request_params.setdefault("format", "json")
    url = f"{API_BASE_URL}{endpoint}"
    log_params = {k: v for k, v in request_params.items() if k != "api_key"}
    log_params["api_key"] = "***MASKED***"
    print(f"API Request: GET {url} PARAMS: {log_params}")
    headers = {"Accept": "application/json"}
    response = None  # Initialize response to None
    try:
        response = requests.get(
            url, headers=headers, params=request_params, timeout=timeout
        )
        response.raise_for_status()
        data = response.json()
        return data, None  # Success
    except requests.exceptions.Timeout:
        error_msg = f"Request timed out after {timeout}s for endpoint {endpoint}"
        print(f"ERROR: {error_msg}")
        return None, error_msg
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code
        error_text = e.response.text  # Default error text
        try:
            error_details = e.response.json()
            api_error_message = error_details.get("error", {}).get(
                "message", ""
            ) or error_details.get("message", error_text)
            error_msg = f"API HTTP Error {status_code}: {api_error_message}"
        except json.JSONDecodeError:
            error_msg = f"API HTTP Error {status_code}: {error_text}"
        print(f"ERROR: {error_msg}")
        return None, error_msg
    except requests.exceptions.RequestException as e:
        error_msg = f"Network error connecting to API: {e}"
        print(f"ERROR: {error_msg}")
        return None, error_msg
    except json.JSONDecodeError as e:
        resp_text = response.text[:500] if response else "N/A"
        error_msg = f"Failed to decode JSON response from {endpoint}: {e}. Response text: {resp_text}..."
        print(f"ERROR: {error_msg}")
        return None, error_msg
    except Exception as e:
        error_msg = f"Unexpected error during API request to {endpoint}: {e}"
        print(f"ERROR: {error_msg}")
        return None, error_msg


# --- END: Generic API Helper ---


# --- Helper Functions ---


# (Keep load_congress_members, get_member_details, get_sponsored_legislation, get_cosponsored_legislation as before)
# ... (Previous helper functions unchanged) ...
@cache.memoize(timeout=43200)
def load_congress_members(congress_num=None):
    print(
        f"Attempting to execute load_congress_members (Congress: {congress_num or 'All'})..."
    )
    members_data = {}
    limit = 250
    endpoint = "/member"
    params = {"limit": limit}
    if congress_num:
        endpoint = f"/member/congress/{congress_num}"
    data, error = _make_api_request(endpoint, params=params)
    if error:
        print(f"CRITICAL ERROR in load_congress_members: {error}")
        return members_data
    if not data or "members" not in data or not isinstance(data["members"], list):
        print(
            f"Warning: Invalid data structure received from {endpoint}. Expected 'members' list. Got keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}"
        )
        return members_data
    members = data["members"]
    print(f"Successfully fetched {len(members)} members from API. Processing...")
    for member in members:
        if not isinstance(member, dict):
            print(f"Warning: Skipping non-dictionary item in members list: {member}")
            continue
        bioguide_id = member.get("bioguideId")
        if not bioguide_id:
            print("Warning: Skipping member entry missing bioguideId.")
            continue
        party_name = member.get("partyName", "")
        party_code = "ID"
        if party_name == "Democratic":
            party_code = "D"
        elif party_name == "Republican":
            party_code = "R"
        state = member.get("state")
        district = member.get("district")
        current_chamber = None
        if district is not None:
            current_chamber = "House"
        elif state is not None:
            current_chamber = "Senate"
        members_data[bioguide_id] = {
            "name": member.get("name", f"Unknown ({bioguide_id})"),
            "bioguide_id": bioguide_id,
            "state": state,
            "party": party_name,
            "party_code": party_code,
            "chamber": current_chamber,
            "congress": member.get("congress") or congress_num,
        }
    print(f"Finished processing {len(members_data)} members.")
    return members_data


@cache.memoize(timeout=3600)
def get_member_details(bioguide_id):
    endpoint = f"/member/{bioguide_id}"
    data, error = _make_api_request(endpoint)
    member_payload = {"details": None, "error": error}
    if data and "member" in data and isinstance(data["member"], dict):
        member_data = data["member"]
        party_name = "Unknown"
        party_history = member_data.get("partyHistory")
        if isinstance(party_history, list) and party_history:
            last_party = party_history[-1]
            if isinstance(last_party, dict):
                party_name = last_party.get("partyName", "Unknown")
        else:
            party_name = member_data.get("partyName", "Unknown")
        member_payload["details"] = {
            "name": member_data.get("directOrderName")
            or member_data.get("invertedOrderName")
            or member_data.get("name"),
            "bioguide_id": member_data.get("bioguideId"),
            "state": member_data.get("state"),
            "party": party_name,
            "birth_year": member_data.get("birthYear"),
            "leadership": member_data.get("leadership", []),
            "website_url": member_data.get("directUrl") or member_data.get("url"),
            "terms": member_data.get("terms"),
        }
        print(f"Successfully processed details for {bioguide_id}")
    elif not error:
        member_payload["error"] = (
            f"Member data format unexpected in response. Keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}"
        )
        print(f"ERROR: {member_payload['error']} for {bioguide_id}")
    return member_payload


@cache.memoize(timeout=1800)
def get_sponsored_legislation(bioguide_id):
    endpoint = f"/member/{bioguide_id}/sponsored-legislation"
    params = {"limit": 15}
    data, error = _make_api_request(endpoint, params=params)
    legislation_data = {"items": [], "error": error}
    item_list = None
    if data:
        possible_keys = ["sponsoredLegislation", "legislation", "items"]
        for key in possible_keys:
            if key in data and isinstance(data.get(key), list):
                item_list = data[key]
                break
    if item_list is not None:
        print(f"Processing {len(item_list)} sponsored items for {bioguide_id}...")
        for item in item_list:
            if not isinstance(item, dict):
                continue
            latest_action = item.get("latestAction", {})
            if not isinstance(latest_action, dict):
                latest_action = {}
            item_data = {
                "item_type": (
                    "Bill"
                    if item.get("number") is not None
                    else (
                        "Amendment"
                        if item.get("amendmentNumber") is not None
                        else "Unknown"
                    )
                ),
                "number": item.get("number") or item.get("amendmentNumber"),
                "type": item.get("type"),
                "title": item.get("title")
                or item.get("officialTitle")
                or f"Item {item.get('type', '')}{item.get('number') or item.get('amendmentNumber', '')}",
                "congress": item.get("congress"),
                "introduced_date": item.get("introducedDate"),
                "latest_action_text": latest_action.get("text", "N/A"),
                "latest_action_date": latest_action.get("actionDate", "N/A"),
            }
            if item_data["item_type"] != "Unknown":
                legislation_data["items"].append(item_data)
            else:
                print(f"Warning: Could not determine type for sponsored item: {item}")
    elif not error and data is not None:
        print(
            f"No sponsored legislation items found or key mismatch for {bioguide_id}. API keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}"
        )
        if isinstance(error, str) and ("404" in error or "Not Found" in error):
            legislation_data["error"] = None
    return legislation_data


@cache.memoize(timeout=1800)
def get_cosponsored_legislation(bioguide_id):
    endpoint = f"/member/{bioguide_id}/cosponsored-legislation"
    params = {"limit": 15}
    data, error = _make_api_request(endpoint, params=params)
    legislation_data = {"items": [], "error": error}
    item_list = None
    if data:
        possible_keys = ["cosponsoredLegislation", "legislation", "items"]
        for key in possible_keys:
            if key in data and isinstance(data.get(key), list):
                item_list = data[key]
                break
    if item_list is not None:
        print(f"Processing {len(item_list)} cosponsored items for {bioguide_id}...")
        for item in item_list:
            if not isinstance(item, dict):
                continue
            latest_action = item.get("latestAction", {})
            if not isinstance(latest_action, dict):
                latest_action = {}
            item_data = {
                "item_type": (
                    "Bill"
                    if item.get("number") is not None
                    else (
                        "Amendment"
                        if item.get("amendmentNumber") is not None
                        else "Unknown"
                    )
                ),
                "number": item.get("number") or item.get("amendmentNumber"),
                "type": item.get("type"),
                "title": item.get("title")
                or item.get("officialTitle")
                or f"Item {item.get('type', '')}{item.get('number') or item.get('amendmentNumber', '')}",
                "congress": item.get("congress"),
                "introduced_date": item.get("introducedDate"),
                "latest_action_text": latest_action.get("text", "N/A"),
                "latest_action_date": latest_action.get("actionDate", "N/A"),
            }
            if item_data["item_type"] != "Unknown":
                legislation_data["items"].append(item_data)
            else:
                print(f"Warning: Could not determine type for cosponsored item: {item}")
    elif not error and data is not None:
        print(
            f"No cosponsored legislation items found or key mismatch for {bioguide_id}. API keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}"
        )
        if isinstance(error, str) and ("404" in error or "Not Found" in error):
            legislation_data["error"] = None
    return legislation_data


# --- START: Modified Function to get Congress List ---
@cache.memoize(timeout=86400)  # Cache for a day
def get_congress_list():
    """Fetches the list of available Congresses and extracts the number."""
    print("Fetching list of Congresses...")
    congresses_list = []
    data, error = _make_api_request("/congress")

    if error:
        print(f"Error fetching Congress list: {error}")
        return congresses_list  # Return empty list on error

    if data and "congresses" in data and isinstance(data["congresses"], list):
        raw_congresses = data["congresses"]
        print(f"Processing {len(raw_congresses)} congress entries from API...")
        valid_congresses = []
        for congress_item in raw_congresses:
            # Ensure item is a dict and has 'url'
            if isinstance(congress_item, dict) and "url" in congress_item:
                congress_number = None
                try:
                    # Parse the URL to extract the path
                    parsed_url = urlparse(congress_item["url"])
                    path_segments = parsed_url.path.strip("/").split("/")
                    # The number should be the last segment before query params
                    if len(path_segments) > 0 and path_segments[-1].isdigit():
                        congress_number = int(path_segments[-1])
                    else:
                        # Fallback: Try parsing from name like "119th Congress"
                        name = congress_item.get("name", "")
                        if "th Congress" in name:
                            num_str = name.split("th Congress")[0]
                            if num_str.isdigit():
                                congress_number = int(num_str)

                except (ValueError, TypeError, IndexError) as e:
                    print(
                        f"Warning: Could not extract congress number for item {congress_item}: {e}"
                    )

                # If we successfully extracted a number, add it to the dict and the list
                if congress_number is not None:
                    congress_item["number"] = congress_number  # Add the number key
                    valid_congresses.append(congress_item)
                else:
                    print(
                        f"Warning: Failed to extract number for congress item: {congress_item}"
                    )
            else:
                print(
                    f"Warning: Skipping invalid congress item structure or missing URL: {congress_item}"
                )

        # Sort valid congresses descending by the extracted number
        if valid_congresses:
            # Sort using the 'number' key we just added
            congresses_list = sorted(
                valid_congresses, key=lambda x: x.get("number", 0), reverse=True
            )
            print(
                f"Successfully processed and sorted {len(congresses_list)} valid congresses."
            )
        else:
            print("Warning: No valid congress entries found after processing.")
    else:
        print(
            f"Warning: Could not parse Congress list. 'congresses' key missing or not a list in response. Keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}"
        )

    return congresses_list


# --- END: Modified Function to get Congress List ---

# --- End Helper Functions ---

# --- Load Initial Data on Startup ---
print("Fetching initial Congress list on startup...")
AVAILABLE_CONGRESSES = (
    get_congress_list()
)  # Should now return list of dicts with 'number' key

# --- Robust Default Congress Selection (Should work now) ---
DEFAULT_CONGRESS = None
if AVAILABLE_CONGRESSES:
    first_congress_item = AVAILABLE_CONGRESSES[0]
    # Access the 'number' key we added in get_congress_list
    if isinstance(first_congress_item, dict) and "number" in first_congress_item:
        DEFAULT_CONGRESS = first_congress_item["number"]
    else:
        # This warning should ideally not appear now if get_congress_list worked
        print(
            f"Warning: First item in processed AVAILABLE_CONGRESSES is invalid: {first_congress_item}"
        )

# Use .get() for safer access in list comprehension during logging
print(
    f"Available Congresses: {[c.get('number', 'N/A') for c in AVAILABLE_CONGRESSES]}. Default Selected: {DEFAULT_CONGRESS}"
)

# --- End Load Initial Data ---


# --- Flask Routes ---


# (Keep /api/members, /, /api/member/<bioguide_id>, placeholder routes as before)
# ... (Flask routes unchanged from previous correct version) ...
@app.route("/api/members")
def get_members_list_data():
    """API endpoint to fetch member list based on filters."""
    congress_filter = request.args.get("congress")
    if not congress_filter or not congress_filter.isdigit():
        if DEFAULT_CONGRESS:
            print(
                f"Warning: Invalid/missing congress query param, defaulting to {DEFAULT_CONGRESS}"
            )
            congress_filter = str(DEFAULT_CONGRESS)
        else:
            print(
                "Error: Congress query parameter missing or invalid, and no default congress set."
            )
            return (
                jsonify({"error": "Valid 'congress' query parameter is required."}),
                400,
            )
    members_dict = load_congress_members(congress_filter)
    if not members_dict:
        print(
            f"Error: Could not load members for Congress {congress_filter} in API route."
        )
        return (
            jsonify(
                {
                    "error": f"Could not load members for Congress {congress_filter}. Check API key or network."
                }
            ),
            500,
        )
    all_members_list = list(members_dict.values())
    return jsonify(all_members_list)


@app.route("/")
def index():
    """Serves the main HTML page."""
    print("Serving index page...")
    congresses_for_template = AVAILABLE_CONGRESSES if AVAILABLE_CONGRESSES else []
    static_states = [
        "AL",
        "AK",
        "AZ",
        "AR",
        "CA",
        "CO",
        "CT",
        "DE",
        "FL",
        "GA",
        "HI",
        "ID",
        "IL",
        "IN",
        "IA",
        "KS",
        "KY",
        "LA",
        "ME",
        "MD",
        "MA",
        "MI",
        "MN",
        "MS",
        "MO",
        "MT",
        "NE",
        "NV",
        "NH",
        "NJ",
        "NM",
        "NY",
        "NC",
        "ND",
        "OH",
        "OK",
        "OR",
        "PA",
        "RI",
        "SC",
        "SD",
        "TN",
        "TX",
        "UT",
        "VT",
        "VA",
        "WA",
        "WV",
        "WI",
        "WY",
        "AS",
        "DC",
        "FM",
        "GU",
        "MH",
        "MP",
        "PW",
        "PR",
        "VI",
    ]
    static_states.sort()
    static_chambers = ["House", "Senate"]
    return render_template(
        "index.html",
        congresses=congresses_for_template,
        current_congress=DEFAULT_CONGRESS,
        states=static_states,
        chambers=static_chambers,
    )


@app.route("/api/member/<bioguide_id>")
def get_member_data(bioguide_id):
    if not bioguide_id or not isinstance(bioguide_id, str) or len(bioguide_id) != 7:
        print(f"Invalid bioguide_id format received: {bioguide_id}")
        return jsonify({"error": "Invalid member ID format."}), 400
    print(f"API call received for member data: {bioguide_id}")
    member_data = get_member_details(bioguide_id)
    sponsored_legis_data = get_sponsored_legislation(bioguide_id)
    cosponsored_legis_data = get_cosponsored_legislation(bioguide_id)
    combined_data = {
        "error": None,
        "member_details": member_data.get("details"),
        "member_details_error": member_data.get("error"),
        "committees": None,
        "committees_error": "Committee data fetching not implemented.",
        "sponsored_items": sponsored_legis_data.get("items", []),
        "sponsored_items_error": sponsored_legis_data.get("error"),
        "cosponsored_items": cosponsored_legis_data.get("items", []),
        "cosponsored_items_error": cosponsored_legis_data.get("error"),
        "votes": [],
        "votes_error": "Vote data fetching not implemented.",
    }
    status_code = 200
    details_error = member_data.get("error")
    if details_error and (
        "404" in details_error
        or "Not Found" in details_error
        or "Invalid" in details_error
    ):
        status_code = 404
        combined_data["error"] = f"Member {bioguide_id} not found or invalid ID."
        print(
            f"Member details fetch failed significantly for {bioguide_id}, returning 404."
        )
    print(f"Returning combined data for {bioguide_id} with status {status_code}")
    return jsonify(combined_data), status_code


@app.route("/bills")
def bills_page():
    return "Bill Search Page - Not Implemented Yet", 501


@app.route("/bill/<int:congress>/<bill_type>/<int:bill_number>")
def bill_detail_page(congress, bill_type, bill_number):
    return (
        f"Bill Detail Page for {bill_type.upper()}{bill_number} ({congress}th Congress) - Not Implemented Yet",
        501,
    )


# --- End Flask Routes ---

if __name__ == "__main__":
    cache_dir = app.config.get("CACHE_DIR", "flask_cache")
    if not os.path.exists(cache_dir):
        try:
            os.makedirs(cache_dir)
            print(f"Created cache directory: {cache_dir}")
        except OSError as e:
            print(f"ERROR: Could not create cache directory '{cache_dir}': {e}")

    app.run(debug=True)
