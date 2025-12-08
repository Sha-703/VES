import React, { useState } from 'react';
import { institutionRegister } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { FormField, FormContainer, Alert } from '../components/FormComponents';

export default function InstitutionRegister() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    institution_name: '',
    institution_description: '',
  });
  const [error, setError] = useState('');
  // successMessage removed: we don't show a success banner after register
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
      // Générer un nom d'utilisateur sûr côté client à partir du nom ou de l'email de l'institution
      const raw = (form.institution_name || form.email || 'institution').toString();
      const username = raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 140) || `inst_${Date.now()}`;

      const res = await institutionRegister(
        username,
        form.email,
        form.password,
        form.institution_name,
        form.institution_description
      );
      // Registration successful — redirect to the login page so the user can authenticate immediately.
      setTimeout(() => navigate('/institution/login'), 600);
    } catch (err) {
      // Extraire les messages d'erreur renvoyés par le backend (peut être un objet champ -> [erreurs])
      const data = err.response?.data;
      let message = 'Erreur d\'enregistrement';
      if (data) {
        if (typeof data === 'string') message = data;
        else if (data.detail) message = data.detail;
        else if (typeof data === 'object') {
          // aplatir les erreurs de champ en une chaîne lisible par l'humain
          const parts = [];
          for (const [k, v] of Object.entries(data)) {
            if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`);
            else parts.push(`${k}: ${v}`);
          }
          if (parts.length) message = parts.join(' • ');
        }
      }
      console.error('Registration error response', err.response || err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormContainer title="Créer un compte Institution" onSubmit={handleSubmit} submitText="S'inscrire" loading={loading}>
      {error && <Alert type="error">{error}</Alert>}
      <FormField
        label="Nom de l'institution"
        name="institution_name"
        value={form.institution_name}
        onChange={handleChange}
        required
      />
      <FormField
        label="Email"
        type="email"
        name="email"
        value={form.email}
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
      <FormField
        label="Description"
        name="institution_description"
        value={form.institution_description}
        onChange={handleChange}
        rows="4"
      />
    </FormContainer>
  );
}
