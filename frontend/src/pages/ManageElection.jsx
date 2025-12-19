import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getElection, getVoters, deleteElection, updateElection, updateVoter, openElection, closeElection } from '../services/api';
import { Card, Alert, Modal } from '../components/FormComponents';

const styles = {
  container: { padding: 24, maxWidth: 1100, margin: '16px auto 48px', background: '#fff', borderRadius: 12, boxShadow: '0 6px 20px rgba(15,23,42,0.06)' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 },
  headerRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 260 },
  metricsGroup: { display: 'flex', gap: 12, marginTop: 10 },
  metricCardSmall: { background: '#f8fafc', padding: '10px 12px', borderRadius: 10, border: '1px solid #eef2f7', textAlign: 'center', minWidth: 120 },
  backBtn: { padding: '8px 14px', background: '#f3f4f6', color: '#111827', borderRadius: 8, border: 'none', cursor: 'pointer' },
  tabs: { display: 'flex', gap: 8, marginBottom: 18 },
  tab: { padding: '8px 14px', borderRadius: 8, background: '#eee', border: 'none', cursor: 'pointer', color: '#333' },
  tabActive: { background: 'linear-gradient(90deg,#007bff,#0056b3)', color: 'white' },
  section: { marginTop: 20 },
  form: { backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '4px', marginBottom: '20px' },
  formGroup: { marginBottom: '15px', display: 'flex', flexDirection: 'column' },
  button: { backgroundColor: '#28a745', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  error: { backgroundColor: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '4px', marginBottom: '15px' },
  list: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' },
  card: { backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  smallForm: { display: 'flex', gap: '5px', marginTop: '10px' },
  smallButton: { backgroundColor: '#007bff', color: 'white', padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  statusBadge: { padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 },
  tableHeader: { background: '#f3f4f6', textAlign: 'left', borderBottom: '1px solid #e6e6e6' },
  tableRow: { transition: 'background .15s ease' },
};

export default function ManageElection() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [election, setElection] = useState(null);
  const [ballots, setBallots] = useState([]);
  const [voters, setVoters] = useState([]);
  const [activeTab, setActiveTab] = useState('voters');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const pollRef = useRef(null);
  const [voterSearch, setVoterSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [editModalOpen, setEditModalOpen] = useState(false);
  
  const [openOverflowId, setOpenOverflowId] = useState(null);
  const [openActionsId, setOpenActionsId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [openLoading, setOpenLoading] = useState(false);

  

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/institution/login');
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chargement initial + sondage toutes les 5 secondes pour actualiser les données
  const loadData = useCallback(async () => {
    try {
      const res = await getElection(electionId);
      setElection(res.data);
      setBallots(res.data.ballots || []);
      setEditForm({ title: res.data.title, description: res.data.description });
      const vot = await getVoters();
      setVoters(vot.data || []);
      setError('');
      setLastUpdated(new Date());
    } catch (err) {
      console.error('loadData error', err);
      setError('Impossible de charger cette élection pour le moment.');
    }
  }, [electionId]);

  // Chargement initial + sondage toutes les 5 secondes pour actualiser les données
  useEffect(() => {
    loadData();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      loadData();
    }, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [loadData]);

  const handleDeleteElection = () => {
    setDeleteModalOpen(true);
    setError('');
    setSuccessMessage('');
  };

  const confirmDeleteElection = async () => {
    setDeleteLoading(true);
    setError('');
    try {
      await deleteElection(electionId);
      setSuccessMessage('Élection supprimée.');
      // petit délai puis navigation
      setTimeout(() => navigate('/institution/dashboard'), 700);
    } catch (err) {
      setError(err.response?.data?.detail || 'Impossible de supprimer l\'élection.');
    } finally {
      setDeleteLoading(false);
      setDeleteModalOpen(false);
    }
  };

  const handleUpdateElection = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await updateElection(electionId, { title: editForm.title, description: editForm.description });
      setEditModalOpen(false);
      setSuccessMessage('Élection mise à jour.');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Impossible de mettre à jour l\'élection.');
    }
  };

  const exportVotersCSV = () => {
    const header = ['id', 'identifier', 'name', 'eligible'];
    const rows = voters.map(v => [v.id, `"${v.identifier}"`, `"${(v.name || '')}"`, v.eligible ? '1' : '0']);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `election-${electionId}-voters.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleEligibility = async (voter) => {
    setError('');
    try {
      await updateVoter(voter.id, { eligible: !voter.eligible });
      // mise à jour rapide de l'état local
      setVoters((prev) => prev.map(p => p.id === voter.id ? { ...p, eligible: !p.eligible } : p));
      setSuccessMessage('Éligibilité mise à jour.');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Impossible de mettre à jour le votant.');
    }
  };

  

  

  

  if (!election) {
    if (error) {
      return (
        <div style={{ padding: 40, maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2>Problème de chargement</h2>
          <p style={{ color: '#666' }}>{error}</p>
          <div style={{ marginTop: 20 }}>
            <button onClick={() => loadData()} className="btn-primary" style={{ marginRight: 8 }}>Réessayer</button>
            <button onClick={() => navigate('/institution/dashboard')} className="btn-secondary">Retour</button>
          </div>
        </div>
      );
    }
    return <div style={{ padding: 40, textAlign: 'center' }}>Chargement…</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <button onClick={() => navigate('/institution/dashboard')} style={styles.backBtn}>← Retour</button>
          <h1 style={{ display: 'inline-block', marginLeft: 12 }}>{election.title}</h1>
          <div style={{ color: '#666', fontSize: 14 }}>{election.description}</div>
        </div>
        <div style={styles.headerRight}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {lastUpdated && (
                <div style={{ fontSize: 12, color: '#444' }}>Dernière mise à jour: <strong>{lastUpdated.toLocaleTimeString()}</strong></div>
              )}
            </div>

          {/* status badge */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ ...styles.statusBadge, background: (election?.is_open || (ballots && ballots.some(b => b.status === 'open'))) ? '#ecfdf5' : '#f3f4f6', color: (election?.is_open || (ballots && ballots.some(b => b.status === 'open'))) ? '#065f46' : '#374151' }}>
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
                <circle cx="4" cy="4" r="4" fill={(election?.is_open || (ballots && ballots.some(b => b.status === 'open'))) ? '#10b981' : '#9ca3af'} />
              </svg>
              {election?.is_open || (ballots && ballots.some(b => b.status === 'open')) ? 'Ouverte' : 'Fermée'}
            </div>
          </div>

          <div style={styles.metricsGroup}>
            <div style={styles.metricCardSmall}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Total votants</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{voters.length}</div>
            </div>
            <div style={styles.metricCardSmall}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Ont voté</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{election.voted_voters_count ?? 0}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, minWidth: 180 }}>
            { /* Open/Close election button */ }
            {election?.is_open || (ballots && ballots.some(b => b.status === 'open')) ? (
              <button className="btn-danger" style={{ width: '100%' }} disabled={openLoading} onClick={async () => {
                setOpenLoading(true);
                try {
                  const resp = await closeElection(electionId);
                  console.log('closeElection resp', resp);
                  setSuccessMessage(resp.data?.status ? `Élection ${resp.data.status}` : 'Élection fermée.');
                  // le backend peut renvoyer closed_ballots (héritage) ou closed (ids d'élection)
                  const closedIds = resp.data?.closed_ballots || resp.data?.closed || [];
                  // marquer l'élection comme fermée localement (pour que l'UI réagisse immédiatement)
                  const nowIso = new Date().toISOString();
                  setElection(prev => ({ ...prev, is_open: false, end: nowIso }));
                  // normaliser les ids en chaînes et vérifier présence
                  const closedStr = (closedIds || []).map(id => String(id));
                  if (closedStr.length > 0) {
                    if (closedStr.includes(String(electionId))) {
                      setElection(prev => ({ ...prev, is_open: false, end: nowIso }));
                    }
                    // mettre à jour les scrutins si présents
                    setBallots(prev => prev.map(b => ({ ...b, status: 'closed' })));
                  }
                  // récupérer l'état à jour de l'élection depuis le serveur et mettre à jour l'état local
                  try {
                    const fresh = await getElection(electionId);
                    setElection(fresh.data);
                    setBallots(fresh.data.ballots || []);
                  } catch (e) {
                    // retour au mécanisme de sondage
                    // continuer ; nous forcerons un rechargement complet ci-dessous
                  }
                  // forcer un rechargement complet depuis le serveur pour refléter l'état exact
                  await loadData();
                } catch (err) {
                  console.error('closeElection error', err);
                  setError(err.response ? JSON.stringify(err.response.data) : (err.message || "Impossible de fermer l'élection."));
                } finally {
                  setOpenLoading(false);
                }
              }}>{openLoading ? 'Fermeture…' : 'Fermer'}</button>
            ) : (
              <button className="btn-success" style={{ width: '100%' }} disabled={openLoading} onClick={async () => {
                setOpenLoading(true);
                try {
                  // ouvrir immédiatement pour rendre les scrutins disponibles maintenant
                  const resp = await openElection(electionId, { open_immediately: true });
                  console.log('openElection resp', resp);
                  setSuccessMessage(resp.data?.status ? `Élection ${resp.data.status}` : 'Élection ouverte.');
                  // le backend peut renvoyer opened_ballots (ids de scrutins hérités) ou opened (ids d'élection)
                  const openedIds = resp.data?.opened_ballots || resp.data?.opened || [];
                  // marquer l'élection comme ouverte localement pour mise à jour instantanée de l'UI
                  const nowIso = new Date().toISOString();
                  setElection(prev => ({ ...prev, is_open: true, start: nowIso, end: null }));
                  // normaliser les ids et mettre à jour les scrutins reçus
                  const openedStr = (openedIds || []).map(id => String(id));
                  if (openedStr.length > 0) {
                    if (openedStr.includes(String(electionId))) {
                      setElection(prev => ({ ...prev, is_open: true, start: nowIso, end: null }));
                    }
                    // mettre à jour les scrutins renvoyés par le serveur (si utilisés)
                    setBallots(prev => prev.map(b => (openedStr.includes(String(b.id)) ? { ...b, status: 'open' } : b)));
                  } else {
                    // Aucun id ouvert renvoyé — conserver le comportement mais ne pas supposer l'existence de scrutins
                    setError(`Aucun scrutin n'a été ouvert (vérifiez qu'il existe des scrutins avec des fenêtres ou utilisez 'open_immediately'). Ballots count: ${ballots.length}`);
                  }
                  // récupérer l'état à jour de l'élection depuis le serveur et mettre à jour l'état local
                  try {
                    const fresh = await getElection(electionId);
                    setElection(fresh.data);
                    setBallots(fresh.data.ballots || []);
                  } catch (e) {
                    // ignorer — nous rechargerons ci-dessous
                  }
                  // forcer un rechargement complet depuis le serveur pour refléter l'état exact
                  await loadData();
                } catch (err) {
                  console.error('openElection error', err);
                  setError(err.response ? JSON.stringify(err.response.data) : (err.message || "Impossible d'ouvrir l'élection."));
                } finally {
                  setOpenLoading(false);
                }
              }}>{openLoading ? 'Ouverture…' : 'Ouvrir'}</button>
            )}

            {/* show operation feedback */}
            {successMessage && <div style={{ marginTop: 8 }}><Alert type="success">{successMessage}</Alert></div>}
            {error && <div style={{ marginTop: 8 }}><Alert type="error">{error}</Alert></div>}
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => navigate(`/institution/election/${electionId}/candidates`)}>Gérer candidats</button>
            <button className="btn-primary" style={{ width: '100%' }} onClick={() => setEditModalOpen(true)}>Modifier</button>
            <button className="btn-danger" style={{ width: '100%' }} onClick={handleDeleteElection}>Supprimer</button>
            <button className="btn-secondary" onClick={() => navigate(`/institution/election/${electionId}/results`)}>Voir résultats</button>


            <Modal title="Modifier l'élection" open={editModalOpen} onClose={() => setEditModalOpen(false)}>
              <form onSubmit={handleUpdateElection} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={editForm.title} onChange={(e) => setEditForm((s) => ({ ...s, title: e.target.value }))} placeholder="Titre" required />
                <input value={editForm.description} onChange={(e) => setEditForm((s) => ({ ...s, description: e.target.value }))} placeholder="Description" />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn-secondary" onClick={() => setEditModalOpen(false)}>Annuler</button>
                  <button type="submit" className="btn-success">Enregistrer</button>
                </div>
              </form>
            </Modal>

            <Modal title="Confirmer la suppression" open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
              <p>Voulez-vous supprimer cette élection ? Cette action supprimera les scrutins et candidats associés.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn-secondary" onClick={() => setDeleteModalOpen(false)}>Annuler</button>
                <button className="btn-danger" onClick={confirmDeleteElection} disabled={deleteLoading}>{deleteLoading ? 'Suppression…' : 'Supprimer'}</button>
              </div>
            </Modal>

          </div>
        </div>

      {/* Votants tab removed per UX request; voters list shown by default */}

      {activeTab === 'voters' && (
        <div style={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Votants — {voters.length}</h2>
            <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="Rechercher par nom ou identifiant…" value={voterSearch} onChange={(e) => setVoterSearch(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd', minWidth: 260 }} />
                <button className="btn-secondary" onClick={() => exportVotersCSV()} >Exporter CSV</button>
              </div>
          </div>

          <div style={{ overflowX: 'auto', background: 'white', border: '1px solid #eee', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #f1f1f1' }}>
                  <th style={{ padding: 10 }}>Identifiant</th>
                  <th style={{ padding: 10 }}>Nom</th>
                  <th style={{ padding: 10 }}>Éligible</th>
                </tr>
              </thead>
              <tbody>
                {voters.filter(v => !voterSearch || `${v.name} ${v.identifier}`.toLowerCase().includes(voterSearch.toLowerCase())).map((v, i) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #fafafa', background: i % 2 === 0 ? '#fff' : '#fbfbfb', ...styles.tableRow }}>
                    <td style={{ padding: 10 }}>{v.identifier}</td>
                    <td style={{ padding: 10 }}>{v.name || '—'}</td>
                    <td style={{ padding: 10 }}>{v.eligible ? 'Oui' : 'Non'}</td>
                    
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}