# FILE: app.py
import os
import json
import requests
from flask import Flask, jsonify, render_template, request, abort
from flask_caching import Cache
from urllib.parse import urlparse

app = Flask(__name__)

# Cache Config
cache_config = {
    "CACHE_TYPE": "FileSystemCache",
    "CACHE_DIR": "flask_cache",
    "CACHE_DEFAULT_TIMEOUT": 3600,  # Cache most API calls for 1 hour
}
app.config.from_mapping(cache_config)
cache = Cache(app)

# API Key and Base URL
CONGRESS_GOV_API_KEY = os.environ.get("CONGRESS_GOV_API_KEY")
if not CONGRESS_GOV_API_KEY:
    print("CRITICAL WARNING: CONGRESS_GOV_API_KEY env var missing.")
API_BASE_URL = "https://api.congress.gov/v3"

# Define known types for validation
AMENDMENT_TYPES = {"samdt", "hamdt", "sa", "ha", "suamdt"}
BILL_TYPES = {"hr", "s", "hres", "sres", "hjres", "sjres", "hconres", "sconres"}

# Map Bill/Amendment Types to Congress.gov URL Paths
# Used for constructing links in get_bill_details/get_amendment_details
billTypePaths = {
    "HR": "house-bill",
    "S": "senate-bill",
    "HRES": "house-resolution",
    "SRES": "senate-resolution",
    "HJRES": "house-joint-resolution",
    "SJRES": "senate-joint-resolution",
    "HCONRES": "house-concurrent-resolution",
    "SCONRES": "senate-concurrent-resolution",
    "SAMDT": "senate-amendment",
    "HAMDT": "house-amendment",
    "SA": "senate-amendment",
    "HA": "house-amendment",
    "SUAMDT": "senate-unamendable-amendment",
}


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
    # Reduce console noise for repetitive calls like bill details
    # print(f"API Request: GET {url} PARAMS: {log_params}")
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
        error_msg = f"Timeout ({timeout}s) for {endpoint}"
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
            error_msg = f"API HTTP {status_code} for {endpoint}: {api_error_message}"
        except json.JSONDecodeError:
            error_msg = f"API HTTP {status_code} for {endpoint}: {error_text}"
        print(f"ERROR: {error_msg}")
        return None, error_msg
    except requests.exceptions.RequestException as e:
        error_msg = f"Network error for {endpoint}: {e}"
        print(f"ERROR: {error_msg}")
        return None, error_msg
    except json.JSONDecodeError as e:
        resp_text = response.text[:500] if response else "N/A"
        error_msg = f"JSON Error for {endpoint}: {e}. Resp: {resp_text}..."
        print(f"ERROR: {error_msg}")
        return None, error_msg
    except Exception as e:
        error_msg = f"Generic API Error for {endpoint}: {e}"
        print(f"ERROR: {error_msg}")
        return None, error_msg


# --- Bill/Amendment Detail Fetching ---
# get_bill_details: Keep existing (used for lists)
# get_amendment_details: Keep existing (used for lists)


# --- NEW: Function for Full Bill Data ---
@cache.memoize(timeout=7200)  # Cache full details for 2 hours
def get_full_bill_data(congress, bill_type, bill_number):
    """Fetches more comprehensive data for the bill detail page."""
    print(f"Fetching FULL details for Bill: {congress}-{bill_type}-{bill_number}")
    bill_type_lower = bill_type.lower()
    if bill_type_lower not in BILL_TYPES:
        return {"error": f"Invalid bill type: {bill_type}", "bill": None}

    base_endpoint = f"/bill/{congress}/{bill_type_lower}/{bill_number}"
    full_data = {
        "bill": None,
        "actions": None,
        "cosponsors": None,
        "committees": None,
        "summaries": None,
        "relatedBills": None,
        "error": None,
    }

    # 1. Get Base Bill Info (contains links to sub-resources)
    base_data, error = _make_api_request(base_endpoint)
    if error or not base_data or "bill" not in base_data:
        full_data["error"] = error or "Bill base data not found or invalid format."
        print(
            f"Error fetching base details for {congress}-{bill_type}-{bill_number}: {full_data['error']}"
        )
        return full_data

    full_data["bill"] = base_data["bill"]  # Store the main bill object

    # --- Optionally Fetch Sub-Resources (Example for Actions & Cosponsors) ---
    # For performance, only fetch if needed, or fetch limited amounts initially.
    # We'll fetch a small number here as an example.

    # Fetch Actions
    actions_url = full_data["bill"].get("actions", {}).get("url")
    if actions_url:
        actions_endpoint = urlparse(actions_url).path
        actions_data, actions_error = _make_api_request(
            actions_endpoint, params={"limit": 50}
        )  # Get recent actions
        if actions_error:
            print(f"Warn: Failed to fetch actions for {base_endpoint}: {actions_error}")
            # Store error or empty list? Let's store empty for now.
            full_data["actions"] = []
        elif actions_data and "actions" in actions_data:
            full_data["actions"] = actions_data["actions"]
        else:
            full_data["actions"] = []  # Store empty list if structure unexpected

    # Fetch Cosponsors
    cosponsors_url = full_data["bill"].get("cosponsors", {}).get("url")
    if cosponsors_url:
        cosponsors_endpoint = urlparse(cosponsors_url).path
        cosponsors_data, cosponsors_error = _make_api_request(
            cosponsors_endpoint, params={"limit": 50}
        )  # Get some cosponsors
        if cosponsors_error:
            print(
                f"Warn: Failed to fetch cosponsors for {base_endpoint}: {cosponsors_error}"
            )
            full_data["cosponsors"] = []
        elif cosponsors_data and "cosponsors" in cosponsors_data:
            full_data["cosponsors"] = cosponsors_data["cosponsors"]
        else:
            full_data["cosponsors"] = []

    # TODO: Add similar fetches for committees, summaries, relatedBills, text, titles if needed

    # Add congress.gov URL to main bill data for template convenience
    if full_data["bill"]:
        path_segment_key = full_data["bill"].get("type")
        path_segment = billTypePaths.get(path_segment_key)
        item_url = None
        if path_segment:
            item_url = f"https://www.congress.gov/bill/{congress}th-congress/{path_segment}/{bill_number}"
        full_data["bill"]["congressDotGovUrl"] = item_url

    return full_data


