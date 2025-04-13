# FILE: app/services.py
from flask import current_app
from urllib.parse import urlparse

# Import shared components
from . import cache
from .utils import _make_api_request

FETCH_ALL_LIMIT = 250


# --- Helper to fetch sub-resources ---
def _fetch_sub_resource(base_item, resource_key, api_path_segment_base, limit=20):
    """Fetches a limited list from a sub-resource URL found in a base item."""
    resource_info = base_item.get(resource_key, {})
    if not isinstance(resource_info, dict) or not resource_info.get("url"):
        return None
    count = resource_info.get("count", 0)
    api_url = resource_info.get("url")
    if count == 0:
        return []

    try:
        parsed_url = urlparse(api_url)
        path_with_v3 = parsed_url.path  # e.g., /v3/bill/118/hr/9775/actions

        # --- FIX: Remove leading /v3 from the path before passing to _make_api_request ---
        endpoint = path_with_v3
        if endpoint.startswith("/v3/"):
            endpoint = endpoint[
                3:
            ]  # Remove the leading '/v3' -> /bill/118/hr/9775/actions
        # --- End FIX ---

        # Basic check if path looks reasonable after stripping /v3
        known_bases = ["/bill/", "/amendment/", "/committee/", "/nomination/"]
        if not any(endpoint.startswith(base) for base in known_bases):
            # Log the original URL and the derived endpoint for debugging
            current_app.logger.warning(
                f"Sub-resource URL '{api_url}' resulted in potentially unexpected endpoint '{endpoint}'"
            )
            # Proceeding anyway, but this might indicate an issue with the source URL format

        # Fetch limited data using the *corrected* endpoint (without /v3)
        data, error = _make_api_request(endpoint, params={"limit": limit})

        if error:
            # Check if error indicates 404 specifically, as some sub-resources might legitimately not exist
            if "API HTTP 404" in error:
                current_app.logger.info(
                    f"Sub-resource {resource_key} not found (404) at {endpoint}. Returning empty list."
                )
                return []  # Treat 404 for a sub-resource as "no items"
            else:
                current_app.logger.warning(
                    f"Failed to fetch sub-resource {resource_key} from {endpoint}: {error}"
                )
                return None  # Signal other errors

        # Check if response data is a dictionary
        if not isinstance(data, dict):
            current_app.logger.error(
                f"API response for {resource_key} from {endpoint} is not a dictionary. Type: {type(data)}. Data: {str(data)[:500]}..."
            )
            return None

        # Find the list within the dictionary response (logic remains the same)
        list_key = None
        possible_keys = [resource_key]
        key_map = {
            "reports": ["reports"],
            "bills": ["bills"],
            "nominations": ["nominations"],
            "communications": [
                "houseCommunications",
                "senateCommunications",
                "communications",
            ],
            "cosponsors": ["cosponsors"],
            "actions": ["actions"],
            "amendments": ["amendments"],
            "relatedBills": ["relatedBills"],
            "summaries": ["summaries"],
            "committees": ["committees"],
        }
        possible_keys.extend(key_map.get(resource_key, []))
        possible_keys = list(dict.fromkeys(possible_keys))
        for key in possible_keys:
            if key in data and isinstance(data.get(key), list):
                list_key = key
                break

        if list_key and data.get(list_key) is not None:
            return data[list_key]
        else:
            current_app.logger.warning(
                f"Could not find list key (tried {possible_keys}) in response for {resource_key} from {endpoint}. Data keys: {list(data.keys())}"
            )
            # If count was > 0 but list key is missing, maybe return empty list?
            return []  # Return empty list if key not found, rather than None

    except Exception as e:
        current_app.logger.exception(
            f"Error processing sub-resource {resource_key} URL {api_url}: {e}"
        )  # Log full traceback
        return None


