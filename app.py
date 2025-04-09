# FILE: app.py
import os
import json
import requests
from flask import Flask, jsonify, render_template, request
from flask_caching import Cache
from urllib.parse import urlparse

app = Flask(__name__)

# Cache Config
cache_config = {
    "CACHE_TYPE": "FileSystemCache",
    "CACHE_DIR": "flask_cache",
    "CACHE_DEFAULT_TIMEOUT": 3600,
}
app.config.from_mapping(cache_config)
cache = Cache(app)

# API Key and Base URL
CONGRESS_GOV_API_KEY = os.environ.get("CONGRESS_GOV_API_KEY")
if not CONGRESS_GOV_API_KEY:
    print("CRITICAL WARNING: CONGRESS_GOV_API_KEY env var missing.")
API_BASE_URL = "https://api.congress.gov/v3"

# Amendment Types (lowercase, as parsed from URL)
AMENDMENT_TYPES = {"samdt", "hamdt", "sa", "ha"}


# --- Generic API Helper (No changes) ---
def _make_api_request(endpoint, params=None, timeout=15):
    """Makes a request to the Congress.gov API."""
    if not CONGRESS_GOV_API_KEY:
        return None, "API Key missing."
    request_params = params.copy() if params else {}
    request_params["api_key"] = CONGRESS_GOV_API_KEY
    request_params.setdefault("format", "json")
    url = f"{API_BASE_URL}{endpoint}"
    log_params = {k: v for k, v in request_params.items() if k != "api_key"}
    log_params["api_key"] = "***MASKED***"
    print(f"API Request: GET {url} PARAMS: {log_params}")
    headers = {"Accept": "application/json"}
    response = None
    try:
        response = requests.get(
            url, headers=headers, params=request_params, timeout=timeout
        )
        response.raise_for_status()
        data = response.json()
        return data, None
    except requests.exceptions.Timeout:
        error_msg = f"Timeout for {endpoint}"
        print(f"ERROR: {error_msg}")
        return None, error_msg
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code
        error_text = e.response.text
        try:
            error_details = e.response.json()
            api_error_message = error_details.get("error", {}).get(
                "message", ""
            ) or error_details.get("message", error_text)
            error_msg = f"API HTTP {status_code}: {api_error_message}"
        except json.JSONDecodeError:
            error_msg = f"API HTTP {status_code}: {error_text}"
        print(f"ERROR: {error_msg}")
        return None, error_msg
    except requests.exceptions.RequestException as e:
        error_msg = f"Network error: {e}"
        print(f"ERROR: {error_msg}")
        return None, error_msg
    except json.JSONDecodeError as e:
        resp_text = response.text[:500] if response else "N/A"
        error_msg = f"JSON Error: {e}. Resp: {resp_text}..."
        print(f"ERROR: {error_msg}")
        return None, error_msg
    except Exception as e:
        error_msg = f"API Error: {e}"
        print(f"ERROR: {error_msg}")
        return None, error_msg


# --- Helper Functions ---
@cache.memoize(timeout=43200)
def load_congress_members(congress_num=None):
    """Loads member list, optionally filtered by Congress."""
    print(f"Loading members (Congress: {congress_num or 'All'})...")
    members_data = {}
    limit = 250
    endpoint = "/member"
    params = {"limit": limit}
    if congress_num:
        endpoint = f"/member/congress/{congress_num}"
    data, error = _make_api_request(endpoint, params=params)
    if error:
        print(f"ERROR loading members: {error}")
        return members_data
    if not data or "members" not in data or not isinstance(data["members"], list):
        print("Warn: Bad member data struct.")
        return members_data
    members = data["members"]
    print(f"Processing {len(members)} members...")
    for member in members:
        if not isinstance(member, dict):
            continue
        bioguide_id = member.get("bioguideId")
        if not bioguide_id:
            continue
        party_name = member.get("partyName", "")
        p_code = "ID"
        if party_name == "Democratic":
            p_code = "D"
        elif party_name == "Republican":
            p_code = "R"
        state = member.get("state")
        district = member.get("district")
        chamber = (
            "House" if district is not None else "Senate" if state is not None else None
        )
        members_data[bioguide_id] = {
            "name": member.get("name", f"? ({bioguide_id})"),
            "bioguide_id": bioguide_id,
            "state": state,
            "party": party_name,
            "party_code": p_code,
            "chamber": chamber,
            "congress": member.get("congress") or congress_num,
        }
    print(f"Finished {len(members_data)} members.")
    return members_data