# --- Helper Functions ---
@cache.memoize(timeout=86400)  # Cache Bill details for a day
def get_bill_details(congress, bill_type, bill_number):
    """Fetches comprehensive details for a specific bill."""
    # print(f"Fetching details for Bill: {congress}-{bill_type}-{bill_number}") # Reduce logging
    bill_type_lower = bill_type.lower()
    if bill_type_lower not in BILL_TYPES:
        return {"error": f"Invalid bill type: {bill_type}"}

    base_endpoint = f"/bill/{congress}/{bill_type_lower}/{bill_number}"
    base_data, error = _make_api_request(base_endpoint)

    if error or not base_data or "bill" not in base_data:
        err_msg = error or "Bill base data not found or invalid format."
        print(
            f"Error fetching details for Bill {congress}-{bill_type}-{bill_number}: {err_msg}"
        )
        return {"error": err_msg}

    bill_data = base_data["bill"]
    latest_action = bill_data.get("latestAction", {})

    # Construct congress.gov URL safely
    path_segment_key = bill_data.get("type")  # Use type from response (e.g., "HR")
    path_segment = billTypePaths.get(path_segment_key)
    item_url = None
    if path_segment:
        item_url = f"https://www.congress.gov/bill/{congress}th-congress/{path_segment}/{bill_number}"
    else:
        print(
            f"Warning: Could not generate congress.gov URL for bill type {path_segment_key}"
        )

    details = {
        "congress": bill_data.get("congress"),
        "number": bill_data.get("number"),
        "type": bill_data.get("type"),
        "title": bill_data.get("title", "No Title Provided"),
        "introduced_date": bill_data.get("introducedDate"),
        "latest_action_text": latest_action.get("text"),
        "latest_action_date": latest_action.get("actionDate"),
        "url": item_url,  # Use generated congress.gov URL
        "cosponsors_count": bill_data.get("cosponsors", {}).get("count", 0),
        "actions_count": bill_data.get("actions", {}).get("count", 0),
        "committees_count": bill_data.get("committees", {}).get("count", 0),
        "error": None,
    }
    return details


@cache.memoize(timeout=86400)  # Cache Amendment details for a day
def get_amendment_details(congress, amendment_type, amendment_number):
    """Fetches comprehensive details for a specific amendment."""
    # print(f"Fetching details for Amendment: {congress}-{amendment_type}-{amendment_number}") # Reduce logging
    amendment_type_lower = amendment_type.lower()
    if amendment_type_lower not in AMENDMENT_TYPES:
        return {"error": f"Invalid amendment type: {amendment_type}"}

    base_endpoint = f"/amendment/{congress}/{amendment_type_lower}/{amendment_number}"
    base_data, error = _make_api_request(base_endpoint)

    if error or not base_data or "amendment" not in base_data:
        err_msg = error or "Amendment base data not found or invalid format."
        print(
            f"Error fetching details for Amdt {congress}-{amendment_type}-{amendment_number}: {err_msg}"
        )
        return {"error": err_msg}

    amendment_data = base_data["amendment"]
    latest_action = amendment_data.get("latestAction", {})

    # Construct congress.gov URL safely
    path_segment_key = amendment_data.get(
        "type"
    )  # Use type from response (e.g., "SAMDT")
    path_segment = billTypePaths.get(path_segment_key)
    item_url = None
    if path_segment:
        item_url = f"https://www.congress.gov/amendment/{congress}th-congress/{path_segment}/{amendment_number}"
    else:
        print(
            f"Warning: Could not generate congress.gov URL for amendment type {path_segment_key}"
        )

    details = {
        "congress": amendment_data.get("congress"),
        "number": amendment_data.get("number"),  # API uses 'number' here
        "type": amendment_data.get("type"),
        "title": amendment_data.get(
            "purpose",
            f"Amendment {amendment_data.get('type', '?')} {amendment_data.get('number', '?')}",
        ),
        "introduced_date": amendment_data.get("proposedDate")
        or amendment_data.get("submittedDate"),
        "latest_action_text": latest_action.get("text"),
        "latest_action_date": latest_action.get("actionDate"),
        "url": item_url,  # Use generated congress.gov URL
        "cosponsors_count": amendment_data.get("cosponsors", {}).get("count", 0),
        "actions_count": amendment_data.get("actions", {}).get("count", 0),
        "error": None,
    }
    return details