# --- Congress List ---
@cache.memoize(timeout=86400)
def get_congress_list():
    """Fetches the list of available Congresses."""
    current_app.logger.info("Fetching Congress list...")
    data, error = _make_api_request("/congress")
    if error:
        current_app.logger.error(f"Error fetching Congress list: {error}")
        return None
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
                    num = int(name.split("th Congress")[0])
                except Exception:
                    pass
            if num is None and "url" in item:
                try:
                    num = int(urlparse(item["url"]).path.strip("/").split("/")[-1])
                except Exception:
                    pass
            if num is not None:
                item["number"] = num
                item["startYear"] = item.get("startYear")
                item["endYear"] = item.get("endYear")
                valid_congresses.append(item)
            else:
                current_app.logger.warning(
                    f"Could not determine congress number for: {item}"
                )
        if valid_congresses:
            congresses_list = sorted(
                valid_congresses, key=lambda x: x.get("number", 0), reverse=True
            )
            current_app.logger.info(
                f"Successfully parsed {len(congresses_list)} congresses."
            )
            return congresses_list
        else:
            current_app.logger.warning("No valid congresses parsed.")
            return []
    else:
        current_app.logger.warning(f"Congress list not found/invalid format: {data}")
        return None


# --- Member Data ---
@cache.memoize(timeout=43200)
def load_congress_members(congress_num=None):
    """Loads member list, optionally filtered by Congress."""
    current_app.logger.info(f"Loading members (Congress: {congress_num or 'All'})...")
    members_data = {}
    limit = 250
    offset = 0
    all_members = []
    first_error = None
    endpoint = "/member"
    if congress_num:
        endpoint = f"/member/congress/{congress_num}"
    while True:
        params = {"limit": limit, "offset": offset}
        data, error = _make_api_request(endpoint, params=params)
        if error:
            current_app.logger.error(
                f"ERROR loading members batch (offset {offset}): {error}"
            )
            if first_error is None:
                first_error = error
            if "API Key missing" in error:
                return None
            break
        if not data or "members" not in data or not isinstance(data["members"], list):
            break
        members_batch = data["members"]
        if not members_batch:
            break
        all_members.extend(members_batch)
        offset += limit
        if len(members_batch) < limit:
            break
        if offset >= 3000:
            current_app.logger.warning("WARN: Member fetch limit (3000).")
            break
    if first_error:
        current_app.logger.error(f"Returning None due to fetch error: {first_error}")
        return None

    current_app.logger.info(
        f"Processing {len(all_members)} total members fetched for Congress {congress_num}..."
    )
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
            except Exception:
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
    current_app.logger.info(
        f"Finished loading {len(members_data)} unique members for Congress {congress_num}."
    )
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
        terms_list = m_data.get("terms", [])
        details_payload = {
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
            "terms": terms_list,
            "partyHistory": m_data.get("partyHistory", []),
            "depiction": m_data.get("depiction"),
            "honorificName": m_data.get("honorificName"),
            # --- FIX: Explicitly include count/URL objects if they exist ---
            "sponsoredLegislation": m_data.get(
                "sponsoredLegislation"
            ),  # Keep the whole object
            "cosponsoredLegislation": m_data.get(
                "cosponsoredLegislation"
            ),  # Keep the whole object
        }
        # Remove keys if their value is None from m_data.get to keep payload cleaner
        payload["details"] = {k: v for k, v in details_payload.items() if v is not None}

    elif not error:
        payload["error"] = (
            f"Member detail API response format invalid. Keys:{list(data.keys()) if isinstance(data, dict) else 'N/A'}"
        )
        current_app.logger.error(
            f"ERROR: Invalid member detail structure for {bioguide_id}: {data}"
        )

    return payload


# --- Legislation Identification ---
def _identify_legislation_item(item):
    """Helper to IDENTIFY item type, number, congress, and type code from list data."""
    if not isinstance(item, dict):
        return None
    url = item.get("url")
    congress = item.get("congress")
    list_number = item.get("number")
    list_amendment_number = item.get("amendmentNumber")
    if (
        not url
        or not congress
        or (list_number is None and list_amendment_number is None)
    ):
        return None
    try:
        parsed_url = urlparse(url)
        path_segments = parsed_url.path.strip("/").split("/")
        if len(path_segments) < 5:
            return None
        item_kind = path_segments[1].lower()
        type_code = path_segments[3].lower()
        url_number_str = path_segments[4]
        if not url_number_str.isdigit():
            return None
        url_number = int(url_number_str)
        number_to_use = url_number
        identity = {
            "congress": congress,
            "number": number_to_use,
            "type": None,
            "item_type": None,
        }
        BILL_TYPES = current_app.config["BILL_TYPES"]
        AMENDMENT_TYPES = current_app.config["AMENDMENT_TYPES"]
        if item_kind == "bill" and type_code in BILL_TYPES:
            identity["item_type"] = "Bill"
            identity["type"] = type_code.upper()
        elif item_kind == "amendment" and type_code in AMENDMENT_TYPES:
            identity["item_type"] = "Amendment"
            identity["type"] = type_code.upper()
            # Debug check (optional)
            # if list_amendment_number is not None: try: if url_number != int(list_amendment_number): print(f"DEBUG: URL num {url_number} != list amdtNum {list_amendment_number}") except: pass
        else:
            return None
        return identity
    except Exception as e:
        current_app.logger.error(f"Error identifying legislation {url}: {e}")
        return None


