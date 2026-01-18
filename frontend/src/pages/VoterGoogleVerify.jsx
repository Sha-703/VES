import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { FormContainer, Alert } from '../components/FormComponents';
import { useState } from 'react';
import { voterLogin } from '../services/api';

export default function VoterGoogleVerify() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const institution_id = localStorage.getItem('institution_id');
  const identifier = localStorage.getItem('voter_id');

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      // On envoie le token Google au backend pour vérification
      const res = await voterLogin(identifier, institution_id, credentialResponse.credential);
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
