import React, { useState, useEffect } from 'react';
import { getElections, createElection, getMyInstitution, importVoters, importVotersPreview, getVoterSummary } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';
import { FormContainer, FormField, Card, Alert } from '../components/FormComponents';

const styles = {
  container: {
    padding: '20px',
    width: '100%',
    maxWidth: '100%',
    margin: '0',
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  metricsRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 18,
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  metricCard: {
    flex: '1 1 0',
    minWidth: 160,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), #fff)',
    border: '1px solid #eee',
    padding: 12,
    borderRadius: 8,
    boxShadow: '0 4px 10px rgba(17,24,39,0.03)',
  },
  metricTitle: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  metricValue: { fontSize: 22, fontWeight: 700, color: '#111827' },
  metricSubtitle: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
  searchInput: { padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', minWidth: 220 },
  selectInput: { padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' },
  electionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 },
  electionCard: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 160, backgroundColor: '#fff', border: '1px solid #e6e6e6', borderRadius: 10, padding: 16, boxShadow: '0 8px 20px rgba(15,23,42,0.04)' },
  electionCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  electionTitle: { margin: 0, fontSize: 18, maxWidth: '70%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  electionCardBody: { marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  badge: { fontSize: 12, padding: '6px 10px', borderRadius: 999, background: '#eef2ff', color: '#3730a3', fontWeight: 700 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '18px',
  },
  logoutBtn: {
    backgroundColor: '#dc3545',
    color: 'white',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  section: {
    marginBottom: '20px',
  },
  form: {
    backgroundColor: '#f9f9f9',
    padding: '20px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  formGroup: {
    marginBottom: '15px',
    display: 'flex',
    flexDirection: 'column',
  },
  button: {
    backgroundColor: '#007bff',
    color: 'white',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginBottom: '15px',
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '15px',
  },
  list: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '15px',
  },
  card: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '15px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  link: {
    color: '#007bff',
    textDecoration: 'none',
    fontWeight: 'bold',
  },
};