# --- Modified function to IDENTIFY legislation from list item ---
# (No changes needed from previous version)
def _identify_legislation_item(item):
    """
    Helper to IDENTIFY item type, number, congress, and type code from list data.
    Focuses on identification needed to fetch details later.
    """
    if not isinstance(item, dict):
        print(f"Warn: Non-dict item in list: {item}")
        return None

    url = item.get("url")
    congress = item.get("congress")
    number = item.get("number")  # Bill number or Amendment number depending on context

    if not url or not congress or number is None:
        # Try to get number from title if missing (e.g. some amendment list items?)
        # This is less reliable
        # title = item.get('title', '')
        # if not number and item.get('amendmentNumber') is not None:
        #     number = item.get('amendmentNumber')

        # If still missing essential info, log and return None
        if not url or not congress or number is None:
            print(
                f"Warn: Missing essential fields (url, congress, number) in list item: {item}"
            )
            return None

    try:
        parsed_url = urlparse(url)
        path_segments = parsed_url.path.strip("/").split("/")
        # Expected URL structures:
        # /v3/bill/{congress}/{type}/{number}?format=json
        # /v3/amendment/{congress}/{type}/{number}?format=json

        if len(path_segments) < 5:
            print(f"Warn: Unexpected URL structure (too short): {url}")
            return None

        item_kind = path_segments[1].lower()  # 'bill' or 'amendment'
        type_code = path_segments[3].lower()  # e.g., 'hr', 's', 'samdt', 'hamdt'
        url_number_str = path_segments[4]

        # Basic validation
        if not url_number_str.isdigit():
            print(f"Warn: Non-numeric number in URL path: {url}")
            return None
        url_number = int(url_number_str)

        # Ensure URL number matches list item number if list number exists
        if number is not None and url_number != number:
            print(
                f"Warn: Mismatch between list number ({number}) and URL number ({url_number}) in {url}. Trusting URL."
            )
            # Decide whether to trust URL or list item number. Let's trust the URL path structure more.

        number_to_use = url_number  # Use number from URL path

        identity = {
            "congress": congress,
            "number": number_to_use,
            "type": None,  # Determined below
            "item_type": None,  # Determined below
        }

        if item_kind == "bill" and type_code in BILL_TYPES:
            identity["item_type"] = "Bill"
            identity["type"] = type_code.upper()
        elif item_kind == "amendment" and type_code in AMENDMENT_TYPES:
            identity["item_type"] = "Amendment"
            identity["type"] = type_code.upper()
        else:
            print(
                f"Warn: Unrecognized item kind '{item_kind}' or type code '{type_code}' in URL: {url}"
            )
            return None

        return identity

    except Exception as e:
        print(f"Error identifying legislation from URL {url}: {e}")
        return None


# --- Functions to get DETAILED sponsored/cosponsored items ---
# (No changes needed from previous version)
@cache.memoize(timeout=1800)  # Cache the *list* of detailed items for 30 mins
def get_detailed_sponsored_legislation(bioguide_id):
    """Fetches list and then gets full details for each sponsored item."""
    endpoint = f"/member/{bioguide_id}/sponsored-legislation"
    params = {"limit": 15}  # Limit initial list fetch
    list_data, error = _make_api_request(endpoint, params=params)
    detailed_items = []
    item_list = None

    if error:
        return {
            "items": [],
            "error": error,
            "count": 0,
        }  # Return error if list fetch fails

    if list_data:
        # API response key can vary, check common keys
        for key in ["sponsoredLegislation", "legislation", "items"]:
            if key in list_data and isinstance(list_data.get(key), list):
                item_list = list_data[key]
                break

    total_count_from_api = 0
    if list_data and isinstance(list_data.get("pagination"), dict):
        total_count_from_api = list_data["pagination"].get("count", 0)
    elif item_list is not None:
        total_count_from_api = len(item_list)  # Fallback if pagination count missing

    if item_list:
        print(
            f"Fetching details for {len(item_list)} sponsored items (of {total_count_from_api} total) for {bioguide_id}..."
        )
        for item in item_list:
            identity = _identify_legislation_item(item)
            if not identity:
                continue  # Skip if cannot identify

            details = None
            if identity["item_type"] == "Bill":
                details = get_bill_details(
                    identity["congress"], identity["type"], identity["number"]
                )
            elif identity["item_type"] == "Amendment":
                details = get_amendment_details(
                    identity["congress"], identity["type"], identity["number"]
                )

            if details and not details.get("error"):
                # Add the basic item_type info for frontend convenience
                details["item_type"] = identity["item_type"]
                detailed_items.append(details)
            else:
                # Log error but continue processing others
                err_msg = (
                    details.get("error") if details else "Unknown detail fetch error"
                )
                print(
                    f"Warn: Failed to fetch details for {identity.get('item_type', '?')} {identity.get('congress', '?')}-{identity.get('type', '?')}-{identity.get('number', '?')}: {err_msg}"
                )
                # Optionally add placeholder with error? For now, skip failed items.
    else:
        print(
            f"No sponsored items list found or key mismatch for {bioguide_id}. Response: {list_data}"
        )

    return {
        "items": detailed_items,
        "error": None,
        "count": total_count_from_api,
    }  # Return total count from API


