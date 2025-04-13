import React from 'react';
import { useParams } from 'react-router-dom';
import '../styles/BrowsePages.css';

function CommitteeDetailPage() {
  const { chamber, committeeCode } = useParams();
  return (
    <div>
      <h2>Committee Detail Page</h2>
      <p>Chamber: {chamber}, Code: {committeeCode}</p>
      {/* Detail content will go here */}
    </div>
  );
}
export default CommitteeDetailPage;