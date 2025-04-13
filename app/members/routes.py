# FILE: app/members/routes.py
from flask import Blueprint, jsonify, request, current_app
from app.services import (
    get_member_details,
    get_detailed_sponsored_legislation,
    get_detailed_cosponsored_legislation,
)

# Blueprint prefix '/api/member' is set during registration in app/__init__.py
members_bp = Blueprint("members", __name__)

# --- API Routes specific to a Member ID ---


@members_bp.route("/<bioguide_id>/details")  # Accessible at /api/member/<id>/details
def get_member_details_api(bioguide_id):
    """API: Fetches basic details for a specific member."""
    if not bioguide_id or len(bioguide_id) != 7:
        return jsonify({"error": "Invalid Bioguide ID format."}), 400
    current_app.logger.info(f"API: Fetching details for member: {bioguide_id}")
    details_data = get_member_details(bioguide_id)  # Calls service
    status = 200
    if details_data.get("error"):
        err = (details_data["error"] or "").lower()
        if "not found" in err or "invalid" in err or "404" in err:
            status = 404
        elif "api key" in err:
            status = 500  # Use 500 for server-side API key issue
        elif "api http" in err:  # Try to parse status from API helper message
            try:
                status = int(err.split(" ")[2])
            except Exception:
                pass  # Keep 200 if parsing fails, error is in payload
    return jsonify(details_data), status


@members_bp.route("/<bioguide_id>/sponsored")
def get_member_sponsored_api(bioguide_id):
    """API: Fetches paginated sponsored legislation for a member."""
    if not bioguide_id or len(bioguide_id) != 7:
        return (
            jsonify(
                {
                    "error": "Invalid Bioguide ID format.",
                    "items": [],
                    "count": 0,
                    "pagination": None,
                }
            ),
            400,
        )

    # --- Get pagination params ---
    limit = request.args.get("limit", default=15, type=int)
    offset = request.args.get("offset", default=0, type=int)
    if limit > 50:
        limit = 50  # Set a reasonable max limit
    if offset < 0:
        offset = 0

    current_app.logger.info(
        f"API: Fetching sponsored for {bioguide_id}, Limit={limit}, Offset={offset}"
    )
    # --- Pass params to service ---
    sponsored_data = get_detailed_sponsored_legislation(
        bioguide_id, limit=limit, offset=offset
    )

    # Determine status based on service response error
    status = 200
    if sponsored_data.get("error"):
        status = (
            500
            if "API Key" in sponsored_data.get("error", "")
            else 404 if "404" in sponsored_data.get("error", "") else 500
        )  # Default to 500 for other errors

    return jsonify(sponsored_data), status


@members_bp.route("/<bioguide_id>/cosponsored")
def get_member_cosponsored_api(bioguide_id):
    """API: Fetches paginated cosponsored legislation for a member."""
    if not bioguide_id or len(bioguide_id) != 7:
        return (
            jsonify(
                {
                    "error": "Invalid Bioguide ID format.",
                    "items": [],
                    "count": 0,
                    "pagination": None,
                }
            ),
            400,
        )

    # --- Get pagination params ---
    limit = request.args.get("limit", default=15, type=int)
    offset = request.args.get("offset", default=0, type=int)
    if limit > 50:
        limit = 50
    if offset < 0:
        offset = 0

    current_app.logger.info(
        f"API: Fetching cosponsored for {bioguide_id}, Limit={limit}, Offset={offset}"
    )
    # --- Pass params to service ---
    cosponsored_data = get_detailed_cosponsored_legislation(
        bioguide_id, limit=limit, offset=offset
    )

    status = 200
    if cosponsored_data.get("error"):
        status = (
            500
            if "API Key" in cosponsored_data.get("error", "")
            else 404 if "404" in cosponsored_data.get("error", "") else 500
        )

    return jsonify(cosponsored_data), status


@members_bp.route(
    "/<bioguide_id>/committees"
)  # Accessible at /api/member/<id>/committees
def get_member_committees_api(bioguide_id):
    """API: Returns committee assignment status (currently not implemented via API)."""
    if not bioguide_id or len(bioguide_id) != 7:
        return jsonify({"error": "Invalid Bioguide ID format.", "committees": []}), 400
    current_app.logger.info(
        f"API: Request for committee assignments for member: {bioguide_id} (Not directly available)"
    )
    # Return 200 OK but payload indicates limitation
    return (
        jsonify(
            {
                "committees": [],
                "error": "Committee assignment data by member is not directly available via the current public Congress.gov API.",
                "message": "This feature requires a different data source or API enhancement.",
            }
        ),
        200,
    )


@members_bp.route("/<bioguide_id>/votes")  # Accessible at /api/member/<id>/votes
def get_member_votes_api(bioguide_id):
    """API: Returns member vote status (currently not implemented)."""
    if not bioguide_id or len(bioguide_id) != 7:
        return jsonify({"error": "Invalid Bioguide ID format.", "votes": []}), 400
    current_app.logger.info(
        f"API: Request for votes for member: {bioguide_id} (Not implemented)"
    )
    # Return 200 OK but payload indicates limitation
    return (
        jsonify(
            {
                "votes": [],
                "error": "Individual member voting records are not directly available via a dedicated endpoint in the current public Congress.gov API. Vote data is typically found within Bill/Amendment actions.",
                "message": "This feature requires further implementation.",
            }
        ),
        200,
    )
