import React from 'react';
import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div>
      <h2>404 - Page Not Found</h2>
      <p>Sorry, the page you requested does not exist.</p>
      <Link to="/">Go Home</Link>
    </div>
  );
}
export default NotFoundPage;