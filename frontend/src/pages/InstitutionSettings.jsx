import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyInstitution, updateMyInstitution } from '../services/api';
import { FormContainer, FormField, Alert, Card } from '../components/FormComponents';

export default function InstitutionSettings() {
  const [inst, setInst] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await getMyInstitution();
      const data = res.data || {};
      setInst(data);
      setForm({ name: data.name || data.institution_name || '', email: data.email || '', password: '', password_confirm: '' });
    } catch (e) {
      setError('Impossible de charger les paramètres.');
    }
  };

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setError('');
    setSuccess('');
    if (form.password && form.password !== form.password_confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    const payload = {};
    if (form.name !== (inst.name || inst.institution_name || '')) payload.institution_name = form.name;
    if (form.email !== (inst.email || '')) payload.email = form.email;
    if (form.password) payload.password = form.password;
    if (Object.keys(payload).length === 0) {
      setSuccess('Aucune modification détectée.');
      return;
    }
    setLoading(true);
    try {
      await updateMyInstitution(payload);
      setSuccess('Paramètres mis à jour.');
      // reload institution and go back to dashboard after short delay
      setTimeout(() => navigate('/institution/dashboard'), 900);
    } catch (err) {
      const d = err.response?.data;
      if (d) {
        if (typeof d === 'string') setError(d);
        else if (d.detail) setError(d.detail);
        else {
          // collect field errors
          const parts = [];
          for (const k of Object.keys(d)) parts.push(`${k}: ${Array.isArray(d[k]) ? d[k].join(', ') : d[k]}`);
          setError(parts.join(' • '));
        }
      } else setError('Erreur lors de la mise à jour.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <button className="btn-secondary" onClick={() => navigate(-1)} style={{ marginRight: 8 }}>← Retour</button>
          <h1 style={{ display: 'inline-block', marginLeft: 6 }}>Paramètres</h1>
          <div style={{ color: '#666', fontSize: 13 }}>Modifier le nom, le courriel ou le mot de passe.</div>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <Card>
        <FormContainer onSubmit={onSubmit} submitText={loading ? 'Enregistrement…' : 'Enregistrer'}>
          <FormField label="Nom de l'institution" name="name" value={form.name} onChange={onChange} required />
          <FormField label="Adresse e-mail" name="email" value={form.email} onChange={onChange} type="email" />
          <FormField label="Nouveau mot de passe" name="password" value={form.password} onChange={onChange} type="password" helpText="Laisser vide pour conserver l'ancien mot de passe." />
          <FormField label="Confirmer le mot de passe" name="password_confirm" value={form.password_confirm} onChange={onChange} type="password" />
        </FormContainer>
      </Card>
    </div>
  );
}
