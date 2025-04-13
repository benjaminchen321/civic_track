// FILE: frontend/src/pages/BillDetailPage.jsx
import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom"; // Import Link for internal nav
import { fetchBillDetail } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import '../styles/DetailPage.css';

function BillDetailPage() {
  const { congress, billType, billNumber } = useParams(); // Get params from URL
  const [billDataPackage, setBillDataPackage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadBillData = async () => {
      setIsLoading(true);
      setError(null);
      console.log(
        `Fetching details for: ${congress}-${billType}-${billNumber}`
      );
      const { data, error: apiError } = await fetchBillDetail(
        congress,
        billType,
        billNumber
      );

      if (apiError) {
        setError(apiError);
        setBillDataPackage(null);
      } else if (data && data.data) {
        // Backend returns data nested under 'data' key
        setBillDataPackage(data.data); // Contains {bill:..., actions:[], cosponsors:[], ...}
      } else {
        setError("Received unexpected data structure for bill details.");
        setBillDataPackage(null);
      }
      setIsLoading(false);
    };

    loadBillData();
  }, [congress, billType, billNumber]); // Re-fetch if params change

  // Render logic
  if (isLoading) {
    return <LoadingSpinner />;
  }
  if (error) {
    return <ErrorMessage message={error} />;
  }
  if (!billDataPackage || !billDataPackage.bill) {
    // This case might be caught by error state, but good fallback
    return <ErrorMessage message="Bill data could not be loaded." />;
  }

  // --- Data Extraction ---
  const {
    bill,
    actions,
    cosponsors,
    committees,
    relatedBills,
    amendments,
    summaries,
  } = billDataPackage;
  const billDisplay = `${bill.type || "?"}${bill.number ?? "?"}`;

  return (
    <div className="detail-page-container bill-detail-react">
      {" "}
      {/* Use distinct class */}
      <header className="page-header-react">
        <h2>
          {billDisplay}{" "}
          <span className="congress-tag">({bill.congress}th Congress)</span>
        </h2>
        <nav>
          <Link to="/bills">« Back to Browse Bills</Link>
          {bill.congressDotGovUrl && (
            <>
              {" "}
              |{" "}
              <a
                href={bill.congressDotGovUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Congress.gov
              </a>
            </>
          )}
        </nav>
      </header>
      <section className="detail-summary-section">
        <h3>{bill.title || "No Title Available"}</h3>
        <div className="detail-meta">
          <span>
            <strong>Introduced:</strong> {bill.introducedDate || "N/A"}
          </span>{" "}
          |
          <span>
            <strong>Origin:</strong> {bill.originChamber || "N/A"}
          </span>
          {bill.policyArea && (
            <>
              {" "}
              |{" "}
              <span>
                <strong>Policy Area:</strong> {bill.policyArea.name}
              </span>
            </>
          )}
        </div>
        {bill.latestAction && (
          <div className="latest-action">
            <strong>Latest Action:</strong> (
            {bill.latestAction.actionDate || "N/A"}){" "}
            {bill.latestAction.text || "N/A"}
          </div>
        )}

        {/* Display Summary */}
        {summaries && summaries.length > 0 ? (
          <>
            <h4>Latest Summary</h4>
            {/* Render HTML safely or use a library if needed */}
            <div
              className="summary-text"
              dangerouslySetInnerHTML={{ __html: summaries[0].text }}
            ></div>
          </>
        ) : bill.summaries?.count > 0 ? (
          <p>
            <a
              href={`${bill.congressDotGovUrl}/summaries`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View {bill.summaries.count} Summaries on Congress.gov
            </a>
          </p>
        ) : (
          <p>No summaries available.</p>
        )}
      </section>
      <section className="detail-associated-items-grid">
        {/* Actions */}
        <div className="detail-item">
          <h4>Actions ({bill.actions?.count ?? actions?.length ?? 0})</h4>
          {actions && actions.length > 0 ? (
            <ul className="action-list">
              {actions.map((action, index) => (
                <li key={`${action.actionDate}-${index}`}>
                  <strong>{action.actionDate}:</strong> {action.text}
                  {/* TODO: Render vote links if needed */}
                </li>
              ))}
              {bill.actions?.count > actions.length &&
                bill.congressDotGovUrl && (
                  <li>
                    <a
                      href={`${bill.congressDotGovUrl}/actions`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View all {bill.actions.count} actions...
                    </a>
                  </li>
                )}
            </ul>
          ) : bill.actions?.count > 0 ? (
            <p>
              <a
                href={`${bill.congressDotGovUrl}/actions`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Actions on Congress.gov
              </a>
            </p>
          ) : (
            <p>No actions recorded.</p>
          )}
        </div>

        {/* Cosponsors */}
        <div className="detail-item">
          <h4>
            Cosponsors ({bill.cosponsors?.count ?? cosponsors?.length ?? 0})
          </h4>
          {cosponsors && cosponsors.length > 0 ? (
            <ul className="cosponsor-list">
              {cosponsors.map((cs) => (
                <li key={cs.bioguideId}>
                  {/* Link back to member search page with hash */}
                  <Link
                    to={`/?#member=${cs.bioguideId}`}
                    title={`View details for ${cs.fullName}`}
                  >
                    {cs.fullName}
                  </Link>
                  ({cs.sponsorshipDate}
                  {cs.sponsorshipWithdrawnDate
                    ? ` - Withdrawn ${cs.sponsorshipWithdrawnDate}`
                    : ""}
                  )
                </li>
              ))}
              {bill.cosponsors?.count > cosponsors.length &&
                bill.congressDotGovUrl && (
                  <li>
                    <a
                      href={`${bill.congressDotGovUrl}/cosponsors`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View all {bill.cosponsors.count} cosponsors...
                    </a>
                  </li>
                )}
            </ul>
          ) : bill.cosponsors?.count > 0 ? (
            <p>
              <a
                href={`${bill.congressDotGovUrl}/cosponsors`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Cosponsors on Congress.gov
              </a>
            </p>
          ) : (
            <p>No cosponsors.</p>
          )}
        </div>

        {/* Committees */}
        <div className="detail-item">
          <h4>
            Committees ({bill.committees?.count ?? committees?.length ?? 0})
          </h4>
          {committees && committees.length > 0 ? (
            <ul className="committee-list">
              {committees.map((comm) => (
                <li key={comm.systemCode}>
                  {comm.detailPageUrl ? (
                    <Link
                      to={comm.detailPageUrl}
                      title={`View details for ${comm.name}`}
                    >
                      {comm.name}
                    </Link>
                  ) : (
                    comm.name || "Unknown Committee"
                  )}
                  {comm.activities &&
                    ` (${comm.activities.map((a) => a.name).join(", ")})`}
                </li>
              ))}
              {bill.committees?.count > committees.length &&
                bill.congressDotGovUrl && (
                  <li>
                    <a
                      href={`${bill.congressDotGovUrl}/committees`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View all {bill.committees.count} committees...
                    </a>
                  </li>
                )}
            </ul>
          ) : bill.committees?.count > 0 ? (
            <p>
              <a
                href={`${bill.congressDotGovUrl}/committees`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Committees on Congress.gov
              </a>
            </p>
          ) : (
            <p>No committee referrals.</p>
          )}
        </div>

        {/* Related Bills */}
        <div className="detail-item">
          <h4>
            Related Bills (
            {bill.relatedBills?.count ?? relatedBills?.length ?? 0})
          </h4>
          {relatedBills && relatedBills.length > 0 ? (
            <ul className="related-list">
              {relatedBills.map((rb) => (
                <li key={`${rb.congress}-${rb.type}-${rb.number}`}>
                  {rb.detailPageUrl ? (
                    <Link to={rb.detailPageUrl}>
                      {rb.type}
                      {rb.number}
                    </Link>
                  ) : (
                    <strong>
                      {rb.type}
                      {rb.number}
                    </strong>
                  )}
                  : {rb.title}
                  <span className="relation-type">
                    ({rb.relationshipDetails?.[0]?.type || "Related"})
                  </span>
                </li>
              ))}
              {bill.relatedBills?.count > relatedBills.length &&
                bill.congressDotGovUrl && (
                  <li>
                    <a
                      href={`${bill.congressDotGovUrl}/related-bills`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View all {bill.relatedBills.count} related bills...
                    </a>
                  </li>
                )}
            </ul>
          ) : bill.relatedBills?.count > 0 ? (
            <p>
              <a
                href={`${bill.congressDotGovUrl}/related-bills`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Related Bills on Congress.gov
              </a>
            </p>
          ) : (
            <p>No related bills.</p>
          )}
        </div>

        {/* Amendments */}
        <div className="detail-item">
          <h4>
            Amendments ({bill.amendments?.count ?? amendments?.length ?? 0})
          </h4>
          {amendments && amendments.length > 0 ? (
            <ul className="amendment-list">
              {amendments.map((amdt) => (
                <li key={`${amdt.congress}-${amdt.type}-${amdt.number}`}>
                  {amdt.congressDotGovUrl ? (
                    <a
                      href={amdt.congressDotGovUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {amdt.type}
                      {amdt.number}
                    </a>
                  ) : (
                    <strong>
                      {amdt.type}
                      {amdt.number}
                    </strong>
                  )}
                  : {amdt.description || amdt.purpose || "No description"}
                  {amdt.latestAction && (
                    <span className="latest-action-meta">
                      (Latest: {amdt.latestAction.actionDate})
                    </span>
                  )}
                </li>
              ))}
              {bill.amendments?.count > amendments.length &&
                bill.congressDotGovUrl && (
                  <li>
                    <a
                      href={`${bill.congressDotGovUrl}/amendments`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View all {bill.amendments.count} amendments...
                    </a>
                  </li>
                )}
            </ul>
          ) : bill.amendments?.count > 0 ? (
            <p>
              <a
                href={`${bill.congressDotGovUrl}/amendments`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Amendments on Congress.gov
              </a>
            </p>
          ) : (
            <p>No amendments.</p>
          )}
        </div>

        {/* Placeholder for Text Versions Link */}
        <div className="detail-item">
          <h4>Text Versions ({bill.textVersions?.count ?? 0})</h4>
          {bill.textVersions?.count > 0 && bill.congressDotGovUrl ? (
            <p>
              <a
                href={`${bill.congressDotGovUrl}/text`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Text Versions on Congress.gov
              </a>
            </p>
          ) : bill.textVersions?.count > 0 ? (
            <p>{bill.textVersions.count} text version(s) available.</p>
          ) : (
            <p>No text versions listed.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default BillDetailPage;
