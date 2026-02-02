import React from 'react';
import { Navigate } from 'react-router-dom';

// Redirect to MyCards - auction creation is handled via modal there
function CreateAuction() {
  return <Navigate to="/my-cards" replace />;
}

export default CreateAuction;
