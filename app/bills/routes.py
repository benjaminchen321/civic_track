# FILE: app/bills/routes.py
from flask import Blueprint, jsonify, request, current_app
from app.services import get_full_bill_data, get_congress_list  # Import services
from app.utils import _make_api_request  # Import API helper for list endpoint

# Blueprint prefix '/api' is set during registration in app/__init__.py
bills_bp = Blueprint("bills", __name__)

# Load constants once
BILL_TYPES = None
BILL_TYPE_PATHS = None
DEFAULT_CONGRESS = None
AVAILABLE_CONGRESSES = None


@bills_bp.before_request
def load_bill_constants():
    global BILL_TYPES, BILL_TYPE_PATHS, DEFAULT_CONGRESS, AVAILABLE_CONGRESSES
    BILL_TYPES = current_app.config.get("BILL_TYPES", set())
    BILL_TYPE_PATHS = current_app.config.get("BILL_TYPE_PATHS", {})
    AVAILABLE_CONGRESSES = get_congress_list() or []
    DEFAULT_CONGRESS = (
        AVAILABLE_CONGRESSES[0]["number"] if AVAILABLE_CONGRESSES else 118
    )
    current_app.logger.info("Bills Blueprint: Loaded constants.")


# --- REMOVED Page Route: /bills ---


# --- API Route for Listing Bills ---
@bills_bp.route("/bills")  # Accessible at /api/bills
def get_bills_list_api():
    """API endpoint to fetch list of bills based on filters."""
    global BILL_TYPES, DEFAULT_CONGRESS, AVAILABLE_CONGRESSES  # Use loaded constants
    congress = request.args.get("congress", default=None, type=str)
    bill_type = request.args.get("billType", default=None, type=str)
    offset = request.args.get("offset", default=0, type=int)
    limit = request.args.get("limit", default=20, type=int)

    # Validation
    valid_congress_numbers = [c.get("number") for c in AVAILABLE_CONGRESSES]
    if (
        not congress
        or not congress.isdigit()
        or int(congress) not in valid_congress_numbers
    ):
        congress = str(DEFAULT_CONGRESS)  # Default if invalid/missing
    if bill_type and bill_type.lower() not in BILL_TYPES:
        bill_type = None
    if limit > 100 or limit < 1:
        limit = 20
    if offset < 0:
        offset = 0

    # Construct endpoint path based on filters
    endpoint = f"/bill/{congress}"
    if bill_type:
        endpoint += f"/{bill_type.lower()}"
    params = {"limit": limit, "offset": offset}

    current_app.logger.info(
        f"API: Fetching bills list - Endpoint: {endpoint}, Params: {params}"
    )
    data, error = _make_api_request(endpoint, params=params)  # Use helper directly

    # Handle response
    if error:
        status_code = 500
        if error is not None:
            if "API HTTP 404" in error:
                status_code = 404
            elif "API Key" in error:
                status_code = 401
        return jsonify({"error": error, "bills": [], "pagination": None}), status_code
    if not data or (not isinstance(data.get("bills"), list) and "message" not in data):
        err_msg = (
            data.get("message", "Invalid API response")
            if isinstance(data, dict)
            else "Invalid API response"
        )
        current_app.logger.error(
            f"Invalid API response structure for {endpoint}. Response: {data}"
        )
        return jsonify({"error": err_msg, "bills": [], "pagination": None}), 500

    # Process bills (add links)
    processed_bills = []
    for bill in data.get("bills", []):
        if isinstance(bill, dict):
            b_type = bill.get("type")
            b_num = bill.get("number")
            b_cong = bill.get("congress")
            path_segment = BILL_TYPE_PATHS.get(b_type)
            # Add API detail path AND internal detail page URL
            if b_type and b_num is not None and b_cong is not None:
                # Internal link for React Router
                bill["detailPageUrl"] = (
                    f"/bill/{b_cong}/{b_type}/{b_num}"  # <<< THIS LINE
                )
                # External link
                if path_segment:
                    bill["congressDotGovUrl"] = (
                        f"https://www.congress.gov/bill/{b_cong}th-congress/{path_segment}/{b_num}"
                    )
                else:
                    bill["congressDotGovUrl"] = None
            else:
                bill["detailPageUrl"] = None  # Set to None if parts are missing
                bill["congressDotGovUrl"] = None
            processed_bills.append(bill)
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


# --- REMOVED Page Route: /bill/<int:congress>/<bill_type>/<int:bill_number> ---


@bills_bp.route(
    "/bill/<int:congress>/<bill_type>/<int:bill_number>"
)  # Accessible at /api/bill/...
def get_bill_detail_api(congress, bill_type, bill_number):
    """API endpoint for fetching full bill details."""
    global BILL_TYPES  # Use loaded constants
    current_app.logger.info(
        f"API: Fetching detail for Bill: {congress}-{bill_type}-{bill_number}"
    )
    bill_type_lower = bill_type.lower()
    if bill_type_lower not in BILL_TYPES:
        return jsonify({"error": "Invalid bill type specified."}), 400

    bill_data_package = get_full_bill_data(
        congress, bill_type_lower, bill_number
    )  # Use service

    if bill_data_package.get("error"):
        err_msg = bill_data_package["error"]
        status = 500
        if "not found" in err_msg.lower() or "404" in err_msg:
            status = 404
        elif "API Key" in err_msg:
            status = 401
        # Return the error within the 'data' field for consistency with service helper
        return jsonify({"data": None, "error": err_msg}), status

    if not bill_data_package.get("bill"):
        return (
            jsonify(
                {"error": "Failed to retrieve valid bill data structure.", "data": None}
            ),
            500,
        )

    # Return the whole package fetched by the service function
    return jsonify({"data": bill_data_package, "error": None}), 200