export default function InstitutionDashboard() {
  const [institution, setInstitution] = useState(null);
  const [elections, setElections] = useState([]);
  // suppression de l'état de formulaire en ligne — la création se fait désormais sur une page dédiée
  const [form, setForm] = useState({ title: '', description: '', scrutin_type: 'majoritaire_1tour' });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [voterSummary, setVoterSummary] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/institution/login');
      return;
    }
    loadData();
  }, []);

  // Poll periodically to refresh elections so expired elections are shown as closed promptly.
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        loadData();
      } catch (e) {
        // ignore polling errors
      }
    }, 30000); // 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const inst = await getMyInstitution();
      setInstitution(inst.data);
      const elecs = await getElections();
      setElections(elecs.data);
      try {
        const vs = await getVoterSummary();
        // Si eligible_voters est 0 mais que le dernier import signale des lignes, préférer cette valeur
        // afin que le tableau de bord reflète immédiatement les données uploadées.
        const summary = vs.data || {};
        if ((summary.eligible_voters === 0 || summary.eligible_voters === undefined) && summary.last_import && summary.last_import.detail && (summary.last_import.detail.total_rows || summary.last_import.detail.total_rows === 0)) {
          summary.eligible_voters = summary.last_import.detail.total_rows;
        }
        setVoterSummary(summary);
      } catch (e) {
        // ignorer les erreurs de résumé
      }
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/institution/login');
      } else {
        setError('Erreur de chargement');
      }
    }
  };

  const handleFileChange = (e) => {
    setImportResult(null);
    setPreviewResult(null);
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file) {
      // appeler l'endpoint de preview pour obtenir les comptes
      importVotersPreview(institution.id, file).then((resp) => {
        setPreviewResult(resp.data);
      }).catch((err) => {
        // ne pas bloquer la sélection en cas d'erreurs de preview
        setPreviewResult(null);
        setError(err.response?.data?.detail || 'Impossible d\'analyser le fichier pour prévisualisation.');
      });
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Veuillez sélectionner un fichier CSV ou XLSX.');
      return;
    }
    setImportLoading(true);
    setError('');
    try {
      const resp = await importVoters(institution.id, selectedFile);
      setImportResult(resp.data);
      // recharger les données pour refléter les nouveaux votants créés : actualiser le résumé et les données complètes
      try {
        const vs = await getVoterSummary();
        setVoterSummary(vs.data);
      } catch (e) {
        // repli sur rechargement complet
        loadData();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'import.');
    } finally {
      setImportLoading(false);
      setSelectedFile(null);
      // reset file input value by clearing the element (handled in JSX via key)
    }
  };

  const handleCreateElection = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createElection(form.title, form.description, form.scrutin_type);
      setForm({ title: '', description: '', scrutin_type: 'majoritaire_1tour' });
      loadData();
    } catch (err) {
      setError('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('institution_id');
    navigate('/');
  };

  if (!institution) {
    return <div>Chargement...</div>;
  }

  // derived metrics
  const totalBallots = elections.reduce((s, e) => s + (e.ballots?.length || 0), 0);
  const totalCandidates = elections.reduce((s, e) => s + (e.candidates?.length || 0), 0);

  return (
    <div className="container app-main">
      <div style={styles.headerTop}>
        <div>
          <h1 style={{ margin: 0 }}>{institution.name}</h1>
          <div style={{ color: '#6b7280', marginTop: 4 }}>{institution.description}</div>
          <div style={{ marginTop: 8, color: '#777', fontSize: 13 }}>ID : <strong>{institution.id}</strong></div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => navigate('/institution/election/new')} className="btn-primary">Créer une élection</button>
          <button onClick={() => navigate('/institution/settings')} className="btn-secondary">Paramètres</button>
          <button onClick={handleLogout} className="btn-secondary">Déconnexion</button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div style={styles.metricsRow}>
        <div className="card fade-in stagger-1" style={styles.metricCard}>
          <div style={styles.metricTitle}>Élections</div>
          <div style={styles.metricValue}>{elections.length}</div>
          <div style={styles.metricSubtitle}>Élections actives et brouillons</div>
        </div>
        <div className="card fade-in stagger-2" style={styles.metricCard}>
          <div style={styles.metricTitle}>Scrutins</div>
          <div style={styles.metricValue}>{totalBallots}</div>
          <div style={styles.metricSubtitle}>Fenêtres de vote</div>
        </div>
        <div className="card fade-in stagger-3" style={styles.metricCard}>
          <div style={styles.metricTitle}>Candidats</div>
          <div style={styles.metricValue}>{totalCandidates}</div>
          <div style={styles.metricSubtitle}>Nombre total de candidats</div>
        </div>
        <div className="card fade-in stagger-4" style={styles.metricCard}>
          <div style={styles.metricTitle}>Électeurs (éligibles)</div>
          <div style={styles.metricValue}>{voterSummary ? voterSummary.eligible_voters : '—'}</div>
          <div style={styles.metricSubtitle}>Électeurs éligibles dans la base</div>
        </div>
        <div className="card fade-in stagger-5" style={styles.metricCard}>
          <div style={styles.metricTitle}>Électeurs attendus</div>
          <div style={styles.metricValue}>{voterSummary && voterSummary.last_import && voterSummary.last_import.detail ? (voterSummary.last_import.detail.total_rows ?? '—') : '—'}</div>
          <div style={styles.metricSubtitle}>Lignes du dernier fichier importé</div>
        </div>
      </div>

      {/* Elections section (full width) */}
      <div style={{ width: '100%', padding: '0 12px', boxSizing: 'border-box', marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }} className="fade-in stagger-3">
          <h2 style={{ margin: 0 }}>Vos élections</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input placeholder="Rechercher par titre…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchInput} />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={styles.selectInput}>
              <option value="">Tous types de scrutin</option>
              <option value="majoritaire_1tour">Majoritaire — 1 tour</option>
              <option value="majoritaire_2tours">Majoritaire — 2 tours</option>
            </select>
          </div>
        </div>

        <div style={styles.electionGrid} className="fade-in">
          {elections.filter((elec) => {
            const matchesSearch = !searchQuery || elec.title.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = !filterType || elec.scrutin_type === filterType;
            return matchesSearch && matchesType;
          }).map((elec, idx) => (
            <div key={elec.id} className={`card fade-in`} style={{ ...styles.electionCard, animationDelay: `${idx * 40}ms` }}>
              <div style={styles.electionCardHeader}>
                <div>
                  <h3 style={styles.electionTitle}>{elec.title}</h3>
                  <div style={{ color: '#6b7280', fontSize: 13, marginTop: 6, maxHeight: 42, overflow: 'hidden' }}>{elec.description}</div>
                </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 140 }}>
                      <div style={styles.badge}>{elec.scrutin_type === 'majoritaire_2tours' ? 'Majoritaire — 2 tours' : 'Majoritaire — 1 tour'}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 6 }}>
                          {/* Status mini-card with animated dot using inline SVG (no external CSS needed) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '6px 8px', borderRadius: 8, border: '1px solid #eee', minWidth: 110, justifyContent: 'center' }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                              <circle cx="7" cy="7" r="5" fill={elec.is_open || (elec.ballots && elec.ballots.some(b => b.status === 'open')) ? '#10b981' : '#9ca3af'}>
                                <animate attributeName="r" values={elec.is_open || (elec.ballots && elec.ballots.some(b => b.status === 'open')) ? '4;6;4' : '4;4'} dur="1.2s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values={elec.is_open || (elec.ballots && elec.ballots.some(b => b.status === 'open')) ? '1;0.6;1' : '1;1'} dur="1.2s" repeatCount="indefinite" />
                              </circle>
                            </svg>
                            <div style={{ fontSize: 12, color: elec.is_open || (elec.ballots && elec.ballots.some(b => b.status === 'open')) ? '#065f46' : '#374151', fontWeight: 700 }}>
                              {elec.is_open || (elec.ballots && elec.ballots.some(b => b.status === 'open')) ? 'Ouverte' : 'Fermée'}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button onClick={() => navigate(`/institution/election/${elec.id}/results`)} className="btn-small">Voir résultats</button>
                          <Link to={`/institution/election/${elec.id}`} className="btn-small btn-primary">Gérer</Link>
                        </div>
                      </div>
                    </div>
              </div>

              <div style={styles.electionCardBody}>
                  <div style={{ color: '#444', fontWeight: 600 }}>{elec.voted_voters_count ?? 0} votants • {(elec.candidates?.length ?? 0)} candidats</div>
                <div style={{ fontSize: 12, color: '#888' }}>Créée le {new Date(elec.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Import card (below elections) */}
      <div style={{ width: '100%', padding: '12px', boxSizing: 'border-box', marginTop: 18 }}>
        <div className="card small-card slide-up stagger-2" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Left: title + histórico */}
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <h4 style={{ margin: 0, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Importer des électeurs</h4>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title="Fichier CSV / Excel — prévisualisation disponible après sélection.">CSV / Excel — prévisualisation après sélection</div>
              </div>
              <div style={{ flex: '0 0 auto', marginLeft: 8 }}>
                <button className="btn-secondary" onClick={() => navigate('/institution/imports')} style={{ padding: '6px 8px', fontSize: 13, whiteSpace: 'nowrap' }}>Historique</button>
              </div>
            </div>
          </div>

          {/* Middle: file input (expands) */}
          <div style={{ flex: '1 1 360px', minWidth: 160 }}>
            <input style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd' }} key={selectedFile ? selectedFile.name : 'file-input'} type="file" accept=".csv, .xlsx, .xls" onChange={handleFileChange} />
            {selectedFile && (
              <div style={{ marginTop: 8, fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedFile.name}>
                📄 {selectedFile.name}
              </div>
            )}
          </div>

          {/* Right: action buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flex: '0 0 auto' }}>
            <button type="button" className="btn-primary" onClick={(e) => { e.preventDefault(); handleImportSubmit(e); }} disabled={importLoading || !selectedFile} style={{ padding: '8px 12px', fontSize: 14 }}>{importLoading ? 'Import…' : 'Importer'}</button>
            <button type="button" className="btn-secondary" onClick={() => setSelectedFile(null)} style={{ padding: '8px 12px', fontSize: 14 }} disabled={!selectedFile}>Annuler</button>
          </div>

          {/* Full-width: feedback / preview */}
          <div style={{ flexBasis: '100%', marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {importLoading && <div style={{ fontSize: 13, color: '#374151' }}>Traitement du fichier…</div>}
              {importResult && <div style={{ fontSize: 13, color: '#155724' }}>{(importResult.created || 0)} créés • {(importResult.updated || 0)} mis à jour</div>}
              {previewResult && (
                <div style={{ fontSize: 13, color: '#374151', background: '#eef6ff', padding: '6px 10px', borderRadius: 6 }}>
                  {previewResult.total_rows} lignes • {previewResult.eligible} ok • {previewResult.invalid} invalid
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}