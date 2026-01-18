import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Alert, FormContainer } from '../components/FormComponents';
import axios from 'axios';

export default function VoterEmailVerify() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('pending');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const voter_id = searchParams.get('voter_id');
    const token = searchParams.get('token');
    if (!voter_id || !token) {
      setStatus('error');
      setMessage('Lien de vérification invalide.');
      return;
    }
    axios.post(`${import.meta.env.VITE_API_BASE_URL || 'https://ves-mg2a.onrender.com'}/api/auth/voter/verify_email/`, {
      voter_id,
      token,
    })
      .then(() => {
        setStatus('success');
        setMessage('Votre email a été vérifié avec succès. Vous pouvez maintenant voter.');
        setTimeout(() => navigate('/voter/login'), 3000);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.detail || 'Erreur lors de la vérification.');
      });
  }, [searchParams, navigate]);

  return (
    <FormContainer title="Vérification de l'email">
      {status === 'pending' && <Alert>Vérification en cours...</Alert>}
      {status === 'success' && <Alert type="success">{message}</Alert>}
      {status === 'error' && <Alert type="error">{message}</Alert>}
    </FormContainer>
  );
}