# --- Sponsored/Cosponsored ---
@cache.memoize()  # Cache based on bioguide_id ONLY now
def get_detailed_sponsored_legislation(bioguide_id):
    """Fetches a large batch of DETAILED sponsored legislation."""
    current_app.logger.info(
        f"Fetching up to {FETCH_ALL_LIMIT} sponsored items for {bioguide_id}"
    )
    endpoint = f"/member/{bioguide_id}/sponsored-legislation"
    # --- FIX: Use fixed large limit, no offset ---
    params = {"limit": FETCH_ALL_LIMIT, "offset": 0}
    list_data, error = _make_api_request(endpoint, params=params)

    # Initialize return structure - no pagination object needed
    result = {"items": [], "error": error, "count": 0}

    if error:
        return result

    if list_data:
        item_list = None
        for key in ["sponsoredLegislation", "legislation", "items"]:
            if key in list_data and isinstance(list_data.get(key), list):
                item_list = list_data[key]
                break

        # Get total count from pagination, even if we don't return pagination itself
        pagination_info = list_data.get("pagination")
        if pagination_info:
            result["count"] = pagination_info.get("count", 0)
        elif item_list:  # Fallback count
            result["count"] = len(item_list)

        if item_list:
            processed_items = []
            for item in item_list:  # Process the fetched batch
                identity = _identify_legislation_item(item)
                if not identity:
                    continue
                details = None
                # Fetch basic details for each item in the batch
                if identity["item_type"] == "Bill":
                    details = get_bill_details(
                        identity["congress"], identity["type"], identity["number"]
                    )
                elif identity["item_type"] == "Amendment":
                    details = get_amendment_details(
                        identity["congress"], identity["type"], identity["number"]
                    )

                if details and not details.get("error"):
                    details["item_type"] = identity["item_type"]
                    processed_items.append(details)
                # else: Log errors if needed

            result["items"] = processed_items
        else:
            result["error"] = "Invalid API response structure (sponsored list)."
    else:
        result["error"] = "No data received from sponsored legislation API."

    return result


@cache.memoize()  # Cache based on bioguide_id
def get_detailed_cosponsored_legislation(bioguide_id):
    """Fetches a large batch of DETAILED cosponsored legislation."""
    current_app.logger.info(
        f"Fetching up to {FETCH_ALL_LIMIT} cosponsored items for {bioguide_id}"
    )
    endpoint = f"/member/{bioguide_id}/cosponsored-legislation"
    # --- FIX: Use fixed large limit, no offset ---
    params = {"limit": FETCH_ALL_LIMIT, "offset": 0}
    list_data, error = _make_api_request(endpoint, params=params)

    result = {"items": [], "error": error, "count": 0}

    if error:
        return result

    if list_data:
        item_list = None
        for key in ["cosponsoredLegislation", "legislation", "items"]:
            if key in list_data and isinstance(list_data.get(key), list):
                item_list = list_data[key]
                break

        pagination_info = list_data.get("pagination")
        if pagination_info:
            result["count"] = pagination_info.get("count", 0)
        elif item_list:
            result["count"] = len(item_list)

        if item_list:
            processed_items = []
            for item in item_list:  # Process the fetched batch
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
                    details["item_type"] = identity["item_type"]
                    processed_items.append(details)
                # else: Log errors

            result["items"] = processed_items
        else:
            result["error"] = "Invalid API response structure (cosponsored list)."
    else:
        result["error"] = "No data received from cosponsored legislation API."

    return result


