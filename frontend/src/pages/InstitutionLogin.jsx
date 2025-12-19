import React, { useState } from 'react';
import { institutionLogin } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';
import { FormField, FormContainer, Alert } from '../components/FormComponents';

export default function InstitutionLogin() {
  const [form, setForm] = useState({ institution_name: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // No verification gate: users can attempt login immediately after registration.

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Verification requirement removed: allow login attempt immediately
    setLoading(true);
    setError('');
    try {
      const res = await institutionLogin(form.institution_name, form.password);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('institution_id', res.data.institution.id);
      navigate('/institution/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormContainer title="Connexion Institution" onSubmit={handleSubmit} submitText="Se connecter" loading={loading}>
      {error && <Alert type="error">{error}</Alert>}
      {/* Verification removed */}
      <FormField
        label="Nom de l'institution"
        name="institution_name"
        value={form.institution_name}
        onChange={handleChange}
        required
      />
      <FormField
        label="Mot de passe"
        type="password"
        name="password"
        value={form.password}
        onChange={handleChange}
        required
      />
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <p>Pas encore inscrit ? <Link to="/institution/register">Créer un compte</Link></p>
      </div>
    </FormContainer>
  );
}
