# FILE: app/main/routes.py
from flask import Blueprint, jsonify, request, current_app, g  # Import g
from app.services import get_congress_list, load_congress_members

main_bp = Blueprint("main", __name__)


# Use before_request to load data into the 'g' object for the duration of the request
@main_bp.before_request
def load_congress_data_for_request():
    """Load congress list into request context (g)."""
    if "available_congresses" not in g:
        g.available_congresses = get_congress_list() or []
        g.default_congress = (
            g.available_congresses[0]["number"] if g.available_congresses else 118
        )


# --- MODIFIED: Root route now returns JSON ---
@main_bp.route("/")
def api_root():
    """Confirms the API is running."""
    current_app.logger.info("API root route accessed.")
    return jsonify({"message": "CivicTrack API is running"})


@main_bp.route("/api/members")
def get_members_list_data_api():
    """API endpoint to fetch member list based on filters."""
    # Access data from g instead of module-level globals
    available_congresses = g.get("available_congresses", [])
    default_congress = g.get("default_congress", 118)

    congress_filter = request.args.get("congress") or str(default_congress)
    # --- Validation ---
    valid_congress_numbers = [c.get("number") for c in available_congresses]
    is_valid_request = False
    try:
        congress_num_int = int(congress_filter)
        if congress_num_int in valid_congress_numbers:
            is_valid_request = True
        elif not available_congresses:  # Cannot validate if list failed loading
            current_app.logger.warning(
                f"Cannot validate congress '{congress_filter}' - list unavailable. Proceeding."
            )
            is_valid_request = True  # Allow request if validation isn't possible
    except ValueError:
        pass  # Handled below

    if not is_valid_request:
        current_app.logger.warning(
            f"Invalid congress number/format: '{congress_filter}'. Returning 400."
        )
        return (
            jsonify(
                {
                    "error": f"Invalid or unknown Congress number requested: {congress_filter}."
                }
            ),
            400,
        )

    current_app.logger.info(
        f"API: Loading members list for congress: {congress_filter}"
    )
    members_dict = load_congress_members(congress_filter)  # Calls service

    if members_dict is None:  # Critical error
        error_msg = f"Failed to load members for Congress {congress_filter}. Check API key/logs."
        return jsonify({"error": error_msg}), 503
    # Return empty list if 0 members found (members_dict == {})
    return jsonify(list(members_dict.values()) if members_dict else []), 200