# --- Bill Details ---
@cache.memoize(timeout=86400)
def get_bill_details(congress, bill_type, bill_number):
    """Fetches basic bill details suitable for lists."""
    BILL_TYPES = current_app.config["BILL_TYPES"]
    BILL_TYPE_PATHS = current_app.config["BILL_TYPE_PATHS"]
    bill_type_lower = bill_type.lower()
    if bill_type_lower not in BILL_TYPES:
        return {"error": f"Invalid bill type: {bill_type}"}
    endpoint = f"/bill/{congress}/{bill_type_lower}/{bill_number}"
    base_data, error = _make_api_request(endpoint)
    if error or not base_data or "bill" not in base_data:
        return {"error": error or "Bill data not found."}
    bill_data = base_data["bill"]
    latest_action = bill_data.get("latestAction", {})
    path_segment = BILL_TYPE_PATHS.get(bill_data.get("type"))
    item_url = (
        f"https://www.congress.gov/bill/{congress}th-congress/{path_segment}/{bill_number}"
        if path_segment
        else None
    )
    return {
        "congress": bill_data.get("congress"),
        "number": bill_data.get("number"),
        "type": bill_data.get("type"),
        "title": bill_data.get("title", "N/A"),
        "introduced_date": bill_data.get("introducedDate"),
        "latest_action_text": latest_action.get("text"),
        "latest_action_date": latest_action.get("actionDate"),
        "url": item_url,
        "cosponsors_count": bill_data.get("cosponsors", {}).get("count", 0),
        "actions_count": bill_data.get("actions", {}).get("count", 0),
        "error": None,
    }


@cache.memoize(timeout=86400)
def get_amendment_details(congress, amendment_type, amendment_number):
    """Fetches basic amendment details suitable for lists."""
    AMENDMENT_TYPES = current_app.config["AMENDMENT_TYPES"]
    BILL_TYPE_PATHS = current_app.config["BILL_TYPE_PATHS"]
    amendment_type_lower = amendment_type.lower()
    if amendment_type_lower not in AMENDMENT_TYPES:
        return {"error": f"Invalid amendment type: {amendment_type}"}
    endpoint = f"/amendment/{congress}/{amendment_type_lower}/{amendment_number}"
    base_data, error = _make_api_request(endpoint)
    if error or not base_data or "amendment" not in base_data:
        return {"error": error or "Amendment data not found."}
    amendment_data = base_data["amendment"]
    latest_action = amendment_data.get("latestAction", {})
    path_segment = BILL_TYPE_PATHS.get(amendment_data.get("type"))
    item_url = (
        f"https://www.congress.gov/amendment/{congress}th-congress/{path_segment}/{amendment_number}"
        if path_segment
        else None
    )
    return {
        "congress": amendment_data.get("congress"),
        "number": amendment_data.get("number"),
        "type": amendment_data.get("type"),
        "title": amendment_data.get(
            "purpose",
            f"Amdt {amendment_data.get('type', '?')} {amendment_data.get('number', '?')}",
        ),
        "introduced_date": amendment_data.get("proposedDate")
        or amendment_data.get("submittedDate"),
        "latest_action_text": latest_action.get("text"),
        "latest_action_date": latest_action.get("actionDate"),
        "url": item_url,
        "cosponsors_count": amendment_data.get("cosponsors", {}).get("count", 0),
        "actions_count": amendment_data.get("actions", {}).get("count", 0),
        "error": None,
    }


