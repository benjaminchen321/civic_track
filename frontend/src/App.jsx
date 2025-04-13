// FILE: frontend/src/App.jsx
import React from "react";
// --- Import Router components ---
import { Routes, Route, Link } from "react-router-dom";

// --- Import Page Components ---
import MemberSearchPage from "./pages/MemberSearchPage";
import BrowseBillsPage from "./pages/BrowseBillsPage";
import BillDetailPage from "./pages/BillDetailPage";
import BrowseCommitteesPage from "./pages/BrowseCommitteesPage";
import CommitteeDetailPage from "./pages/CommitteeDetailPage";
import BrowseNominationsPage from "./pages/BrowseNominationsPage";
import NominationDetailPage from "./pages/NominationDetailPage";
import NotFoundPage from "./pages/NotFoundPage";

// --- Import App specific CSS ---
import "./App.css";

function App() {
  return (
    <div className="app-container">
      {/* --- Header --- */}
      <header className="app-header">
        <div className="logo-title">
          <h1>CivicTrack</h1>
        </div>
        {/* --- Navigation Links --- */}
        <nav className="main-nav">
          <Link to="/">Member Search</Link>
          <Link to="/bills">Browse Bills</Link>
          <Link to="/committees">Browse Committees</Link>
          <Link to="/nominations">Browse Nominations</Link>
        </nav>
      </header>

      {/* --- Main Content Area where Pages Render --- */}
      <main className="app-main-content">
        <Routes>
          {/* --- Define Routes --- */}
          <Route path="/" element={<MemberSearchPage />} />

          <Route path="/bills" element={<BrowseBillsPage />} />
          <Route
            path="/bill/:congress/:billType/:billNumber"
            element={<BillDetailPage />}
          />

          <Route path="/committees" element={<BrowseCommitteesPage />} />
          <Route
            path="/committee/:chamber/:committeeCode"
            element={<CommitteeDetailPage />}
          />

          <Route path="/nominations" element={<BrowseNominationsPage />} />
          <Route
            path="/nomination/:congress/:nominationNumber"
            element={<NominationDetailPage />}
          />

          {/* Catch-all 404 Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      {/* --- Footer --- */}
      <footer className="app-footer">
        <p>
          © {new Date().getFullYear()} CivicTrack. Data via Congress.gov API.
        </p>
      </footer>
    </div>
  );
}

export default App;
