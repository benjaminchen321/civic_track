// FILE: frontend/src/pages/NominationDetailPage.jsx
import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchNominationDetail } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import CommitteeListItem from "../components/CommitteeListItem"; // Reuse for linked committees
import '../styles/DetailPage.css'; // Use shared detail styles

function NominationDetailPage() {
  const { congress, nominationNumber } = useParams();
  const [nominationPackage, setNominationPackage] = useState(null); // Holds { nomination: {}, actions: [], committees: [] }
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadNominationData = async () => {
      setIsLoading(true);
      setError(null);
      setNominationPackage(null);
      console.log(
        `Fetching details for Nomination: ${congress}/${nominationNumber}`
      );
      const { data, error: apiError } = await fetchNominationDetail(
        congress,
        nominationNumber
      );

      if (apiError) {
        setError(apiError);
      } else if (data?.data?.nomination) {
        // Check nested structure
        setNominationPackage(data.data);
      } else {
        setError("Received unexpected data structure for nomination details.");
      }
      setIsLoading(false);
    };

    // Only fetch if params are valid numbers
    if (
      congress &&
      nominationNumber &&
      !isNaN(congress) &&
      !isNaN(nominationNumber)
    ) {
      loadNominationData();
    } else {
      setError("Invalid Congress or Nomination Number in URL.");
      setIsLoading(false);
    }
  }, [congress, nominationNumber]); // Dependency array

  // Render logic
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Prioritize error display
  if (error) {
    const displayError =
      error.includes("404") || error.toLowerCase().includes("not found")
        ? `Nomination PN${nominationNumber}-${congress} not found.`
        : `Error loading nomination: ${error}`;
    return <ErrorMessage message={displayError} />;
  }

  // Should have data if no error and not loading
  if (!nominationPackage?.nomination) {
    return (
      <ErrorMessage message="Nomination data could not be loaded or is missing." />
    );
  }

  // --- Data Extraction (using optional chaining ?. for safety) ---
  const { nomination, actions = [], committees = [] } = nominationPackage; // Default actions/committees to empty arrays
  const citation =
    nomination.citation || `PN${nomination.number}-${nomination.congress}`;
  const totalActionCount = nomination.actions?.count ?? actions.length; // Use fetched length as fallback
  const totalCommitteeCount = nomination.committees?.count ?? committees.length; // Use fetched length as fallback

  return (
    <div className="detail-page-container nomination-detail-react">
      <header className="page-header-react">
        <h2>
          Nomination {citation}{" "}
          <span className="congress-tag">
            ({nomination.congress}th Congress)
          </span>
        </h2>
        <nav>
          <Link to="/nominations">« Back to Browse Nominations</Link>
          {nomination.congressDotGovUrl && (
            <>
              {" "}
              |{" "}
              <a
                href={nomination.congressDotGovUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="View this nomination on Congress.gov"
              >
                View on Congress.gov
              </a>
            </>
          )}
        </nav>
      </header>

      <section className="detail-summary-section">
        <h3>{nomination.organization || "Nomination Details"}</h3>
        <div className="detail-meta">
          <span>
            <strong>Received:</strong> {nomination.receivedDate || "N/A"}
          </span>
          {nomination.nominationType && (
            <>
              {" "}
              |{" "}
              <span>
                <strong>Type:</strong>
                {nomination.nominationType.isMilitary && " Military "}
                {nomination.nominationType.isCivilian && " Civilian "}
                {!nomination.nominationType.isMilitary &&
                  !nomination.nominationType.isCivilian &&
                  " Unknown"}
              </span>
            </>
          )}
        </div>

        {/* Partition Notice */}
        {nomination.nominees && nomination.nominees.length > 1 && (
          <div className="partition-notice">
            <strong>Note:</strong> This nomination ({citation}) appears to be
            partitioned on Congress.gov (split into parts like {citation}-1,{" "}
            {citation}-2, etc.). Details below relate to the overall submission
            or the first part based on available API data. Specific partition
            data may require visiting Congress.gov.
          </div>
        )}

        {/* Latest Action */}
        {nomination.latestAction?.text && (
          <div className="latest-action">
            <strong>Latest Action Recorded for {citation}:</strong> (
            {nomination.latestAction.actionDate || "N/A"}){" "}
            {nomination.latestAction.text}
          </div>
        )}

        {/* Nominee/Position Info */}
        {nomination.nominees && nomination.nominees.length > 0 ? (
          <div className="nominees-section">
            <h4>Listed Nominee(s)/Position(s)</h4>
            <ul>
              {nomination.nominees.map((group, index) => (
                <li key={group.ordinal || index}>
                  {nomination.nominees.length > 1 && group.ordinal && (
                    <em>Part {group.ordinal}:</em>
                  )}
                  <br />
                  <strong>Position:</strong>{" "}
                  {group.positionTitle ||
                    group.introText ||
                    "Position details unavailable"}
                  <br />
                  {group.nomineeCount && (
                    <em>
                      ({group.nomineeCount} Nominee
                      {group.nomineeCount !== 1 ? "s" : ""})
                    </em>
                  )}
                </li>
              ))}
            </ul>
            {nomination.congressDotGovUrl && (
              <p className="explore-link">
                <a
                  href={nomination.congressDotGovUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Explore All Parts & Nominees on Congress.gov »
                </a>
              </p>
            )}
          </div>
        ) : nomination.description ? ( // Fallback
          <div className="description">
            <h4>Description</h4>
            <p>{nomination.description}</p>
          </div>
        ) : null}
      </section>

      <section className="detail-associated-items-grid">
        {/* Actions Section */}
        <div className="detail-item">
          <h4>
            Actions ({totalActionCount}){" "}
            <span className="api-note">(for {citation})</span>
          </h4>
          {actions && actions.length > 0 ? (
            <ul className="action-list">
              {actions.map((action, index) => (
                <li key={`${action.actionDate}-${index}`}>
                  <strong>{action.actionDate}:</strong> {action.text}
                  {/* TODO: Link committees mentioned in actions if data is available */}
                </li>
              ))}
              {nomination.actions?.count > actions.length &&
                nomination.congressDotGovUrl && (
                  <li>
                    <a
                      href={`${nomination.congressDotGovUrl}/actions`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View all {nomination.actions.count} actions...
                    </a>
                  </li>
                )}
            </ul>
          ) : totalActionCount > 0 ? ( // If count exists but list is empty
            nomination.congressDotGovUrl ? (
              <p>
                <a
                  href={`${nomination.congressDotGovUrl}/actions`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View {totalActionCount} Actions on Congress.gov
                </a>
              </p>
            ) : (
              <p>{totalActionCount} actions recorded (details not loaded).</p>
            )
          ) : (
            <p>No actions recorded for the base nomination via API.</p>
          )}
        </div>

        {/* Committees Section */}
        <div className="detail-item">
          <h4>
            Committees Referred To ({totalCommitteeCount}){" "}
            <span className="api-note">(for {citation})</span>
          </h4>
          {committees && committees.length > 0 ? (
            <ul className="committee-list">
              {committees.map((comm) => (
                <li key={comm.systemCode}>
                  {comm.detailPageUrl ? (
                    <Link to={comm.detailPageUrl}>
                      {comm.name || "Unknown Committee"}
                    </Link>
                  ) : (
                    comm.name || "Unknown Committee"
                  )}
                  {comm.activities &&
                    ` (${comm.activities.map((a) => a.name).join(", ")})`}
                </li>
              ))}
              {nomination.committees?.count > committees.length &&
                nomination.congressDotGovUrl && (
                  <li>
                    <a
                      href={`${nomination.congressDotGovUrl}/committees`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View all {nomination.committees.count} committees...
                    </a>
                  </li>
                )}
            </ul>
          ) : totalCommitteeCount > 0 ? (
            nomination.congressDotGovUrl ? (
              <p>
                <a
                  href={`${nomination.congressDotGovUrl}/committees`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View {totalCommitteeCount} Committee(s) on Congress.gov
                </a>
              </p>
            ) : (
              <p>{totalCommitteeCount} committee(s) referred.</p>
            )
          ) : (
            <p>
              No committee referrals listed for the base nomination via API.
            </p>
          )}
        </div>

        {/* Hearings Section */}
        <div className="detail-item">
          <h4>Hearings ({nomination.hearings?.count ?? 0})</h4>
          {nomination.hearings?.count > 0 && nomination.congressDotGovUrl ? (
            <p>
              <a
                href={`${nomination.congressDotGovUrl}/hearings`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Hearings on Congress.gov
              </a>
            </p>
          ) : nomination.hearings?.count > 0 ? (
            <p>{nomination.hearings.count} hearing(s) recorded.</p>
          ) : (
            <p>No hearings listed.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default NominationDetailPage;