@cache.memoize(timeout=1800)  # Cache the *list* of detailed items for 30 mins
def get_detailed_cosponsored_legislation(bioguide_id):
    """Fetches list and then gets full details for each cosponsored item."""
    endpoint = f"/member/{bioguide_id}/cosponsored-legislation"
    params = {"limit": 15}
    list_data, error = _make_api_request(endpoint, params=params)
    detailed_items = []
    item_list = None

    if error:
        return {"items": [], "error": error, "count": 0}

    if list_data:
        for key in ["cosponsoredLegislation", "legislation", "items"]:
            if key in list_data and isinstance(list_data.get(key), list):
                item_list = list_data[key]
                break

    total_count_from_api = 0
    if list_data and isinstance(list_data.get("pagination"), dict):
        total_count_from_api = list_data["pagination"].get("count", 0)
    elif item_list is not None:
        total_count_from_api = len(item_list)  # Fallback

    if item_list:
        print(
            f"Fetching details for {len(item_list)} cosponsored items (of {total_count_from_api} total) for {bioguide_id}..."
        )
        for item in item_list:
            identity = _identify_legislation_item(item)
            if not identity:
                continue

            details = None
            if identity["item_type"] == "Bill":
                details = get_bill_details(
                    identity["congress"], identity["type"], identity["number"]
                )
            elif identity["item_type"] == "Amendment":
                details = get_amendment_details(
                    identity["congress"], identity["type"], identity["number"]
                )

            if details and not details.get("error"):
                details["item_type"] = identity["item_type"]  # Add item_type
                detailed_items.append(details)
            else:
                err_msg = (
                    details.get("error") if details else "Unknown detail fetch error"
                )
                print(
                    f"Warn: Failed to fetch details for {identity.get('item_type', '?')} {identity.get('congress', '?')}-{identity.get('type', '?')}-{identity.get('number', '?')}: {err_msg}"
                )
    else:
        print(
            f"No cosponsored items list found or key mismatch for {bioguide_id}. Response: {list_data}"
        )

    return {
        "items": detailed_items,
        "error": None,
        "count": total_count_from_api,
    }  # Return total count


# --- Member Loading and Details (No changes needed from previous version) ---
@cache.memoize(timeout=43200)  # Cache members list for 12 hours
def load_congress_members(congress_num=None):
    """Loads member list, optionally filtered by Congress."""
    print(f"Loading members (Congress: {congress_num or 'All'})...")
    members_data = {}
    limit = 250  # Max limit per API docs
    offset = 0
    all_members = []

    endpoint = "/member"
    if congress_num:
        endpoint = f"/member/congress/{congress_num}"

    while True:
        params = {"limit": limit, "offset": offset}
        # print(f"Fetching members batch: offset={offset}") # Reduce noise
        data, error = _make_api_request(endpoint, params=params)

        if error:
            print(f"ERROR loading members batch: {error}")
            return {}  # Return empty if error occurs

        if not data or "members" not in data or not isinstance(data["members"], list):
            print(f"Warn: Bad member data struct or empty batch at offset {offset}.")
            break

        members_batch = data["members"]
        if not members_batch:
            # print("No more members found.")
            break

        all_members.extend(members_batch)
        # print(f"Fetched {len(members_batch)} members in this batch. Total so far: {len(all_members)}")

        offset += limit

        if len(members_batch) < limit:
            # print("Last batch fetched.")
            break
        if offset >= 3000:  # Arbitrary safety limit
            print("WARN: Reached arbitrary member fetch limit (3000). Stopping.")
            break

    # print(f"Processing {len(all_members)} total members...") # Reduce noise
    for member in all_members:
        if not isinstance(member, dict):
            continue
        bioguide_id = member.get("bioguideId")
        if not bioguide_id:
            continue

        member_name = member.get("name", f"Unknown ({bioguide_id})")
        party_name = member.get("partyName", "")
        p_code = "ID"
        if party_name == "Democratic":
            p_code = "D"
        elif party_name == "Republican":
            p_code = "R"

        state = member.get("state")
        district = member.get("district")
        chamber = None
        terms = member.get("terms", {}).get("item", [])
        if terms and isinstance(terms, list):
            try:
                sorted_terms = sorted(
                    terms, key=lambda t: t.get("startYear", 0), reverse=True
                )
                if sorted_terms:
                    chamber_full = sorted_terms[0].get("chamber")
                    if chamber_full and "House" in chamber_full:
                        chamber = "House"
                    elif chamber_full and "Senate" in chamber_full:
                        chamber = "Senate"
            except Exception as e:
                print(f"Warn: Error processing terms for {bioguide_id}: {e}")
                pass

        if not chamber:
            if district is not None:
                chamber = "House"
            elif state is not None:
                chamber = "Senate"

        member_congress = member.get("congress") or congress_num

        members_data[bioguide_id] = {
            "name": member_name,
            "bioguide_id": bioguide_id,
            "state": state,
            "party": party_name,
            "party_code": p_code,
            "chamber": chamber,
            "congress": member_congress,
        }
    print(
        f"Finished loading {len(members_data)} unique members for Congress {congress_num}."
    )
    return members_data