@cache.memoize(timeout=7200)
def get_full_bill_data(congress, bill_type, bill_number):
    """Fetches comprehensive data for the bill detail page including related items."""
    current_app.logger.info(
        f"Fetching FULL details for Bill: {congress}-{bill_type}-{bill_number}"
    )
    BILL_TYPES = current_app.config["BILL_TYPES"]
    BILL_TYPE_PATHS = current_app.config["BILL_TYPE_PATHS"]
    bill_type_lower = bill_type.lower()
    if bill_type_lower not in BILL_TYPES:
        return {"bill": None, "error": f"Invalid bill type: {bill_type}"}
    base_endpoint = f"/bill/{congress}/{bill_type_lower}/{bill_number}"
    full_data = {
        "bill": None,
        "actions": [],
        "cosponsors": [],
        "committees": [],
        "relatedBills": [],
        "amendments": [],
        "summaries": [],
        "error": None,
    }  # Default to empty lists
    base_data, error = _make_api_request(base_endpoint)
    if error or not base_data or "bill" not in base_data:
        full_data["error"] = error or "Bill base data not found or invalid format."
        return full_data
    bill = base_data["bill"]
    full_data["bill"] = bill
    fetch_limit = 50
    # Fetch Sub-Resources
    full_data["actions"] = (
        _fetch_sub_resource(bill, "actions", "bill", limit=fetch_limit) or []
    )
    cosponsors_list = _fetch_sub_resource(bill, "cosponsors", "bill", limit=fetch_limit)
    full_data["cosponsors"] = (
        [
            {
                "bioguideId": cs.get("bioguideId"),
                "fullName": cs.get("fullName"),
                "sponsorshipDate": cs.get("sponsorshipDate"),
                "sponsorshipWithdrawnDate": cs.get("sponsorshipWithdrawnDate"),
            }
            for cs in cosponsors_list
            if cs.get("bioguideId")
        ]
        if cosponsors_list
        else []
    )
    committees_list = _fetch_sub_resource(bill, "committees", "bill", limit=fetch_limit)
    full_data["committees"] = (
        [
            {
                "name": c.get("name"),
                "chamber": c.get("chamber"),
                "systemCode": c.get("systemCode"),
                "activities": c.get("activities"),
                "detailPageUrl": (
                    f"/committee/{c.get('chamber').lower()}/{c.get('systemCode')}"
                    if c.get("chamber") and c.get("systemCode")
                    else None
                ),
            }
            for c in committees_list
        ]
        if committees_list
        else []
    )
    related_bills_list = _fetch_sub_resource(
        bill, "relatedBills", "bill", limit=fetch_limit
    )
    full_data["relatedBills"] = (
        [
            {
                "congress": rb.get("congress"),
                "number": rb.get("number"),
                "type": rb.get("type"),
                "title": rb.get("title"),
                "relationshipDetails": rb.get("relationshipDetails"),
                "detailPageUrl": (
                    f"/bill/{rb.get('congress')}/{rb.get('type')}/{rb.get('number')}"
                    if rb.get("congress") and rb.get("type") and rb.get("number")
                    else None
                ),
            }
            for rb in related_bills_list
        ]
        if related_bills_list
        else []
    )
    amendments_list = _fetch_sub_resource(bill, "amendments", "bill", limit=fetch_limit)
    full_data["amendments"] = (
        [
            {
                "congress": a.get("congress"),
                "number": a.get("number"),
                "type": a.get("type"),
                "description": a.get("description"),
                "purpose": a.get("purpose"),
                "latestAction": a.get("latestAction"),
                "congressDotGovUrl": (
                    f"https://www.congress.gov/amendment/{a.get('congress')}th-congress/{BILL_TYPE_PATHS.get(a.get('type'))}/{a.get('number')}"
                    if a.get("congress")
                    and a.get("type")
                    and a.get("number")
                    and BILL_TYPE_PATHS.get(a.get("type"))
                    else None
                ),
            }
            for a in amendments_list
        ]
        if amendments_list
        else []
    )
    full_data["summaries"] = (
        _fetch_sub_resource(bill, "summaries", "bill", limit=1) or []
    )
    # Add Congress.gov URL
    if full_data["bill"]:
        path_segment = BILL_TYPE_PATHS.get(full_data["bill"].get("type"))
        full_data["bill"]["congressDotGovUrl"] = (
            f"https://www.congress.gov/bill/{congress}th-congress/{path_segment}/{bill_number}"
            if path_segment
            else None
        )
    return full_data


# --- Committee Data ---
@cache.memoize(timeout=3600)
def get_committees_list(congress=None, chamber=None, offset=0, limit=20):
    """Fetches a list of committees based on optional filters."""
    current_app.logger.info(
        f"Fetching committees list: Congress={congress}, Chamber={chamber}, Offset={offset}, Limit={limit}"
    )
    if congress and chamber:
        endpoint = f"/committee/{congress}/{chamber.lower()}"
    elif congress:
        endpoint = f"/committee/{congress}"
    elif chamber:
        endpoint = f"/committee/{chamber.lower()}"
    else:
        endpoint = "/committee"
    params = {"offset": offset, "limit": limit}
    data, error = _make_api_request(endpoint, params=params)
    if error:
        return {"committees": [], "pagination": None, "error": error}
    if not data or not isinstance(data.get("committees"), list):
        err_msg = (
            data.get("message", "Invalid list format")
            if isinstance(data, dict)
            else "Invalid list format"
        )
        return {"committees": [], "pagination": None, "error": err_msg}
    processed_committees = []
    for committee in data.get("committees", []):
        if isinstance(committee, dict):
            comm_chamber = committee.get("chamber")
            comm_code = committee.get("systemCode")
            committee["detailPageUrl"] = (
                f"/committee/{comm_chamber.lower()}/{comm_code}"
                if comm_chamber and comm_code
                else None
            )
            processed_committees.append(committee)
    return {
        "committees": processed_committees,
        "pagination": data.get("pagination"),
        "error": None,
    }


