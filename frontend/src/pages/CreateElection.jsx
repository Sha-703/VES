import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createElection } from '../services/api';
import { Alert } from '../components/FormComponents';

export default function CreateElection() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', scrutin_type: 'majoritaire_1tour', majority_threshold: 50.0, advance_threshold: 0.0, start: '', end: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      // Préparer start/end : les valeurs datetime-local sont en heure locale sans timezone.
      // Convertir en chaînes ISO (avec timezone) si fourni, sinon envoyer null.
      const startIso = form.start ? new Date(form.start).toISOString() : null;
      const endIso = form.end ? new Date(form.end).toISOString() : null;

      const resp = await createElection(
        form.title,
        form.description,
        form.scrutin_type,
        form.scrutin_type === 'majoritaire_2tours' ? form.majority_threshold : null,
        form.scrutin_type === 'majoritaire_2tours' ? form.advance_threshold : null,
        startIso,
        endIso,
        false
      );
      const created = resp.data || {};
      setSuccess('Élection créée avec succès.');
      setTimeout(() => {
        if (created.id) navigate(`/institution/election/${created.id}`);
        else navigate('/institution/dashboard');
      }, 700);
    } catch (err) {
      setError(err.response?.data?.detail || 'Impossible de créer l\'élection.');
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = { maxWidth: 920, margin: '24px auto', padding: 18 };
  const cardStyle = { background: '#fff', border: '1px solid #e6e6e6', borderRadius: 12, padding: 18, boxShadow: '0 8px 22px rgba(15,23,42,0.06)' };
  const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 };
  const titleStyle = { margin: 0, fontSize: 22 };
  const subtitleStyle = { color: '#6b7280', marginTop: 6, fontSize: 13 };
  const formRow = { display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start' };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div>
            <button onClick={() => navigate('/institution/dashboard')} className="btn-secondary" style={{ marginBottom: 6 }}>← Retour</button>
            <h1 style={titleStyle}>Créer une nouvelle élection</h1>
            <div style={subtitleStyle}>Créez une élection et ajoutez-y des scrutins et candidats ensuite.</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Conseil</div>
            <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Remplissez les informations de base</div>
          </div>
        </div>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={formRow}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Titre</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex. Élection du conseil 2025" required style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd' }} />

              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brève description (optionnelle)" rows={6} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Type de scrutin</label>
              <select value={form.scrutin_type} onChange={(e) => setForm({ ...form, scrutin_type: e.target.value })} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd' }}>
                <option value="majoritaire_1tour">Scrutin majoritaire — 1 tour</option>
                <option value="majoritaire_2tours">Scrutin majoritaire — 2 tours</option>
              </select>

              {form.scrutin_type === 'majoritaire_2tours' && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Seuil de majorité absolue (%)</label>
                  <input type="number" value={form.majority_threshold} onChange={(e) => setForm({ ...form, majority_threshold: parseFloat(e.target.value) })} min={0} max={100} step={0.1} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />

                  <label style={{ display: 'block', marginTop: 10, marginBottom: 8, fontSize: 13 }}>Seuil pour qualification au 2e tour (%)</label>
                  <input type="number" value={form.advance_threshold} onChange={(e) => setForm({ ...form, advance_threshold: parseFloat(e.target.value) })} min={0} max={100} step={0.1} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Date début (élection)</label>
                <input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />

                <label style={{ display: 'block', marginTop: 10, marginBottom: 8, fontSize: 13 }}>Date fin (élection)</label>
                <input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Actions</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '10px 14px', fontSize: 14 }}>{loading ? 'Création…' : 'Créer l\'élection'}</button>
                  <button type="button" className="btn-secondary" onClick={() => navigate('/institution/dashboard')} style={{ padding: '10px 14px', fontSize: 14 }}>Annuler</button>
                </div>
                {/* Elections are created closed by default. Use the Manage Election page to open them. */}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
