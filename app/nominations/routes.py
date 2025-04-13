# FILE: app/nominations/routes.py
from flask import Blueprint, jsonify, request, current_app
from app.services import get_congress_list, get_nominations_list, get_nomination_details

# Blueprint prefix '/api' is set during registration
nominations_bp = Blueprint("nominations", __name__)

AVAILABLE_CONGRESSES = None
DEFAULT_CONGRESS = None


@nominations_bp.before_request
def load_nomination_config_data():
    global AVAILABLE_CONGRESSES, DEFAULT_CONGRESS
    AVAILABLE_CONGRESSES = get_congress_list() or []
    DEFAULT_CONGRESS = (
        AVAILABLE_CONGRESSES[0]["number"] if AVAILABLE_CONGRESSES else 118
    )
    current_app.logger.info("Nomination Blueprint: Loaded Congress list and default.")


# --- REMOVED Page Route: /nominations ---


# --- API Route for Listing Nominations ---
@nominations_bp.route("/nominations")  # Accessible at /api/nominations
def get_nominations_list_api():
    """API endpoint to fetch list of nominations."""
    global AVAILABLE_CONGRESSES  # Use loaded list
    congress = request.args.get("congress", default=None, type=str)
    offset = request.args.get("offset", default=0, type=int)
    limit = request.args.get("limit", default=25, type=int)

    # Validation
    if congress:
        valid_congress_numbers = [c.get("number") for c in AVAILABLE_CONGRESSES]
        if not congress.isdigit() or int(congress) not in valid_congress_numbers:
            congress = None
    if limit > 100 or limit < 1:
        limit = 25
    if offset < 0:
        offset = 0

    current_app.logger.info(
        f"API: Fetching nominations list: C={congress}, L={limit}, O={offset}"
    )
    result = get_nominations_list(
        congress=congress, offset=offset, limit=limit
    )  # Use service

    status_code = 200
    if result.get("error"):
        status_code = 500
        if "API HTTP 404" in result.get("error", ""):
            status_code = 404
        elif "API Key" in result.get("error", ""):
            status_code = 401
    return jsonify(result), status_code


# --- API Route for Nomination Detail ---
@nominations_bp.route(
    "/nomination/<int:congress>/<int:nomination_number>"
)  # Accessible at /api/nomination/...
def get_nomination_detail_api(congress, nomination_number):
    """API endpoint for fetching full nomination details."""
    current_app.logger.info(
        f"API: Fetching detail for Nomination: PN{nomination_number}-{congress}"
    )
    # Basic validation could be added here
    data_package = get_nomination_details(congress, nomination_number)  # Use service

    if data_package.get("error"):
        err_msg = data_package["error"]
        status = 500
        if "not found" in err_msg.lower() or "404" in err_msg:
            status = 404
        elif "API Key" in err_msg:
            status = 401
        return jsonify({"error": err_msg, "data": None}), status
    if not data_package.get("nomination"):
        return (
            jsonify(
                {
                    "error": "Failed to retrieve valid nomination data structure.",
                    "data": None,
                }
            ),
            500,
        )
    # Return the whole package (contains nomination, actions, committees)
    return jsonify({"data": data_package, "error": None}), 200