@cache.memoize(timeout=3600)  # Cache member details for 1 hour
def get_member_details(bioguide_id):
    """Fetches detailed info for a member. Now includes partyHistory."""
    endpoint = f"/member/{bioguide_id}"
    data, error = _make_api_request(endpoint)
    payload = {"details": None, "error": error}
    if data and "member" in data and isinstance(data["member"], dict):
        m_data = data["member"]
        p_name = "Unknown"
        p_hist = m_data.get("partyHistory")
        if isinstance(p_hist, list) and p_hist:
            try:
                sorted_hist = sorted(
                    p_hist,
                    key=lambda x: x.get("startYear", 0) if isinstance(x, dict) else 0,
                    reverse=True,
                )
                if sorted_hist:
                    last_p = sorted_hist[0]
                    p_name = (
                        last_p.get("partyName", "?")
                        if isinstance(last_p, dict)
                        else p_name
                    )
            except Exception as e:
                print(f"Warn: Error processing party history for {bioguide_id}: {e}")
                p_name = m_data.get("partyName", "?")
        elif m_data.get("partyName"):
            p_name = m_data.get("partyName")

        # Sort terms descending by congress, then start year
        terms_list = m_data.get("terms", [])
        if isinstance(terms_list, list):
            try:
                terms_list.sort(
                    key=lambda t: (t.get("congress", 0), t.get("startYear", 0)),
                    reverse=True,
                )
            except Exception:
                print(f"Warn: Could not sort terms for {bioguide_id}")

        payload["details"] = {
            "name": m_data.get("directOrderName")
            or m_data.get("invertedOrderName")
            or m_data.get("name"),
            "bioguide_id": m_data.get("bioguideId"),
            "state": m_data.get("state"),
            "party": p_name,
            "birth_year": m_data.get("birthYear"),
            "leadership": m_data.get("leadership", []),
            "website_url": m_data.get("officialWebsiteUrl")
            or m_data.get("directUrl")
            or m_data.get("url"),
            "terms": terms_list,  # Use sorted list
            "partyHistory": m_data.get("partyHistory", []),
            "depiction": m_data.get("depiction"),
            "honorificName": m_data.get("honorificName"),
        }
    elif not error:
        payload["error"] = (
            f"Member detail API response format invalid. Keys:{list(data.keys()) if isinstance(data, dict) else 'N/A'}"
        )
        print(f"ERROR: Invalid member detail structure for {bioguide_id}: {data}")

    return payload


# --- Congress List Loading (No changes needed) ---
@cache.memoize(timeout=86400)
def get_congress_list():
    """Fetches the list of available Congresses."""
    print("Fetching Congress list...")
    congresses_list = []
    data, error = _make_api_request("/congress")
    if error:
        print(f"Error fetching Congress list: {error}")
        return congresses_list  # Return empty on error
    if data and "congresses" in data and isinstance(data["congresses"], list):
        raw_congresses = data["congresses"]
        valid_congresses = []
        for item in raw_congresses:
            if not isinstance(item, dict):
                continue
            num = None
            name = item.get("name", "")
            if "th Congress" in name:
                try:
                    num_str = name.split("th Congress")[0]
                    if num_str.isdigit():
                        num = int(num_str)
                except Exception as e:
                    print(
                        f"Warn: Error parsing congress number from name '{name}': {e}"
                    )
                    pass
            if num is None and "url" in item:
                try:
                    url_path = urlparse(item["url"]).path.strip("/").split("/")
                    if url_path and url_path[-1].isdigit():
                        num = int(url_path[-1])
                except Exception as e:
                    print(
                        f"Warn: Error parsing congress number from URL '{item['url']}': {e}"
                    )
                    pass
            if num is not None:
                item["number"] = num
                item["startYear"] = item.get("startYear")
                item["endYear"] = item.get("endYear")
                valid_congresses.append(item)
            else:
                print(f"Warn: Could not determine congress number for: {item}")
        if valid_congresses:
            congresses_list = sorted(
                valid_congresses, key=lambda x: x.get("number", 0), reverse=True
            )
            print(f"Successfully parsed {len(congresses_list)} congresses.")
    else:
        print(f"Warn: Congress list not found or invalid format: {data}")
    return congresses_list


@cache.memoize(timeout=3600)  # Cache committee lists for 1 hour
def get_committees_list(congress=None, chamber=None, offset=0, limit=20):
    """Fetches a list of committees based on optional filters."""
    print(
        f"Fetching committees list: Congress={congress}, Chamber={chamber}, Offset={offset}, Limit={limit}"
    )

    # Determine the correct API endpoint path
    if congress and chamber:
        endpoint = f"/committee/{congress}/{chamber.lower()}"
    elif congress:
        endpoint = f"/committee/{congress}"
    elif chamber:
        endpoint = f"/committee/{chamber.lower()}"
    else:
        endpoint = "/committee"  # List all committees

    params = {"offset": offset, "limit": limit}
    data, error = _make_api_request(endpoint, params=params)

    if error:
        return {"committees": [], "pagination": None, "error": error}
    if not data or not isinstance(data.get("committees"), list):
        err_msg = (
            data.get("message", "Invalid committee list format from API.")
            if isinstance(data, dict)
            else "Invalid committee list format from API."
        )
        return {"committees": [], "pagination": None, "error": err_msg}

    # Add internal detail page link to each committee
    processed_committees = []
    for committee in data.get("committees", []):
        if isinstance(committee, dict):
            comm_chamber = committee.get("chamber")
            comm_code = committee.get("systemCode")
            if comm_chamber and comm_code:
                committee["detailPageUrl"] = (
                    f"/committee/{comm_chamber.lower()}/{comm_code}"
                )
            else:
                committee["detailPageUrl"] = None
            processed_committees.append(committee)

    return {
        "committees": processed_committees,
        "pagination": data.get("pagination"),
        "error": None,
    }


