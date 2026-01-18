import React, { useState } from 'react';
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


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await voterLogin(form.identifier, form.institution_id, null, form.email);
      localStorage.setItem('voter_id', res.data.voter_id);
      localStorage.setItem('voter_identifier', form.identifier); // Stocke le matricule réel
      localStorage.setItem('voter_email', form.email); // Stocke l'email
      if (res.data.name) localStorage.setItem('voter_name', res.data.name);
      localStorage.setItem('institution_id', form.institution_id);
      // Rediriger vers la vérification Google
      navigate('/voter/google-verify');
    } catch (err) {
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
        label="Email (utilisé pour Google)"
        name="email"
        type="email"
        value={form.email}
        onChange={handleChange}
        required
      />
    </FormContainer>
  );
}
