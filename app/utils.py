# FILE: app/utils.py
import requests
import json
from flask import current_app


def _make_api_request(endpoint, params=None, timeout=15):
    """Makes a request to the Congress.gov API."""
    api_key = current_app.config.get("CONGRESS_GOV_API_KEY")
    base_url = current_app.config.get("API_BASE_URL")

    if not api_key:
        current_app.logger.error(f"API Key missing, cannot make request to {endpoint}")
        return None, "API Key missing."
    if not base_url:
        current_app.logger.error("API_BASE_URL missing from config.")
        return None, "API Base URL missing."

    request_params = params.copy() if params else {}
    request_params["api_key"] = api_key
    request_params.setdefault("format", "json")
    url = f"{base_url}{endpoint}"
    log_params = {k: v for k, v in request_params.items() if k != "api_key"}
    log_params["api_key"] = "***MASKED***"
    # current_app.logger.debug(f"API Request: GET {url} PARAMS: {log_params}")

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
        current_app.logger.error(error_msg)
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
        current_app.logger.error(error_msg)
        return None, f"API HTTP {status_code}: {error_msg}"  # Pass back status info
    except requests.exceptions.RequestException as e:
        error_msg = f"Network error for {endpoint}: {e}"
        current_app.logger.error(error_msg)
        return None, error_msg
    except json.JSONDecodeError as e:
        resp_text = response.text[:500] if response else "N/A"
        error_msg = f"JSON Error for {endpoint}: {e}. Resp: {resp_text}..."
        current_app.logger.error(error_msg)
        return None, error_msg
    except Exception as e:
        error_msg = f"Unexpected error during API request for {endpoint}: {e}"
        current_app.logger.exception(error_msg)
        return None, error_msg
