import React, { useState } from 'react';
import { voterLogin } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { FormField, FormContainer, Alert } from '../components/FormComponents';

export default function VoterLogin() {
  const [form, setForm] = useState({ identifier: '', institution_id: '' });
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
      const res = await voterLogin(form.identifier, form.institution_id);
      localStorage.setItem('voter_id', res.data.voter_id);
      // le backend renvoie parfois encore un nom de votant ; le sauvegarder si présent
      if (res.data.name) localStorage.setItem('voter_name', res.data.name);
      localStorage.setItem('institution_id', form.institution_id);
      navigate('/voter/ballots');
    } catch (err) {
      setError(err.response?.data?.detail || 'Matricule invalide ou institution incorrecte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormContainer title="Connexion Électeur" onSubmit={handleSubmit} submitText="Se connecter" loading={loading}>
      {error && <Alert type="error">{error}</Alert>}
      <FormField
        label="Numero etablissement"
        type="number"
        name="institution_id"
        value={form.institution_id}
        onChange={handleChange}
        required
      />
      <FormField
        label="Matricule etudiant"
        name="identifier"
        value={form.identifier}
        onChange={handleChange}
        required
      />
    </FormContainer>
  );
}