@cache.memoize(timeout=7200)  # Cache committee details for 2 hours
def get_committee_details(chamber, committee_code):
    """Fetches detailed information for a specific committee."""
    print(f"Fetching committee details for: {chamber}/{committee_code}")
    if chamber not in ["house", "senate", "joint"]:
        return {"committee": None, "error": "Invalid chamber specified."}

    endpoint = f"/committee/{chamber.lower()}/{committee_code}"
    data, error = _make_api_request(endpoint)

    if error:
        return {"committee": None, "error": error}
    if not data or not isinstance(data.get("committee"), dict):
        err_msg = (
            data.get("message", "Invalid committee detail format from API.")
            if isinstance(data, dict)
            else "Invalid committee detail format from API."
        )
        return {"committee": None, "error": err_msg}

    committee_data = data["committee"]

    # Optionally add a direct congress.gov link if derivable
    # (Requires knowing the base URL structure, which isn't in the API response)
    # Example: committee_data["congressDotGovUrl"] = f"https://www.congress.gov/committee/{chamber}-committee/{committee_code_maybe_formatted}"

    return {"committee": committee_data, "error": None}


# --- Load Initial Data ---
print("Fetching initial Congress list...")
AVAILABLE_CONGRESSES = get_congress_list()
DEFAULT_CONGRESS = None
if (
    AVAILABLE_CONGRESSES
    and isinstance(AVAILABLE_CONGRESSES, list)
    and len(AVAILABLE_CONGRESSES) > 0
):
    first_congress = AVAILABLE_CONGRESSES[0]
    if isinstance(first_congress, dict) and first_congress.get("number"):
        DEFAULT_CONGRESS = first_congress["number"]

if not DEFAULT_CONGRESS:
    print("CRITICAL WARNING: Could not determine default/current Congress number.")
    DEFAULT_CONGRESS = 118  # Temporary fallback
    print(f"Using fallback default Congress: {DEFAULT_CONGRESS}")
else:
    print(
        f"Available Congresses: {[c.get('number', 'N/A') for c in AVAILABLE_CONGRESSES]}. Default: {DEFAULT_CONGRESS}"
    )


# Route for the main page
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


# Route for fetching the filtered member list
@app.route("/api/members")
def get_members_list_data():
    """API endpoint to fetch member list based on filters."""
    congress_filter = request.args.get("congress") or (
        str(DEFAULT_CONGRESS) if DEFAULT_CONGRESS else None
    )
    if not congress_filter or not congress_filter.isdigit():
        if DEFAULT_CONGRESS:
            congress_filter = str(DEFAULT_CONGRESS)
        else:
            return jsonify({"error": "Valid 'congress' query parameter required."}), 400

    print(f"API: Loading members list for congress: {congress_filter}")
    members_dict = load_congress_members(congress_filter)
    if not members_dict:
        is_valid_congress = any(
            c.get("number") == int(congress_filter)
            for c in AVAILABLE_CONGRESSES
            if isinstance(c, dict)
        )
        error_msg = (
            f"Invalid Congress number requested: {congress_filter}."
            if not is_valid_congress
            else f"Could not load members for Congress {congress_filter}."
        )
        status_code = 400 if not is_valid_congress else 503
        return jsonify({"error": error_msg}), status_code
    return jsonify(list(members_dict.values()))


@app.route("/api/member/<bioguide_id>/details")
def get_member_details_api(bioguide_id):
    """API: Fetches basic details for a specific member."""
    if not bioguide_id or len(bioguide_id) != 7:
        return jsonify({"error": "Invalid Bioguide ID format."}), 400
    print(f"API: Fetching details for member: {bioguide_id}")
    details_data = get_member_details(bioguide_id)
    status = 200
    if details_data.get("error"):
        error_lower = details_data["error"].lower()
        if (
            "not found" in error_lower
            or "invalid" in error_lower
            or "404" in error_lower
        ):
            status = 404
        elif "api key" in error_lower:
            status = 500  # Indicate server-side issue
        # else keep 200, error is in payload
    return jsonify(details_data), status


@app.route("/api/member/<bioguide_id>/sponsored")
def get_member_sponsored_api(bioguide_id):
    """API: Fetches detailed sponsored legislation for a member."""
    if not bioguide_id or len(bioguide_id) != 7:
        return (
            jsonify({"error": "Invalid Bioguide ID format.", "items": [], "count": 0}),
            400,
        )
    print(f"API: Fetching sponsored legislation for member: {bioguide_id}")
    sponsored_data = get_detailed_sponsored_legislation(bioguide_id)
    status = (
        500
        if sponsored_data.get("error") and "API Key" in sponsored_data["error"]
        else 200
    )
    return jsonify(sponsored_data), status


@app.route("/api/member/<bioguide_id>/cosponsored")
def get_member_cosponsored_api(bioguide_id):
    """API: Fetches detailed cosponsored legislation for a member."""
    if not bioguide_id or len(bioguide_id) != 7:
        return (
            jsonify({"error": "Invalid Bioguide ID format.", "items": [], "count": 0}),
            400,
        )
    print(f"API: Fetching cosponsored legislation for member: {bioguide_id}")
    cosponsored_data = get_detailed_cosponsored_legislation(bioguide_id)
    status = (
        500
        if cosponsored_data.get("error") and "API Key" in cosponsored_data["error"]
        else 200
    )
    return jsonify(cosponsored_data), status