@cache.memoize(timeout=7200)
def get_committee_details(chamber, committee_code):
    """Fetches detailed information for a specific committee, including associated items."""
    current_app.logger.info(
        f"Fetching full committee details for: {chamber}/{committee_code}"
    )
    chamber_lower = chamber.lower()
    if chamber_lower not in ["house", "senate", "joint"]:
        return {"committee": None, "error": "Invalid chamber specified."}

    endpoint = f"/committee/{chamber_lower}/{committee_code}"
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

    committee = data["committee"]
    fetch_limit = 15  # Limit for associated items lists
    # --- FIX: Removed unused variable assignment below ---
    # BILL_TYPE_PATHS = current_app.config['BILL_TYPE_PATHS'] # <<< REMOVED THIS LINE

    # --- Fetch Associated Items using Helper ---
    associated_bills = _fetch_sub_resource(
        committee, "bills", "committee", limit=fetch_limit
    )
    committee_reports = _fetch_sub_resource(
        committee, "reports", "committee", limit=fetch_limit
    )
    associated_nominations = None
    if chamber_lower != "house":
        associated_nominations = _fetch_sub_resource(
            committee, "nominations", "committee", limit=fetch_limit
        )
    associated_communications = None
    comm_key = "communications"
    comm_url_info = committee.get(comm_key, {})
    if isinstance(comm_url_info, dict) and comm_url_info.get("url"):
        comm_url = comm_url_info["url"]
        comm_api_path = urlparse(comm_url).path
        comm_base_segment = "committee"
        if "house-communication" in comm_api_path:
            associated_communications = _fetch_sub_resource(
                committee, comm_key, comm_base_segment, limit=fetch_limit
            )
        elif "senate-communication" in comm_api_path:
            associated_communications = _fetch_sub_resource(
                committee, comm_key, comm_base_segment, limit=fetch_limit
            )

    # --- Process Fetched Lists (Add Links) ---
    processed_bills = []
    if associated_bills:
        for bill in associated_bills:
            if isinstance(bill, dict):
                b_cong = bill.get("congress")
                b_type = bill.get("type")
                b_num = bill.get("number")
                if b_cong and b_type and b_num:
                    bill["detailPageUrl"] = f"/bill/{b_cong}/{b_type}/{b_num}"
                processed_bills.append(bill)

    processed_reports = []
    if committee_reports:
        for report in committee_reports:
            if isinstance(report, dict):
                citation = report.get("citation")
                url = None
                if citation:
                    try:  # Attempt to parse congress.gov URL
                        parts = citation.replace(".", "").split(" ")
                        if len(parts) >= 3:
                            level = parts[0].lower()
                            rpt_type = parts[1].lower()
                            num_part = parts[2].split("-")
                            if len(num_part) == 2 and rpt_type == "rept":
                                cong, num, rpt_code = (
                                    num_part[0],
                                    num_part[1],
                                    f"{level}{rpt_type}",
                                )
                                if rpt_code in ["hrpt", "srpt", "erpt"]:
                                    url = f"https://www.congress.gov/committee-report/{cong}th-congress/{rpt_code}/{num}"
                    except Exception as e:
                        current_app.logger.warning(
                            f"Warn: Could not parse URL from report citation '{citation}': {e}"
                        )
                report["congressDotGovUrl"] = url
                processed_reports.append(report)

    processed_nominations = []
    if associated_nominations:
        for nom in associated_nominations:
            if isinstance(nom, dict):
                nom_cong = nom.get("congress")
                nom_num = nom.get("number")
                if nom_cong is not None and nom_num is not None:
                    nom["detailPageUrl"] = f"/nomination/{nom_cong}/{nom_num}"
                    nom["congressDotGovUrl"] = (
                        f"https://www.congress.gov/nomination/{nom_cong}th-congress/{nom_num}"
                    )
                processed_nominations.append(nom)

    processed_communications = []
    if associated_communications:
        for comm in associated_communications:
            if isinstance(comm, dict):
                comm["apiUrl"] = comm.get("url")
                processed_communications.append(comm)

    # Add main committee URL
    cg_chamber_path = ""
    if chamber_lower == "joint":
        cg_chamber_path = "joint-committee"
    elif chamber_lower in ["house", "senate"]:
        cg_chamber_path = f"{chamber_lower}-committee"
    committee["congressDotGovUrl"] = (
        f"https://www.congress.gov/committee/{cg_chamber_path}/{committee_code}"
        if cg_chamber_path
        else None
    )

    # Return the complete package
    return {
        "committee": committee,
        "associated_bills": processed_bills,
        "committee_reports": processed_reports,
        "associated_nominations": processed_nominations,
        "associated_communications": processed_communications,
        "error": None,
    }


