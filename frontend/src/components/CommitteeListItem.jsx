// FILE: frontend/src/components/CommitteeListItem.jsx
import React from "react";
import { Link } from "react-router-dom";
import "./CommitteeListItem.css"; // Optional specific styles

function CommitteeListItem({ committee }) {
  const name = committee.name || "Unknown Committee";
  const type = committee.committeeTypeCode || committee.type || "N/A";
  const chamber = committee.chamber || "N/A";
  const systemCode = committee.systemCode || "N/A";
  // Use internal detail page URL generated by backend
  const detailUrl = committee.detailPageUrl; // e.g., "/committee/house/hspw00"

  return (
    <li className="committee-list-item-react">
      {" "}
      {/* Use distinct class */}
      <span className="committee-name">
        {detailUrl ? (
          <Link to={detailUrl} title={`View details for ${name}`}>
            {name}
          </Link>
        ) : (
          <strong>{name}</strong>
        )}
      </span>
      <span className="committee-meta">
        ({chamber} - {type}) - Code: {systemCode}
      </span>
      {committee.subcommittees && committee.subcommittees.length > 0 && (
        <span className="committee-subs">
          ({committee.subcommittees.length} Subcommittee
          {committee.subcommittees.length !== 1 ? "s" : ""})
        </span>
      )}
    </li>
  );
}
export default CommitteeListItem;
