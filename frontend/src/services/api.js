// FILE: frontend/src/services/api.js
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_REACT_APP_API_URL ||
  "http://127.0.0.1:5000";
const FLASK_API_ENDPOINT = `${API_BASE_URL}/api`; // Base for API routes
console.log("Using API Endpoint:", FLASK_API_ENDPOINT);

/**
 * Generic GET request handler for the Flask API
 * @param {string} endpoint - The specific API endpoint path (e.g., '/members', '/bills')
 * @param {object} [params={}] - Query parameters object
 * @returns {Promise<{ data: any|null, error: string|null }>} - Response object
 */
const apiRequest = async (endpoint, params = {}) => {
  // Construct the full URL
  const url = `${FLASK_API_ENDPOINT}${endpoint}`;
  console.log(`Making API request to: ${url} with params:`, params); // Log requests

  try {
    // Make the GET request using axios
    const response = await axios.get(url, { params });

    // Check if the response data itself contains an error message from Flask
    if (response.data && response.data.error) {
      console.warn(
        `API endpoint ${endpoint} returned error in payload:`,
        response.data.error
      );
      // Return the Flask error message
      return { data: response.data, error: response.data.error }; // Still pass data if available
    }

    // Success: return the data payload
    return { data: response.data, error: null };
  } catch (error) {
    // Handle Axios errors (network, 4xx/5xx status codes from Flask not caught above)
    console.error(`API request failed for ${endpoint}:`, error);

    // Extract a meaningful error message
    const message =
      error.response?.data?.error || // Error message from Flask JSON response body
      error.message || // Axios or network error message
      "An unknown API error occurred"; // Fallback

    // Return a structured error object
    return { data: null, error: message };
  }
};

// --- Specific API Functions will go below ---

// Maybe needed for filters, requires backend endpoint /api/congresses
// export const fetchCongresses = async () => await apiRequest('/congresses');

// Members
export const fetchMembers = async (congress) => {
  if (!congress)
    return { data: null, error: "Congress parameter is required." };
  return await apiRequest("/members", { congress }); // Endpoint registered under main_bp at root /api
};

// Member Details (using specific member blueprint endpoints)
export const fetchMemberDetails = async (bioguideId) => {
  if (!bioguideId) return { data: null, error: "Bioguide ID is required." };
  return await apiRequest(`/member/${bioguideId}/details`); // Hits /api/member/<id>/details
};
export const fetchSponsored = async (bioguideId) => {
  if (!bioguideId) return { data: null, error: "Bioguide ID is required." };
  return await apiRequest(`/member/${bioguideId}/sponsored`);
};
export const fetchCosponsored = async (bioguideId) => {
  if (!bioguideId) return { data: null, error: "Bioguide ID is required." };
  return await apiRequest(`/member/${bioguideId}/cosponsored`);
};
// These return specific error messages from the backend, handled by apiRequest
export const fetchMemberCommittees = async (bioguideId) => {
  if (!bioguideId) return { data: null, error: "Bioguide ID is required." };
  return await apiRequest(`/member/${bioguideId}/committees`);
};
export const fetchMemberVotes = async (bioguideId) => {
  if (!bioguideId) return { data: null, error: "Bioguide ID is required." };
  return await apiRequest(`/member/${bioguideId}/votes`);
};

// Bills
export const fetchBills = async (params) => {
  // params = { congress, billType, offset, limit }
  // Ensure required param 'congress' is present before calling backend
  if (!params.congress)
    return { data: null, error: "Congress parameter is required." };
  return await apiRequest("/bills", params); // Hits Flask route @bills_bp.route("/api/bills")
};
export const fetchBillDetail = async (congress, billType, billNumber) => {
  if (!congress || !billType || !billNumber) {
    return {
      data: null,
      error: "Congress, Bill Type, and Bill Number are required.",
    };
  }
  // Ensure billType is lowercase for the API path if necessary, although Flask route handles case
  const typeLower = billType.toLowerCase();
  return await apiRequest(`/bill/${congress}/${typeLower}/${billNumber}`); // Hits /api/bill/...
};

// Committees
export const fetchCommittees = async (params) => {
  // params = { congress, chamber, offset, limit }
  return await apiRequest("/committees", params); // Hits /api/committees
};
export const fetchCommitteeDetail = async (chamber, committeeCode) => {
  if (!chamber || !committeeCode)
    return { data: null, error: "Chamber and Committee Code are required." };
  return await apiRequest(`/committee/${chamber}/${committeeCode}`); // Hits /api/committee/...
};

// Nominations
export const fetchNominations = async (params) => {
  // params = { congress, offset, limit }
  return await apiRequest("/nominations", params); // Hits /api/nominations
};
export const fetchNominationDetail = async (congress, nominationNumber) => {
  if (!congress || !nominationNumber) {
    return {
      data: null,
      error: "Congress and Nomination Number are required.",
    };
  }
  return await apiRequest(`/nomination/${congress}/${nominationNumber}`); // Hits /api/nomination/...
};
