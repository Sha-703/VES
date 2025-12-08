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
  const [filters, setFilters] = useState({}); // { electionId: { search: '', page: 1 } }
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState(null);
  const PAGE_SIZE = 5;
  const confirmRef = React.useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/institution/login');
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
      await addCandidate(electionIdParam, form.name, form.bio, form.position, form.photo);
      await loadElection();
    } catch (err) {
      setError('Erreur lors de l\'ajout du candidat');
    }
  };

  const handleUpdate = async (form) => {
    try {
      await updateCandidate(editingCandidate.id, { name: form.name, bio: form.bio, position: form.position, photo: form.photo });
      setEditingCandidate(null);
      await loadElection();
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (candidate) => {
    // open confirmation modal
    setCandidateToDelete(candidate);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!candidateToDelete) return;
    try {
      await deleteCandidate(candidateToDelete.id);
      setConfirmOpen(false);
      setCandidateToDelete(null);
      await loadElection();
    } catch (err) {
      setError('Erreur lors de la suppression');
      setConfirmOpen(false);
      setCandidateToDelete(null);
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
    <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>
      <button onClick={() => navigate(`/institution/election/${electionId}`)} className="btn-secondary" style={{ marginBottom: 16 }}>← Retour à l'élection</button>
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
            <CandidateForm initial={{ name: editingCandidate.name, position: editingCandidate.position || '', bio: editingCandidate.bio || '', photo: editingCandidate.photo || null }} onSubmit={handleUpdate} onCancel={() => setEditingCandidate(null)} submitText="Mettre à jour" />
          ) : (
            <CandidateForm initial={{}} onSubmit={(f) => handleAdd(f, electionId)} onCancel={() => { setFilters({}); }} submitText="Ajouter" />
          )}

          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <input
                placeholder="Rechercher par nom ou poste..."
                value={(filters?.search) || ''}
                onChange={(e) => setFilters((s) => ({ ...(s || {}), search: e.target.value, page: 1 }))}
                style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(!paged.length) ? <div style={{ color: '#666' }}>Aucun candidat</div> : (
                <>
                  {paged.map((c) => (
                    <CandidateCard key={c.id} candidate={c} onEdit={() => setEditingCandidate(c)} onDelete={() => handleDelete(c)} />
                  ))}
                  <Pagination total={total} page={listPage} pageSize={PAGE_SIZE} onPage={(p) => setFilters((s) => ({ ...(s || {}), page: p }))} />
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