# --- Nomination Data ---
@cache.memoize(timeout=1800)
def get_nominations_list(congress=None, offset=0, limit=20):
    """Fetches a list of nominations, optionally filtered by Congress."""
    current_app.logger.info(
        f"Fetching nominations list: Congress={congress}, Offset={offset}, Limit={limit}"
    )
    endpoint = f"/nomination/{congress}" if congress else "/nomination"
    params = {"offset": offset, "limit": limit}
    data, error = _make_api_request(endpoint, params=params)
    if error:
        return {"nominations": [], "pagination": None, "error": error}
    if not data or not isinstance(data.get("nominations"), list):
        err_msg = (
            data.get("message", "Invalid list format")
            if isinstance(data, dict)
            else "Invalid list format"
        )
        return {"nominations": [], "pagination": None, "error": err_msg}
    processed_nominations = []
    for nom in data.get("nominations", []):
        if isinstance(nom, dict):
            nom_cong = nom.get("congress")
            nom_num = nom.get("number")
            if nom_cong is not None and nom_num is not None:
                nom["detailPageUrl"] = f"/nomination/{nom_cong}/{nom_num}"
                nom["congressDotGovUrl"] = (
                    f"https://www.congress.gov/nomination/{nom_cong}th-congress/{nom_num}"
                )
            else:
                nom["detailPageUrl"] = None
                nom["congressDotGovUrl"] = None
            processed_nominations.append(nom)
    return {
        "nominations": processed_nominations,
        "pagination": data.get("pagination"),
        "error": None,
    }


@cache.memoize(timeout=7200)
def get_nomination_details(congress, nomination_number):
    """Fetches detailed information for a specific nomination."""
    current_app.logger.info(
        f"Fetching nomination details for: {congress}/{nomination_number}"
    )
    endpoint = f"/nomination/{congress}/{nomination_number}"
    data, error = _make_api_request(endpoint)
    if error:
        return {"nomination": None, "error": error}
    if not data or not isinstance(data.get("nomination"), dict):
        err_msg = (
            data.get("message", "Invalid detail format")
            if isinstance(data, dict)
            else "Invalid detail format"
        )
        return {"nomination": None, "error": err_msg}
    nomination_data = data["nomination"]
    fetch_limit = 50
    actions_data = (
        _fetch_sub_resource(nomination_data, "actions", "nomination", limit=fetch_limit)
        or []
    )
    committees_raw = (
        _fetch_sub_resource(
            nomination_data, "committees", "nomination", limit=fetch_limit
        )
        or []
    )
    committees_data = []
    for comm in committees_raw:
        if isinstance(comm, dict):
            comm_chamber = comm.get("chamber")
            comm_code = comm.get("systemCode")
            if comm_chamber and comm_code:
                comm["detailPageUrl"] = f"/committee/{comm_chamber.lower()}/{comm_code}"
            committees_data.append(comm)
    nom_cong = nomination_data.get("congress")
    nom_num = nomination_data.get("number")
    nomination_data["congressDotGovUrl"] = (
        f"https://www.congress.gov/nomination/{nom_cong}th-congress/{nom_num}"
        if nom_cong is not None and nom_num is not None
        else None
    )
    return {
        "nomination": nomination_data,
        "actions": actions_data,
        "committees": committees_data,
        "error": None,
    }