@cache.memoize(timeout=3600)
def get_member_details(bioguide_id):
    """Fetches detailed info for a member."""
    endpoint = f"/member/{bioguide_id}"
    data, error = _make_api_request(endpoint)
    payload = {"details": None, "error": error}
    if data and "member" in data and isinstance(data["member"], dict):
        m_data = data["member"]
        p_name = "Unknown"
        p_hist = m_data.get("partyHistory")
        if isinstance(p_hist, list) and p_hist:
            last_p = p_hist[-1]
            p_name = (
                last_p.get("partyName", "?") if isinstance(last_p, dict) else p_name
            )
        else:
            p_name = m_data.get("partyName", "?")
        payload["details"] = {
            "name": m_data.get("directOrderName")
            or m_data.get("invertedOrderName")
            or m_data.get("name"),
            "bioguide_id": m_data.get("bioguideId"),
            "state": m_data.get("state"),
            "party": p_name,
            "birth_year": m_data.get("birthYear"),
            "leadership": m_data.get("leadership", []),
            "website_url": m_data.get("directUrl") or m_data.get("url"),
            "terms": m_data.get("terms"),
        }
    elif not error:
        payload["error"] = (
            f"Bad detail format. Keys:{list(data.keys()) if isinstance(data, dict) else 'N/A'}"
        )
    return payload


def _parse_legislation_item(item):
    """Helper function to parse legislation item (Bill or Amendment)."""
    if not isinstance(item, dict):
        print(f"Warn: Non-dict item: {item}")
        return None

    latest_action = item.get("latestAction", {})
    if not isinstance(latest_action, dict):
        latest_action = {}

    item_data = {
        "item_type": None,
        "number": None,
        "type": None,  # Will be populated below
        "title": item.get("title")
        or item.get("officialTitle")
        or item.get("purpose")
        or "No Title Provided",
        "congress": item.get("congress"),
        "introduced_date": item.get("introducedDate"),
        "latest_action_text": latest_action.get("text", "N/A"),
        "latest_action_date": latest_action.get("actionDate", "N/A"),
        "url": item.get("url"),
    }

    amendment_num = item.get("amendmentNumber")  # Check this FIRST
    bill_num = item.get("number")
    original_type = item.get("type")  # Can be "None" string or actual type

    # --- START: Corrected Logic ---
    if amendment_num is not None:
        item_data["item_type"] = "Amendment"
        item_data["number"] = (
            amendment_num  # Use amendmentNumber as the 'number' for amendments
        )
        item_data["title"] = item_data["title"] or f"Amendment {amendment_num}"

        # MUST parse type from URL because original_type is often "None"
        parsed_type_from_url = None
        if item_data["url"]:
            try:
                parsed_url = urlparse(item_data["url"])
                path_segments = parsed_url.path.strip("/").split("/")
                # Example: /v3/amendment/119/samdt/2216 -> path_segments[-2] is 'samdt'
                if len(path_segments) >= 5 and path_segments[1] == "amendment":
                    type_code = path_segments[-2].lower()
                    if type_code in AMENDMENT_TYPES:
                        parsed_type_from_url = type_code.upper()  # Store parsed type
                        print(
                            f"Debug: Parsed Amendment Type from URL: {parsed_type_from_url} for #{amendment_num}"
                        )
                    else:
                        print(
                            f"Warn: URL segment '{type_code}' not in known AMENDMENT_TYPES: {item_data['url']}"
                        )
                else:
                    print(f"Warn: Unexpected Amend URL path: {item_data['url']}")
            except Exception as e:
                print(f"Error parsing Amend URL type: {e}")

        # Assign the parsed type if found
        if parsed_type_from_url:
            item_data["type"] = parsed_type_from_url
        else:
            # If URL parsing also fails, we can't proceed
            print(
                f"Warn: Cannot determine type for Amendment #{amendment_num} (skipping)"
            )
            return None

    # If it wasn't an amendment (no amendmentNumber), check for Bill
    elif bill_num is not None and original_type is not None and original_type != "None":
        item_data["item_type"] = "Bill"
        item_data["number"] = bill_num
        item_data["type"] = original_type  # Use the provided type for Bills
        item_data["title"] = item_data["title"] or f"Bill {original_type}{bill_num}"
    else:
        # If it doesn't match either pattern
        print(f"Warn: Unrecognized item format (skipping): {item}")
        return None
    # --- END: Corrected Logic ---

    return item_data


