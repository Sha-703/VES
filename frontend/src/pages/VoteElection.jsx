import React, { useState, useEffect } from 'react';
import { getElection, castVote, API_HOST } from '../services/api';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert } from '../components/FormComponents';

export default function VoteElection() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [election, setElection] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(undefined);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const voterId = localStorage.getItem('voter_id');
  const voterName = localStorage.getItem('voter_name');

  useEffect(() => {
    if (!voterId) {
      navigate('/voter/login');
      return;
    }
    loadElection();
  }, []);

  const loadElection = async () => {
    try {
      const res = await getElection(electionId);
      if (res.data?.voter_has_voted) {
        setError('Désolé vous avez déjà voté pour cette élection');
        setElection(res.data);
        return;
      }
      setElection(res.data);
    } catch (err) {
      setError('Erreur de chargement');
    }
  };

  const handleVote = async () => {
    if (selectedCandidate === undefined) {
      setError('Veuillez sélectionner un candidat ou choisir "Vote nul"');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // For election-level voting, ballot_id is null and we pass election_id
      const candidateToSend = selectedCandidate === 'NULL' ? null : selectedCandidate;
      await castVote(null, candidateToSend, voterId, parseInt(electionId, 10));
      setSuccess('Votre vote a été enregistré avec succès!');
      navigate('/voter/ballots');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du vote');
    } finally {
      setLoading(false);
    }
  };

  if (!election) return <div style={{ textAlign: 'center', padding: '40px' }}>Chargement...</div>;

  return (
    <div className="container" style={{ maxWidth: '800px', marginTop: '40px', marginBottom: '40px' }}>
      <button onClick={() => navigate('/voter/ballots')} className="btn-secondary" style={{ marginBottom: '20px' }}>
        ← Retour
      </button>

      <div className="card">
        <h1>{election.title}</h1>
        <p>{election.description}</p>
        <p style={{ marginTop: '20px', fontSize: '0.9rem', color: '#666' }}><strong>Connecté : </strong>{voterName}</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <div className="card" style={{ marginTop: '30px' }}>
        <h2>🗳️ Sélectionnez votre candidat</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '12px',
          marginTop: '20px'
        }}>
          {election.candidates?.map((candidate) => (
            <div
              key={candidate.id}
              onClick={() => setSelectedCandidate(candidate.id)}
              role="button"
              tabIndex={0}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                padding: '12px',
                border: selectedCandidate === candidate.id ? '2px solid #007bff' : '1px solid #ddd',
                backgroundColor: selectedCandidate === candidate.id ? '#e7f3ff' : '#fff',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                minHeight: '110px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {candidate.photo && (
                  <img src={candidate.photo.startsWith('http') ? candidate.photo : `${API_HOST}${candidate.photo}`} alt={candidate.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                )}
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0 }}>{candidate.name}</h3>
                  {candidate.position && <p style={{ margin: '6px 0 0 0', fontSize: '0.9rem', fontWeight: 500 }}>{candidate.position}</p>}
                </div>
                <input
                  type="radio"
                  name="candidate"
                  value={candidate.id}
                  checked={selectedCandidate === candidate.id}
                  onChange={() => setSelectedCandidate(candidate.id)}
                  style={{ marginLeft: '8px', cursor: 'pointer' }}
                />
              </div>
              {candidate.bio && <p style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666' }}>{candidate.bio}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <h3>Option alternative</h3>
        <div
          onClick={() => setSelectedCandidate('NULL')}
          role="button"
          tabIndex={0}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            border: selectedCandidate === 'NULL' ? '2px solid #007bff' : '1px solid #ddd',
            backgroundColor: selectedCandidate === 'NULL' ? '#e7f3ff' : '#fff',
            borderRadius: '8px',
            cursor: 'pointer',
            marginTop: 8
          }}
        >
          <div>
            <h4 style={{ margin: 0 }}>Vote nul</h4>
            <p style={{ margin: '6px 0 0 0', color: '#666' }}>Si vous souhaitez exprimer un vote blanc ou nul, choisissez cette option.</p>
          </div>
          <input type="radio" name="candidate" checked={selectedCandidate === 'NULL'} readOnly style={{ marginLeft: '8px' }} />
        </div>
      </div>

      <button
        onClick={handleVote}
        disabled={!selectedCandidate || loading}
        className="btn-success"
        style={{ width: '100%', marginTop: '30px', padding: '16px', fontSize: '1.1rem', fontWeight: 'bold' }}
      >
        {loading ? '⏳ Enregistrement...' : '✓ Confirmer mon vote'}
      </button>
    </div>
  );
}
