// FILE: frontend/src/components/BillListItem.jsx
import React from "react";
import { Link } from "react-router-dom";
import "./BillListItem.css"; // Optional specific styles

function BillListItem({ bill }) {
  // --- DEBUG LOG ---
  // console.log("BillListItem received bill prop:", bill);
  // --- END DEBUG LOG ---

  // Use optional chaining and nullish coalescing for safety
  const billType = bill?.type || "?";
  const billNumber = bill?.number ?? "?";
  const billDisplay = `${billType}${billNumber}`;

  const title = bill?.title || "No Title Provided";
  // --- FIX: Access nested latest action properties safely ---
  const latestActionText = bill?.latest_action_text || "N/A"; // Use the key from backend service
  const latestActionDate = bill?.latest_action_date || "N/A"; // Use the key from backend service
  const introducedDate = bill?.introduced_date || "N/A"; // Use the key from backend service
  // --- End FIX ---

  const detailUrl = bill?.detailPageUrl;
  const congressDotGovUrl = bill?.congressDotGovUrl;

  return (
    <li className="bill-list-item-react">
      <div className="bill-item-main">
        <span className="bill-identifier">
          {detailUrl ? (
            <Link to={detailUrl} title={`View details for ${billDisplay}`}>
              {billDisplay}
            </Link>
          ) : (
            <strong>{billDisplay}</strong>
          )}
        </span>
        :<span className="bill-title"> {title}</span>
      </div>
      <div className="bill-item-meta">
        <span>(Introduced: {introducedDate})</span>
        {congressDotGovUrl && (
          <a
            href={congressDotGovUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
            title={`View ${billDisplay} on Congress.gov`}
          >
            View on Congress.gov
          </a>
        )}
      </div>
      <div className="bill-latest-action">
        Latest Action ({latestActionDate}): {latestActionText}
      </div>
    </li>
  );
}

export default BillListItem;