@cache.memoize(timeout=1800)
def get_sponsored_legislation(bioguide_id):
    """Fetches and parses recent sponsored legislation."""
    endpoint = f"/member/{bioguide_id}/sponsored-legislation"
    params = {"limit": 15}
    data, error = _make_api_request(endpoint, params=params)
    legislation_data = {"items": [], "error": error}
    item_list = None
    if data:
        for key in ["sponsoredLegislation", "legislation", "items"]:
            if key in data and isinstance(data.get(key), list):
                item_list = data[key]
                break
    if item_list:
        print(f"Processing {len(item_list)} sponsored items for {bioguide_id}...")
        for item in item_list:
            parsed_item = _parse_legislation_item(item)  # Use helper
            if parsed_item:
                legislation_data["items"].append(parsed_item)
    elif not error and data:
        print(f"No sponsored items found/key mismatch for {bioguide_id}.")
    return legislation_data


@cache.memoize(timeout=1800)
def get_cosponsored_legislation(bioguide_id):
    """Fetches and parses recent cosponsored legislation."""
    endpoint = f"/member/{bioguide_id}/cosponsored-legislation"
    params = {"limit": 15}
    data, error = _make_api_request(endpoint, params=params)
    legislation_data = {"items": [], "error": error}
    item_list = None
    if data:
        for key in ["cosponsoredLegislation", "legislation", "items"]:
            if key in data and isinstance(data.get(key), list):
                item_list = data[key]
                break
    if item_list:
        print(f"Processing {len(item_list)} cosponsored items for {bioguide_id}...")
        for item in item_list:
            parsed_item = _parse_legislation_item(item)  # Use helper
            if parsed_item:
                legislation_data["items"].append(parsed_item)
    elif not error and data:
        print(f"No cosponsored items/key mismatch for {bioguide_id}.")
    return legislation_data


@cache.memoize(timeout=86400)
def get_congress_list():
    """Fetches the list of available Congresses and extracts the number."""
    print("Fetching Congress list...")
    congresses_list = []
    data, error = _make_api_request("/congress")
    if error:
        print(f"Error fetching Congress list: {error}")
        return congresses_list
    if data and "congresses" in data and isinstance(data["congresses"], list):
        raw_congresses = data["congresses"]
        valid_congresses = []
        for item in raw_congresses:
            if isinstance(item, dict) and "url" in item:
                num = None
                url_path = urlparse(item["url"]).path.strip("/").split("/")
                try:
                    if url_path and url_path[-1].isdigit():
                        num = int(url_path[-1])
                    else:
                        name = item.get("name", "")
                        num_str = name.split("th Congress")[0]
                        num = (
                            int(num_str)
                            if "th Congress" in name and num_str.isdigit()
                            else None
                        )
                except (ValueError, TypeError, IndexError):
                    pass
                if num is not None:
                    item["number"] = num
                    valid_congresses.append(item)
        if valid_congresses:
            congresses_list = sorted(
                valid_congresses, key=lambda x: x.get("number", 0), reverse=True
            )
    return congresses_list


# --- Load Initial Data ---
print("Fetching initial Congress list...")
AVAILABLE_CONGRESSES = get_congress_list()
DEFAULT_CONGRESS = (
    AVAILABLE_CONGRESSES[0]["number"]
    if AVAILABLE_CONGRESSES and AVAILABLE_CONGRESSES[0].get("number")
    else None
)
print(
    f"Congresses: {[c.get('number', 'N/A') for c in AVAILABLE_CONGRESSES]}. Default: {DEFAULT_CONGRESS}"
)