# Page Route
@app.route("/bills")
def bills_page():
    """Serves the HTML page for browsing bills."""
    print("Serving browse bills page...")
    # Get available bill types for the filter dropdown
    bill_types_list = [
        {"code": k, "name": k.upper()} for k in sorted(BILL_TYPES)
    ]  # Simple list for now
    return render_template(
        "browse_bills.html",
        congresses=AVAILABLE_CONGRESSES,
        current_congress=DEFAULT_CONGRESS,
        bill_types=bill_types_list,
    )


# API Route
@app.route("/api/bills")
def get_bills_list_api():
    """API endpoint to fetch list of bills based on filters, using correct API paths."""
    # Read arguments with defaults
    congress = request.args.get("congress", default=None, type=str)
    bill_type = request.args.get(
        "billType", default=None, type=str
    )  # Can be None/empty for "All Types"
    offset = request.args.get("offset", default=0, type=int)
    limit = request.args.get("limit", default=20, type=int)  # Default to 20 per page
    # <<< REMOVED: sort parameter reading >>>

    # --- Validation ---
    valid_congress_numbers = [
        c.get("number") for c in AVAILABLE_CONGRESSES if isinstance(c, dict)
    ]

    # Congress is required for filtering beyond the base /bill endpoint
    if (
        not congress
        or not congress.isdigit()
        or int(congress) not in valid_congress_numbers
    ):
        # If no valid congress provided, should we default or error?
        # Let's default to the /bill endpoint (all congresses) if congress isn't specified or valid.
        # This might be slow, consider requiring congress on the frontend?
        # For now, let's require it or use default from frontend's perspective.
        # If the request *specifically* targets /api/bills without a congress param, it implies /bill.
        # Let's assume frontend *always* sends a congress parameter from now on.
        if not congress:  # If specifically missing
            congress = str(DEFAULT_CONGRESS)  # Force default if missing
            print(f"Warning: No congress provided, using default {DEFAULT_CONGRESS}")
        elif not congress.isdigit() or int(congress) not in valid_congress_numbers:
            print(
                f"Warning: Invalid congress '{congress}', falling back to default {DEFAULT_CONGRESS}"
            )
            congress = str(DEFAULT_CONGRESS)

    # Validate optional bill type
    if bill_type and bill_type.lower() not in BILL_TYPES:
        print(f"Warning: Invalid billType '{bill_type}', ignoring.")
        bill_type = None  # Treat invalid type as "All types" for the selected congress

    if limit > 100 or limit < 1:
        limit = 20  # Sensible limits
    if offset < 0:
        offset = 0

    # --- Construct CORRECT Congress.gov API Endpoint Path ---
    # Based on provided parameters, map to documented endpoints:
    # GET /bill
    # GET /bill/{congress}
    # GET /bill/{congress}/{billType}
    if congress:
        endpoint = f"/bill/{congress}"
        if bill_type:
            endpoint += f"/{bill_type.lower()}"
    else:
        # This case should ideally be prevented by frontend requiring congress selection
        # or backend defaulting, but as a fallback:
        endpoint = (
            "/bill"  # Get all bills across all congresses (potentially very slow)
        )
        print("Warning: Fetching from base /bill endpoint (no congress specified).")

    # Parameters for the API call (limit, offset)
    # Sorting is handled by the API's default (latest action)
    params = {
        "limit": limit,
        "offset": offset,
        # <<< NO 'sort' parameter >>>
    }

    print(f"API: Fetching bills list - Endpoint: {endpoint}, Params: {params}")
    data, error = _make_api_request(endpoint, params=params)

    # --- Response Handling (mostly unchanged, checks structure) ---
    if error:
        status_code = 500
        if error is not None:  # Ensure error is not None before checking content
            if "API HTTP 404" in error:
                status_code = 404
            elif "API Key" in error:
                status_code = 401  # Check case-insensitively later if needed
        return jsonify({"error": error, "bills": [], "pagination": None}), status_code

    # Check for valid structure or API message
    if not data or (not isinstance(data.get("bills"), list) and "message" not in data):
        err_msg = (
            data.get("message", "Invalid response format from API.")
            if isinstance(data, dict)
            else "Invalid response format from API."
        )
        print(f"Error: Invalid API response structure for {endpoint}. Response: {data}")
        # If the API returns a specific message (like rate limit), pass it through
        return jsonify({"error": err_msg, "bills": [], "pagination": None}), 500

    # Process bills (add links) - ensure robust access
    processed_bills = []
    for bill in data.get("bills", []):  # Use .get with default
        if isinstance(bill, dict):
            b_type = bill.get("type")
            b_num = bill.get("number")
            b_cong = bill.get("congress")
            path_segment = billTypePaths.get(b_type)
            # Construct internal detail page link
            if b_type and b_num is not None and b_cong is not None:
                bill["detailPageUrl"] = (
                    f"/bill/{b_cong}/{b_type}/{b_num}"  # Internal link
                )
            else:
                bill["detailPageUrl"] = None
            # Construct congress.gov link
            if path_segment and b_num is not None and b_cong is not None:
                bill["congressDotGovUrl"] = (
                    f"https://www.congress.gov/bill/{b_cong}th-congress/{path_segment}/{b_num}"
                )
            else:
                bill["congressDotGovUrl"] = None
            processed_bills.append(bill)

    # Return data including pagination info
    return (
        jsonify(
            {
                "bills": processed_bills,
                "pagination": data.get("pagination"),
                "error": None,
            }
        ),
        200,
    )


