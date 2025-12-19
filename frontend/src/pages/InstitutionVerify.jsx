import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Verification disabled: immediately redirect to login
export default function InstitutionVerify() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/institution/login');
  }, [navigate]);
  return null;
}
