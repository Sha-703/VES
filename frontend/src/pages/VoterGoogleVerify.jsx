
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { FormContainer, Alert, FormField } from '../components/FormComponents';
import { voterLogin } from '../services/api';

export default function VoterGoogleVerify() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const institution_id = localStorage.getItem('institution_id');
  const identifier = localStorage.getItem('voter_identifier'); // Utilise le matricule réel
  const email = localStorage.getItem('voter_email');
  const voter_id = localStorage.getItem('voter_id');

  useEffect(() => {
    if (!voter_id || voter_id === 'undefined' || voter_id === 'null') {
      setError("Session expirée ou identifiant électeur manquant. Veuillez vous reconnecter.");
      setTimeout(() => navigate('/voter/login'), 2000);
    }
  }, [voter_id, navigate]);

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      // On envoie le token Google au backend pour vérification
      const res = await voterLogin(identifier, institution_id, credentialResponse.credential, email);
      if (res.data.token) localStorage.setItem('token', res.data.token);
      navigate('/voter/ballots');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la vérification Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Erreur lors de la connexion Google.');
  };

  return (
    <FormContainer title="Vérification Google" submitText={null} loading={loading}>
      {error && <Alert type="error">{error}</Alert>}
      <div style={{ margin: '20px 0', textAlign: 'center' }}>
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          useOneTap
        />
        <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
          Connectez-vous avec Google pour accéder au vote.
        </div>
      </div>
    </FormContainer>
  );
}
