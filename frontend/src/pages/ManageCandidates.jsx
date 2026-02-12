import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getElection, addCandidate, updateCandidate, deleteCandidate } from '../services/api';
import { CandidateCard, CandidateForm, Alert, Modal, Pagination } from '../components/FormComponents';

export default function ManageCandidates() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [election, setElection] = useState(null);
  const [error, setError] = useState('');
  const [activeBallotId, setActiveBallotId] = useState(null);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [filters, setFilters] = useState({}); // { electionId: { recherche: '', page: 1 } }
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const PAGE_SIZE = 5;
  const confirmRef = React.useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/');
    loadElection();
  }, []);

  const loadElection = async () => {
    try {
      const res = await getElection(electionId);
      setElection(res.data);
    } catch (err) {
      setError('Erreur de chargement');
    }
  };

  const handleAdd = async (form, electionIdParam) => {
    try {
      setIsLoading(true);
      setLoadingMessage('Ajout du candidat en cours...');
      const resp = await addCandidate(electionIdParam, form.name, form.bio, form.position, form.photo);
      // Ajouter le candidat au frontend sans recharger l'élection entière
      if (resp.data && election) {
        const newCandidate = resp.data;
        setElection((prev) => ({
          ...prev,
          candidates: [...(prev.candidates || []), newCandidate]
        }));
        setLoadingMessage('Candidat ajouté !');
      } else {
        await loadElection();
      }
      setLoadingMessage('');
    } catch (err) {
      setError('Erreur lors de l\'ajout du candidat');
      setLoadingMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (form) => {
    try {
      setIsLoading(true);
      setLoadingMessage('Mise à jour du candidat...');
      const resp = await updateCandidate(editingCandidate.id, { name: form.name, bio: form.bio, position: form.position, photo: form.photo });
      // Mettre à jour le candidat au frontend sans recharger
      if (resp.data && election) {
        const updatedCandidate = resp.data;
        setElection((prev) => ({
          ...prev,
          candidates: prev.candidates.map((c) => c.id === updatedCandidate.id ? updatedCandidate : c)
        }));
        setEditingCandidate(null);
        setLoadingMessage('Candidat mis à jour !');
      } else {
        setEditingCandidate(null);
        await loadElection();
      }
      setLoadingMessage('');
    } catch (err) {
      setError('Erreur lors de la mise à jour');
      setLoadingMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (candidate) => {
    // ouvrir la fenêtre de confirmation
    setCandidateToDelete(candidate);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!candidateToDelete) return;
    try {
      setIsLoading(true);
      setLoadingMessage('Suppression en cours...');
      await deleteCandidate(candidateToDelete.id);
      setConfirmOpen(false);
      // Supprimer le candidat au frontend sans recharger
      if (election) {
        setElection((prev) => ({
          ...prev,
          candidates: prev.candidates.filter((c) => c.id !== candidateToDelete.id)
        }));
        setCandidateToDelete(null);
        setLoadingMessage('Candidat supprimé !');
      } else {
        setCandidateToDelete(null);
        await loadElection();
      }
      setLoadingMessage('');
    } catch (err) {
      setError('Erreur lors de la suppression');
      setConfirmOpen(false);
      setCandidateToDelete(null);
      setLoadingMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  if (!election) return <div>Chargement...</div>;

  const electionCandidates = election.candidates || [];

  const listSearch = (filters.search || '').toLowerCase().trim();
  const listPage = filters.page || 1;
  const filtered = electionCandidates.filter((c) => {
    if (!listSearch) return true;
    return `${c.name} ${c.position || ''} ${c.bio || ''}`.toLowerCase().includes(listSearch);
  });
  const total = filtered.length;
  const start = (listPage - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  return (
    <>
    <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto', position: 'relative' }}>
      {/* Overlay de chargement */}
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            background: 'white',
            padding: '32px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          }}>
            {/* Spinner animé */}
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #3b82f6',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite',
            }}></div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
              {loadingMessage || 'Chargement...'}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Veuillez patienter</div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      <button onClick={() => navigate(`/institution/election/${electionId}`)} className="btn-secondary" style={{ marginBottom: 16 }} disabled={isLoading}>← Retour à l'élection</button>
      <h1>Gérer les candidats — {election.title}</h1>
      <p style={{ color: '#666' }}>{election.description}</p>

      {error && <Alert type="error">{error}</Alert>}

      <div className="card" style={{ padding: 16, marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Candidats de l'élection</h3>
          <div style={{ color: '#666' }}>{electionCandidates.length} candidats</div>
        </div>

        <div style={{ marginTop: 12 }}>
          {editingCandidate ? (
            <CandidateForm initial={{ name: editingCandidate.name, position: editingCandidate.position || '', bio: editingCandidate.bio || '', photo: editingCandidate.photo || null }} onSubmit={handleUpdate} onCancel={() => setEditingCandidate(null)} submitText="Mettre à jour" isLoading={isLoading} />
          ) : (
            <CandidateForm initial={{}} onSubmit={(f) => handleAdd(f, electionId)} onCancel={() => { setFilters({}); }} submitText="Ajouter" isLoading={isLoading} />
          )}

          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <input
                placeholder="Rechercher par nom ou poste..."
                value={(filters?.search) || ''}
                onChange={(e) => setFilters((s) => ({ ...(s || {}), search: e.target.value, page: 1 }))}
                style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
                disabled={isLoading}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(!paged.length) ? <div style={{ color: '#666' }}>Aucun candidat</div> : (
                <>
                  {paged.map((c) => (
                    <CandidateCard key={c.id} candidate={c} onEdit={() => setEditingCandidate(c)} onDelete={() => handleDelete(c)} isLoading={isLoading} />
                  ))}
                  <Pagination total={total} page={listPage} pageSize={PAGE_SIZE} onPage={(p) => setFilters((s) => ({ ...(s || {}), page: p }))} disabled={isLoading} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    <Modal title="Confirmer la suppression" open={confirmOpen} onClose={() => setConfirmOpen(false)} initialFocusRef={confirmRef}>
        <p>Voulez-vous supprimer <strong>{candidateToDelete?.name}</strong> ? Cette action est irréversible.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button className="btn-secondary" onClick={() => setConfirmOpen(false)}>Annuler</button>
          <button ref={confirmRef} className="btn-danger" onClick={confirmDelete}>Supprimer</button>
        </div>
      </Modal>
    </>
  );
}
