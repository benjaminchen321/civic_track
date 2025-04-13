# FILE: app/committees/routes.py
from flask import Blueprint, jsonify, request, current_app
from app.services import get_congress_list, get_committees_list, get_committee_details

# Blueprint prefix '/api' is set during registration
committees_bp = Blueprint("committees", __name__)

AVAILABLE_CONGRESSES = None
DEFAULT_CONGRESS = None


@committees_bp.before_request
def load_committee_config_data():
    global AVAILABLE_CONGRESSES, DEFAULT_CONGRESS
    AVAILABLE_CONGRESSES = get_congress_list() or []
    DEFAULT_CONGRESS = (
        AVAILABLE_CONGRESSES[0]["number"] if AVAILABLE_CONGRESSES else 118
    )
    current_app.logger.info("Committee Blueprint: Loaded Congress list and default.")


# --- REMOVED Page Route: /committees ---


# --- API Route for Listing Committees ---
@committees_bp.route("/committees")  # Accessible at /api/committees
def get_committees_list_api():
    """API endpoint to fetch list of committees based on filters."""
    global AVAILABLE_CONGRESSES  # Use loaded list
    congress = request.args.get("congress", default=None, type=str)
    chamber = request.args.get("chamber", default=None, type=str)
    offset = request.args.get("offset", default=0, type=int)
    limit = request.args.get("limit", default=25, type=int)

    # Validation
    valid_chambers = ["house", "senate", "joint"]
    if chamber and chamber.lower() not in valid_chambers:
        chamber = None
    if congress:
        valid_congress_numbers = [c.get("number") for c in AVAILABLE_CONGRESSES]
        if not congress.isdigit() or int(congress) not in valid_congress_numbers:
            congress = None
    if limit > 100 or limit < 1:
        limit = 25
    if offset < 0:
        offset = 0

    current_app.logger.info(
        f"API: Fetching committees list: C={congress}, Ch={chamber}, L={limit}, O={offset}"
    )
    result = get_committees_list(
        congress=congress, chamber=chamber, offset=offset, limit=limit
    )  # Use service

    status_code = 200
    if result.get("error"):
        status_code = 500
        if "API HTTP 404" in result.get("error", ""):
            status_code = 404
        elif "API Key" in result.get("error", ""):
            status_code = 401
    return jsonify(result), status_code


# --- REMOVED Page Route: /committee/<chamber>/<committee_code> ---


# --- NEW API Route for Committee Detail ---
@committees_bp.route(
    "/committee/<chamber>/<committee_code>"
)  # Accessible at /api/committee/...
def get_committee_detail_api(chamber, committee_code):
    """API endpoint for fetching full committee details."""
    current_app.logger.info(
        f"API: Fetching detail for Committee: {chamber}/{committee_code}"
    )
    chamber_lower = chamber.lower()
    if chamber_lower not in ["house", "senate", "joint"]:
        return jsonify({"error": "Invalid chamber specified."}), 400
    if not committee_code or len(committee_code) < 4:
        return jsonify({"error": "Invalid committee code format."}), 400

    committee_data_package = get_committee_details(
        chamber_lower, committee_code
    )  # Use service

    if committee_data_package.get("error"):
        err_msg = committee_data_package["error"]
        status = 500
        if "not found" in err_msg.lower() or "404" in err_msg:
            status = 404
        elif "API Key" in err_msg:
            status = 401
        return jsonify({"error": err_msg, "data": None}), status
    if not committee_data_package.get("committee"):
        return (
            jsonify({"error": "Failed to retrieve valid committee data structure."}),
            500,
        )

    # Return the whole package fetched by the service function
    return jsonify({"data": committee_data_package, "error": None}), 200
