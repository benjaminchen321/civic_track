// FILE: frontend/src/components/NominationListItem.jsx
import React from "react";
import { Link } from "react-router-dom";
import "./NominationListItem.css"; // Optional specific styles

function NominationListItem({ nomination }) {
  const citation =
    nomination.citation || `PN${nomination.number}-${nomination.congress}`;
  const org = nomination.organization || "N/A";
  const latestActionText = nomination.latestAction?.text || "N/A";
  const latestActionDate = nomination.latestAction?.actionDate || "N/A";
  const receivedDate = nomination.receivedDate || "N/A";
  // Use internal detail page URL from backend
  const detailUrl = nomination.detailPageUrl; // e.g., "/nomination/118/24"
  const congressDotGovUrl = nomination.congressDotGovUrl;

  return (
    <li className="nomination-list-item-react">
      {" "}
      {/* Use distinct class */}
      <div className="nom-item-main">
        <span className="nom-identifier">
          {detailUrl ? (
            <Link to={detailUrl} title={`View details for ${citation}`}>
              {citation}
            </Link>
          ) : (
            <strong>{citation}</strong>
          )}
        </span>
        <span className="nom-org"> - {org}</span>
      </div>
      <div className="nom-item-meta">
        <span>(Received: {receivedDate})</span>
        {congressDotGovUrl && (
          <a
            href={congressDotGovUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            View on Congress.gov
          </a>
        )}
      </div>
      <div className="nom-latest-action">
        Latest Action ({latestActionDate}): {latestActionText}
      </div>
    </li>
  );
}

export default NominationListItem;