# --- Flask Routes ---
@app.route("/api/members")
def get_members_list_data():
    """API endpoint to fetch member list based on filters."""
    congress_filter = request.args.get("congress") or (
        str(DEFAULT_CONGRESS) if DEFAULT_CONGRESS else None
    )
    if not congress_filter or not congress_filter.isdigit():
        return jsonify({"error": "Valid 'congress' query parameter required."}), 400
    members_dict = load_congress_members(congress_filter)
    if not members_dict:
        return (
            jsonify(
                {"error": f"Could not load members for Congress {congress_filter}."}
            ),
            500,
        )
    return jsonify(list(members_dict.values()))


@app.route("/")
def index():
    """Serves the main HTML page."""
    print("Serving index page...")
    states = sorted(
        [
            "Alabama",
            "Alaska",
            "Arizona",
            "Arkansas",
            "California",
            "Colorado",
            "Connecticut",
            "Delaware",
            "Florida",
            "Georgia",
            "Hawaii",
            "Idaho",
            "Illinois",
            "Indiana",
            "Iowa",
            "Kansas",
            "Kentucky",
            "Louisiana",
            "Maine",
            "Maryland",
            "Massachusetts",
            "Michigan",
            "Minnesota",
            "Mississippi",
            "Missouri",
            "Montana",
            "Nebraska",
            "Nevada",
            "New Hampshire",
            "New Jersey",
            "New Mexico",
            "New York",
            "North Carolina",
            "North Dakota",
            "Ohio",
            "Oklahoma",
            "Oregon",
            "Pennsylvania",
            "Rhode Island",
            "South Carolina",
            "South Dakota",
            "Tennessee",
            "Texas",
            "Utah",
            "Vermont",
            "Virginia",
            "Washington",
            "West Virginia",
            "Wisconsin",
            "Wyoming",
            "American Samoa",
            "District of Columbia",
            "Federated States of Micronesia",
            "Guam",
            "Marshall Islands",
            "Northern Mariana Islands",
            "Palau",
            "Puerto Rico",
            "Virgin Islands",
        ]
    )
    return render_template(
        "index.html",
        congresses=AVAILABLE_CONGRESSES,
        current_congress=DEFAULT_CONGRESS,
        states=states,
        chambers=["House", "Senate"],
    )


@app.route("/api/member/<bioguide_id>")
def get_member_data(bioguide_id):
    """API endpoint fetching all data for a specific member."""
    if not bioguide_id or len(bioguide_id) != 7:
        return jsonify({"error": "Invalid member ID."}), 400
    print(f"API call for member: {bioguide_id}")
    details_data = get_member_details(bioguide_id)
    sponsored_data = get_sponsored_legislation(bioguide_id)
    cosponsored_data = get_cosponsored_legislation(bioguide_id)
    combined = {
        "error": None,
        "member_details": details_data.get("details"),
        "member_details_error": details_data.get("error"),
        "committees": None,
        "committees_error": "Not implemented.",
        "sponsored_items": sponsored_data.get("items", []),
        "sponsored_items_error": sponsored_data.get("error"),
        "cosponsored_items": cosponsored_data.get("items", []),
        "cosponsored_items_error": cosponsored_data.get("error"),
        "votes": [],
        "votes_error": "Not implemented.",
    }
    details_err = details_data.get("error")
    status = (
        404
        if details_err
        and (
            "404" in details_err
            or "Not Found" in details_err
            or "Invalid" in details_err
        )
        else 200
    )
    if status == 404:
        combined["error"] = f"Member {bioguide_id} not found."
    print(f"Returning data for {bioguide_id}, status {status}")
    return jsonify(combined), status


# --- Placeholder routes ---
@app.route("/bills")
def bills_page():
    return "Not Implemented", 501


@app.route("/bill/<int:congress>/<bill_type>/<int:bill_number>")
def bill_detail_page(congress, bill_type, bill_number):
    return "Not Implemented", 501


# --- Main Execution ---
if __name__ == "__main__":
    cache_dir = app.config.get("CACHE_DIR", "flask_cache")
    os.makedirs(cache_dir, exist_ok=True)  # Ensure cache directory exists
    app.run(debug=True)
