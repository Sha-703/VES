import React, { useState } from 'react';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { voterLogin } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { FormField, FormContainer, Alert } from '../components/FormComponents';

export default function VoterLogin() {
  const [form, setForm] = useState({ identifier: '', institution_id: '', email: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Gestion de la réponse Google OAuth
  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse.credential) {
      setError('Erreur lors de la connexion Google.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // On envoie le token Google au backend pour vérification
      const res = await voterLogin(form.identifier, form.institution_id, credentialResponse.credential, form.email);
      localStorage.setItem('voter_id', res.data.voter_id);
      if (res.data.name) localStorage.setItem('voter_name', res.data.name);
      localStorage.setItem('institution_id', form.institution_id);
      if (res.data.token) localStorage.setItem('token', res.data.token);
      navigate('/voter/ballots');
    } catch (err) {
      const msg = err.response?.data?.detail;
      setError(msg || 'Erreur lors de la vérification Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Erreur lors de la connexion Google.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await voterLogin(form.identifier, form.institution_id);
      localStorage.setItem('voter_id', res.data.voter_id);
      // Le backend renvoie parfois encore un nom de votant ; le sauvegarder si présent
      if (res.data.name) localStorage.setItem('voter_name', res.data.name);
      localStorage.setItem('institution_id', form.institution_id);
      // Stocker le token pour authentifier les requêtes API
      if (res.data.token) localStorage.setItem('token', res.data.token);
      navigate('/voter/ballots');
    } catch (err) {
      // Affiche un message d'erreur en français si les identifiants sont invalides
      const msg = err.response?.data?.detail;
      if (msg && (msg.toLowerCase().includes('invalid credentials') || msg.toLowerCase().includes('identifiants invalides'))) {
        setError('Identifiants incorrects. Veuillez vérifier votre matricule et le numéro de l’établissement.');
      } else {
        setError(msg || 'Matricule invalide ou institution incorrecte');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormContainer title="Connexion Électeur" onSubmit={handleSubmit} submitText="Se connecter" loading={loading}>
      {error && <Alert type="error">{error}</Alert>}
      <FormField
        label="Numéro établissement"
        type="number"
        name="institution_id"
        value={form.institution_id}
        onChange={handleChange}
        required
      />
      <FormField
        label="Matricule étudiant"
        name="identifier"
        value={form.identifier}
        onChange={handleChange}
        required
      />
      <FormField
        label="Email (obligatoire pour Google)"
        name="email"
        type="email"
        value={form.email}
        onChange={handleChange}
        required
      />
      <div style={{ margin: '20px 0', textAlign: 'center' }}>
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          useOneTap
        />
        <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
          Utilisez votre compte Google pour vérifier votre identité avant de voter.
        </div>
      </div>
    </FormContainer>
  );
}
