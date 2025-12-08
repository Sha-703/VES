import React, { useState, useEffect } from 'react';
import { getElections, checkHasVoted } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../components/FormComponents';

export default function VoterElections() {
  const [ballots, setBallots] = useState([]);
  const [elections, setElections] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const voterName = localStorage.getItem('voter_name');

  useEffect(() => {
    const voterId = localStorage.getItem('voter_id');
    if (!voterId) {
      navigate('/voter/login');
      return;
    }
    const institutionId = localStorage.getItem('institution_id');
    loadBallots(institutionId);
  }, []);

  const loadBallots = async (institutionId = null) => {
    try {
      // Endpoints 'ballot' supprimés ; lister les élections de l'institution et afficher celles ouvertes
      const erez = await getElections(institutionId);
      const now = new Date();
      const openElections = (erez.data || []).filter(e => {
        // Prefer backend-provided `is_open` when available
        if (typeof e.is_open !== 'undefined') return !!e.is_open;

        // Fallback: apply same rules as server-side ElectionSerializer.get_is_open
        if (e.start && e.end) {
          const s = new Date(e.start);
          const en = new Date(e.end);
          // end is exclusive
          return s <= now && now < en;
        }
        if (e.start && !e.end) {
          const s = new Date(e.start);
          return s <= now;
        }
        // end-only or missing start -> treat as closed
        return false;
      });
      setBallots([]);
      setElections(openElections);
    } catch (err) {
      setError('Erreur de chargement');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('voter_id');
    localStorage.removeItem('voter_name');
    localStorage.removeItem('institution_id');
    navigate('/');
  };

  const handleParticipate = async (election) => {
    const voterId = localStorage.getItem('voter_id');
    if (!voterId) {
      navigate('/voter/login');
      return;
    }

    try {
      const res = await checkHasVoted(voterId, election.id);
      if (res && res.data && res.data.voted) {
        setError("Vous avez déjà voté pour cette élection.");
        return;
      }
      // not voted yet — navigate to voting page
      navigate(`/voter/vote_election/${election.id}`);
    } catch (err) {
      // if the backend returns 400/404 or other, show a friendly message
      setError(err?.response?.data?.detail || 'Impossible de vérifier le statut de vote.');
    }
  };

  return (
    <div>
      <div className="header" style={{ padding: '20px 0' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>Scrutins disponibles</h1>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>Connecté : {voterName}</span>
            <button onClick={handleLogout} className="btn-danger">
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        {error && <Alert type="error">{error}</Alert>}

        {ballots.length === 0 ? (
          // S'il n'y a pas de scrutins, afficher les élections ouvertes pour permettre le vote au niveau de l'élection
          elections.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ fontSize: '1.1rem' }}>Aucune élection disponible pour le moment</p>
            </div>
          ) : (
            <div className="grid voter-elections-grid">
              {elections.map((election) => (
                <article key={election.id} className="voter-election-card">
                  <div className="voter-election-main">
                    <div className="voter-election-header">
                      <h3 className="voter-election-title">{election.title}</h3>
                      <div className="voter-election-badges">
                        <span className="badge">{(election.candidates || []).length} candidats</span>
                      </div>
                    </div>

                    {election.description && <p className="voter-election-desc">{election.description}</p>}

                    <div className="voter-election-meta">
                      <div>🕒 {new Date(election.start).toLocaleString()} → {new Date(election.end).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="voter-election-cta">
                    <button onClick={() => handleParticipate(election)} className="btn-primary large">Participer</button>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : (
          <div className="grid voter-elections-grid">
            {ballots.map((ballot) => (
              <article key={ballot.id} className="voter-election-card">
                <div className="voter-election-main">
                  <div className="voter-election-header">
                    <h3 className="voter-election-title">{ballot.title}</h3>
                    <div className="voter-election-badges">
                      <span className="badge">{(ballot.candidates || []).length} candidats</span>
                    </div>
                  </div>

                  {ballot.description && <p className="voter-election-desc">{ballot.description}</p>}

                  <div className="voter-election-meta">
                    <div>🕒 {new Date(ballot.start).toLocaleString()} → {new Date(ballot.end).toLocaleString()}</div>
                  </div>
                </div>

                <div className="voter-election-cta">
                  <button onClick={() => handleParticipate(ballot)} className="btn-primary large">Participer</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