# --- UPDATED: Bill Detail Route ---
@app.route("/bill/<int:congress>/<bill_type>/<int:bill_number>")
def bill_detail_page(congress, bill_type, bill_number):
    """Serves the detail page for a specific bill."""
    print(f"Serving detail page for Bill: {congress}-{bill_type}-{bill_number}")

    # Basic validation
    bill_type_lower = bill_type.lower()
    if bill_type_lower not in BILL_TYPES:
        abort(404, description="Invalid bill type provided.")

    # Fetch comprehensive data
    bill_data = get_full_bill_data(congress, bill_type_lower, bill_number)

    if bill_data.get("error"):
        # Distinguish between 'not found' and other errors
        err_msg = bill_data["error"]
        if "not found" in err_msg.lower() or "404" in err_msg:
            abort(
                404, description=f"Bill {congress}-{bill_type}-{bill_number} not found."
            )
        else:
            # Render an error page or display error on the detail page?
            # For now, let's pass the error to the template
            return render_template(
                "bill_detail.html",
                bill_data=None,
                error=f"Error fetching bill details: {err_msg}",
            )

    if not bill_data.get("bill"):
        abort(500, description="Failed to retrieve bill data structure.")

    return render_template("bill_detail.html", bill_data=bill_data, error=None)


@app.route("/api/committees")
def get_committees_list_api():
    """API endpoint to fetch list of committees based on filters."""
    congress = request.args.get("congress", default=None, type=str)
    chamber = request.args.get(
        "chamber", default=None, type=str
    )  # Expect 'house', 'senate', 'joint', or None/""
    offset = request.args.get("offset", default=0, type=int)
    limit = request.args.get("limit", default=25, type=int)  # Increase default slightly

    # Validate Chamber
    valid_chambers = ["house", "senate", "joint"]
    if chamber and chamber.lower() not in valid_chambers:
        print(f"Warning: Invalid chamber '{chamber}', ignoring.")
        chamber = None

    # Validate Congress (optional, if provided)
    if congress:
        valid_congress_numbers = [
            c.get("number") for c in AVAILABLE_CONGRESSES if isinstance(c, dict)
        ]
        if not congress.isdigit() or int(congress) not in valid_congress_numbers:
            print(f"Warning: Invalid congress '{congress}', ignoring.")
            congress = None  # Treat invalid congress as no congress filter

    if limit > 100 or limit < 1:
        limit = 25
    if offset < 0:
        offset = 0

    # Fetch data using the helper function
    result = get_committees_list(
        congress=congress, chamber=chamber, offset=offset, limit=limit
    )

    status_code = 500 if result.get("error") else 200
    if result.get("error") and "API HTTP 404" in result["error"]:
        status_code = 404  # Not found (maybe invalid combo?)

    return jsonify(result), status_code


# --- NEW: Browse Committees Page Route ---
@app.route("/committees")
def committees_page():
    """Serves the HTML page for browsing committees."""
    print("Serving browse committees page...")
    # Provide data needed for filters in the template
    return render_template(
        "browse_committees.html",
        congresses=AVAILABLE_CONGRESSES,
        current_congress=DEFAULT_CONGRESS,  # For default selection
        chambers=[  # Provide options for chamber filter
            {"code": "", "name": "All Chambers"},
            {"code": "house", "name": "House"},
            {"code": "senate", "name": "Senate"},
            {"code": "joint", "name": "Joint"},
        ],
    )


# --- NEW: Committee Detail Page Route ---
@app.route("/committee/<chamber>/<committee_code>")
def committee_detail_page(chamber, committee_code):
    """Serves the detail page for a specific committee."""
    print(f"Serving detail page for Committee: {chamber}/{committee_code}")

    chamber_lower = chamber.lower()
    if chamber_lower not in ["house", "senate", "joint"]:
        abort(404, description="Invalid chamber specified.")
    if not committee_code or len(committee_code) < 4:
        abort(404, description="Invalid committee code format.")

    committee_data = get_committee_details(
        chamber_lower, committee_code
    )  # Fetches data

    if committee_data.get("error"):
        err_msg = committee_data["error"]
        if "not found" in err_msg.lower() or "404" in err_msg:
            abort(404, description=f"Committee {chamber}/{committee_code} not found.")
        else:
            # Pass the known chamber even on error for consistent header rendering maybe?
            return render_template(
                "committee_detail.html",
                committee=None,
                error=f"Error fetching committee details: {err_msg}",
                chamber_arg=chamber_lower,
            )  # Pass chamber arg

    if not committee_data.get("committee"):
        abort(500, description="Failed to retrieve committee data structure.")

    # --- Pass committee data AND the chamber argument to the template ---
    return render_template(
        "committee_detail.html",
        committee=committee_data["committee"],
        error=None,
        chamber_arg=chamber_lower,
    )  # Pass the validated lower-case chamber


# --- Main Execution ---
if __name__ == "__main__":
    cache_dir = app.config.get("CACHE_DIR", "flask_cache")
    os.makedirs(cache_dir, exist_ok=True)
    print(f"Flask Cache directory: {os.path.abspath(cache_dir)}")
    app.run(debug=True)  # Debug=True is helpful for development
