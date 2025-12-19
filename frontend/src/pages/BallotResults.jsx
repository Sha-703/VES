import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getElectionResults, API_HOST, getElection } from '../services/api';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Card } from '../components/FormComponents';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function BallotResults() {
  const { electionId, ballotId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState({ total_votes: 0, participation_rate: 0, ballot_title: '' });
  const [electionStatus, setElectionStatus] = useState(null);
  const [qualifiedCandidates, setQualifiedCandidates] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Si un ballotId (héritage) est fourni, le traiter comme un id d'élection.
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ballotId, electionId]);

  const loadResults = async () => {
    setError('');
    // Supporter à la fois le paramètre legacy ballotId et le nouveau electionId
    const targetId = ballotId || electionId;
    if (!targetId) {
      setError('Aucun scrutin sélectionné pour afficher les résultats.');
      setResults([]);
      setMeta({ total_votes: 0, participation_rate: 0, ballot_title: '' });
      setElectionStatus(null);
      setQualifiedCandidates([]);
      return;
    }
    setLoading(true);
    try {
      const res = await getElectionResults(targetId);
      // Supporter la forme des résultats fournie par le backend : res.data.candidates et status
      if (res.data.candidates) {
        setResults(res.data.candidates || []);
        setMeta({ total_votes: res.data.total_votes || 0, participation_rate: res.data.participation_rate || 0, ballot_title: res.data.ballot_title || res.data.election_title || '' });
        setElectionStatus(res.data.status || null);
        setQualifiedCandidates(res.data.qualified_candidates || []);
      } else {
        // forme legacy de secours
        setResults(res.data.results || []);
        setMeta({ total_votes: res.data.total_votes || 0, participation_rate: res.data.participation_rate || 0, ballot_title: res.data.ballot_title || '' });
        setElectionStatus(null);
        setQualifiedCandidates([]);
      }
    } catch (err) {
      console.error('loadResults', err);
      setError('Impossible de charger les résultats');
    }
    setLoading(false);
  };

  const data = {
    labels: results.map(r => r.candidate_name),
    datasets: [
      {
        label: 'Votes',
        data: results.map(r => r.votes),
        backgroundColor: results.map(r => (r.candidate_name && r.candidate_name.toLowerCase().includes('vote nul') ? 'rgba(255,99,132,0.9)' : 'rgba(59,130,246,0.9)'))
      }
    ]
  };

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false }
    },
    scales: {
      x: { beginAtZero: true }
    }
  };

  const exportCSV = () => {
    const header = ['candidate_name', 'votes'];
    const rows = results.map(r => [r.candidate_name, r.votes]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ballot-${ballotId}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // autoriser la récupération optionnelle des métadonnées du scrutin si absentes des résultats (défensif)
  // mais garder une implémentation simple pour l'instant

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <button className="btn-secondary" onClick={() => navigate(-1)} style={{ marginRight: 8 }}>← Retour</button>
          <h1 style={{ display: 'inline-block', marginLeft: 6 }}>{meta.ballot_title || 'Résultats'}</h1>
          <div style={{ color: '#666', fontSize: 13 }}>Résultats détaillés du scrutin</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-secondary" onClick={exportCSV}>Exporter CSV</button>
          {electionStatus === 'second_round_required' && (
            <button className="btn-primary" onClick={async () => {
              try {
                // appeler l'API pour passer au second tour et créer un scrutin (si nécessaire)
                const resp = await (await import('../services/api')).advanceToRound2(electionId, { title: `Second tour - ${meta.ballot_title}`, open_immediately: false });
                if (resp.data && resp.data.created_ballot) {
                  // naviguer vers les résultats du nouveau scrutin ou vers la page du scrutin
                  const bid = resp.data.created_ballot.id;
                  navigate(`/institution/election/${electionId}/ballots/${bid}/results`);
                } else {
                  // simply reload results to show status updated
                  await loadResults();
                }
              } catch (e) {
                console.error('advanceToRound2', e);
                setError('Impossible de lancer le second tour.');
              }
            }}>Créer 2e tour</button>
          )}
        </div>
      </div>

      {error && <div style={{ marginBottom: 12, color: 'red' }}>{error}</div>}

      {loading && <div style={{ marginBottom: 12 }}>Chargement des résultats…</div>}

      {!loading && !error && (!results || results.length === 0) && (meta.total_votes === 0) && (
        <div style={{ padding: 20, borderRadius: 8, background: '#fff', border: '1px solid #eee', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Aucun résultat disponible</div>
          <div style={{ color: '#666', marginBottom: 12 }}>Aucun vote n'a encore été enregistré pour ce scrutin, ou le scrutin n'existe pas.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-small" onClick={loadResults}>Rafraîchir</button>
            <button className="btn-secondary" onClick={() => navigate(`/institution/election/${electionId}`)}>Retour à l'élection</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Card>
            <div style={{ minWidth: 260 }}>
              <div style={{ color: '#6b7280', fontSize: 13 }}>Votes totaux</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{meta.total_votes}</div>
            </div>
          </Card>
          <Card>
            <div style={{ minWidth: 260 }}>
              <div style={{ color: '#6b7280', fontSize: 13 }}>Taux de participation</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{meta.participation_rate}%</div>
            </div>
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: 'var(--shadow)' }}>
            <div style={{ height: Math.max(160, results.length * 80) }}>
              <Bar data={data} options={options} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* If second round is required, show qualifiers */}
            {electionStatus === 'second_round_required' && qualifiedCandidates && qualifiedCandidates.length > 0 && (
              <div style={{ padding: 12, borderRadius: 8, background: '#fff', border: '1px solid #eee' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Candidats qualifiés pour le 2e tour</div>
                {qualifiedCandidates.map((q) => (
                  <div key={q.candidate_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                    <div>{q.candidate_name}</div>
                    <div style={{ color: '#6b7280' }}>{q.percent}%</div>
                  </div>
                ))}
              </div>
            )}

            {(() => {
              const total = meta.total_votes || results.reduce((s, r) => s + (r.votes || 0), 0);
              const leaderVotes = results.reduce((m, r) => Math.max(m, r.votes || 0), 0);
              const leaderPercent = total ? (leaderVotes / total) * 100 : 0;
              return results.map((r) => {
                const isNull = r.candidate_name && r.candidate_name.toLowerCase().includes('vote nul');
                const percent = total ? (r.votes / total) * 100 : 0;
                const gap = Math.max(0, leaderPercent - percent);
                const barWidth = `${total ? Math.round((r.votes / total) * 100) : 0}%`;
                return (
                  <div key={`${r.candidate_id || 'null'}-${r.candidate_name}`} style={{ padding: 14, borderRadius: 10, background: isNull ? '#fff7f7' : 'white', border: isNull ? '1px solid #ffd6d6' : '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.candidate_name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {r.votes} votes • {percent.toFixed(1)}%
                        {r.votes === leaderVotes ? (
                          <span style={{ marginLeft: 8, fontWeight: 700, color: '#0f5132' }}>Leader</span>
                        ) : (
                          <span style={{ marginLeft: 8, color: '#6b7280' }}>Écart vs leader: {gap.toFixed(1)} pts</span>
                        )}
                      </div>
                    </div>
                    <div style={{ width: 160 }}>
                      <div style={{ height: 12, background: '#f1f5f9', borderRadius: 999 }}>
                        <div style={{ width: barWidth, height: 12, background: isNull ? '#ff6b6b' : '#3b82f6', borderRadius: 999 }} />
                      </div>
                    </div>
                  </div>
                );
              });
            })()}

            {/* If first-round winner exists, allow institution to validate final result */}
            {electionStatus === 'first_round_elected' && (
              <div style={{ marginTop: 12 }}>
                <button className="btn-success" onClick={async () => {
                  try {
                    // choose leader as candidate to finalize (backend already marked winner in response)
                    const leader = results.reduce((m, r) => (r.votes > (m.votes || 0) ? r : m), results[0]);
                    const candidateId = leader?.candidate_id;
                    if (!candidateId) {
                      setError('Impossible de déterminer le gagnant.');
                      return;
                    }
                    const resp = await (await import('../services/api')).finalizeWinner(electionId, candidateId);
                    if (resp.data && resp.data.winner) {
                      // success, navigate to election page
                      navigate(`/institution/election/${electionId}`);
                    }
                  } catch (e) {
                    console.error('finalizeWinner', e);
                    setError('Impossible de valider le résultat.');
                  }
                }}>Valider résultat</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
