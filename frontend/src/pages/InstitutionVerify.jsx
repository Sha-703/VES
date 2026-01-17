import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Vérification désactivée : redirection immédiate vers la connexion
export default function InstitutionVerify() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/');
  }, [navigate]);
  return null;
}
