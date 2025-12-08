import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getElectionResults, getElection, getVoters, getElectionTimeline, advanceToRound2 } from '../services/api';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Card, Modal, Alert } from '../components/FormComponents';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function ElectionResults() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState({ total_votes: 0, participation_rate: 0, election_title: '' });
  const [electionStatus, setElectionStatus] = useState(null);
  const [qualifiedCandidates, setQualifiedCandidates] = useState([]);
  const [predictedWinner, setPredictedWinner] = useState(null);
  const [finalWinner, setFinalWinner] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [eligibleCount, setEligibleCount] = useState(null);
  const [votedCount, setVotedCount] = useState(null);
  const [showNullVotes, setShowNullVotes] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalForm, setModalForm] = useState({ title: `2e tour - ${meta.election_title || ''}`, start: '', end: '', open_immediately: true });
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // initial load + polling every 5s
    let mounted = true;
    const doLoad = async () => {
      if (!mounted) return;
      await loadResults();
    };
    doLoad();
    const iv = setInterval(() => {
      loadResults();
    }, 5000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [electionId]);

  const loadResults = async () => {
    setError('');
    if (!electionId) {
      setError('Aucune élection sélectionnée.');
      return;
    }
    setLoading(true);
    try {
      const res = await getElectionResults(electionId);
        if (res.data.candidates) {
          // trier les candidats par nombre de voix décroissant, garder 'Vote nul' en fin
          const raw = res.data.candidates || [];
          const nul = raw.filter(r => r.candidate_name && r.candidate_name.toLowerCase().includes('vote nul'));
          const others = raw.filter(r => !(r.candidate_name && r.candidate_name.toLowerCase().includes('vote nul'))).sort((a, b) => (b.votes || 0) - (a.votes || 0));
          const sorted = [...others, ...nul];

          // calculer total_votes (préférer la valeur fournie par le backend)
          const totalVotes = res.data.total_votes || sorted.reduce((s, it) => s + (it.votes || 0), 0);

          // joindre un champ pourcentage numérique (1 décimale) à chaque candidat pour un affichage homogène
          const withPercents = sorted.map((it) => {
            const percent = totalVotes ? ((it.votes || 0) / totalVotes) * 100 : 0;
            return { ...it, percent: Number(percent.toFixed(1)) };
          });

          // normaliser le formatage des pourcentages des candidats qualifiés
          const qualified = (res.data.qualified_candidates || []).map((q) => ({
            ...q,
            percent: q.percent !== undefined ? Number(Number(q.percent).toFixed(1)) : (totalVotes ? Number(((q.votes || 0) / totalVotes * 100).toFixed(1)) : 0)
          }));

          setResults(withPercents);
          setMeta({ total_votes: totalVotes, participation_rate: res.data.participation_rate || 0, election_title: res.data.election_title || '' });
          setElectionStatus(res.data.status || null);
          setQualifiedCandidates(qualified);

          // calculer le gagnant prédit selon le type de scrutin et les seuils
          const scrutin = res.data.scrutin_type || res.data.scrutin || null;
          const majorityThreshold = (res.data.majority_threshold !== undefined && res.data.majority_threshold !== null) ? Number(res.data.majority_threshold) : 50;
          const currentRound = res.data.current_round || 1;

          // trouver le leader
          const leader = withPercents.length ? withPercents[0] : null;

          let predicted = null;
          if (res.data.finalized_winner) {
            // le backend a fourni un gagnant finalisé (peut être id ou objet)
            const fw = res.data.finalized_winner;
            const name = fw.name || fw.candidate_name || fw.full_name || (typeof fw === 'string' ? fw : null);
            predicted = null;
            setFinalWinner(name || fw);
          } else {
            setFinalWinner(null);
            if (scrutin === 'majoritaire_1tour') {
              // Afficher le candidat en tête (plus de voix), même s'il n'a pas la majorité absolue.
              if (leader) {
                predicted = { type: 'top', candidate: leader.candidate_name, votes: leader.votes, percent: leader.percent };
              }
            } else if (scrutin === 'majoritaire_2tours') {
              // Pour un scrutin à deux tours, afficher le candidat ayant la majorité absolue
              // si présent (percent >= majorityThreshold). Sinon afficher les qualifiés.
              if (leader && leader.percent >= majorityThreshold) {
                predicted = { type: 'absolute_majority', candidate: leader.candidate_name, votes: leader.votes, percent: leader.percent };
              } else if (res.data.status === 'second_round_required' || (qualified && qualified.length > 0)) {
                predicted = { type: 'second_round', qualified: qualified.map(q => q.candidate_name || q.name || q.full_name) };
              } else if (currentRound === 2 && leader) {
                predicted = { type: 'second_round_leader', candidate: leader.candidate_name, percent: leader.percent };
              }
            } else {
              // repli : candidat en tête
              if (leader) predicted = { type: 'top', candidate: leader.candidate_name, percent: leader.percent };
            }
            setPredictedWinner(predicted);
            // load election details (for voted_voters_count)
            try {
              const elect = await getElection(electionId);
              setVotedCount(elect.data?.voted_voters_count ?? null);
            } catch (e) {
              console.warn('Failed to load election details', e);
              setVotedCount(null);
            }

            // load voters to compute eligible count
            try {
              const vs = await getVoters();
              const votersList = vs.data || [];
              const eligible = votersList.filter(v => v.eligible).length;
              setEligibleCount(eligible);
            } catch (e) {
              console.warn('Failed to load voters', e);
              setEligibleCount(null);
            }
            // load timeline (total votes by minute)
            try {
              const tl = await getElectionTimeline(electionId, { unit: 'minute' });
              setTimeline((tl.data && tl.data.timeline) || []);
            } catch (e) {
              console.warn('Failed to load timeline', e);
              setTimeline([]);
            }
          }
        } else {
        setResults(res.data.results || []);
        setMeta({ total_votes: res.data.total_votes || 0, participation_rate: res.data.participation_rate || 0, election_title: res.data.election_title });
        setElectionStatus(null);
        setQualifiedCandidates([]);
        setPredictedWinner(null);
        setFinalWinner(null);
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

  const timelineData = {
    labels: timeline.map(t => new Date(t.timestamp).toLocaleTimeString()),
    datasets: [{
      label: 'Votes totaux',
      data: timeline.map(t => t.total),
      fill: false,
      borderColor: 'rgba(59,130,246,0.9)'
    }]
  };

  const timelineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { display: true }, y: { beginAtZero: true } }
  };

  // Déterminer un titre et une couleur pour la carte de prédiction selon le type
  const predictionTitle = predictedWinner ? (() => {
    switch (predictedWinner.type) {
      case 'absolute_majority': return 'Majorité absolue';
      case 'top': return 'En tête';
      case 'second_round': return 'Qualifiés 2e tour';
      case 'second_round_leader': return 'En tête (2e tour)';
      case 'elected': return 'Élu';
      case 'no_majority': return 'En tête';
      default: return 'Prédiction';
    }
  })() : 'Prédiction';

  const predictionTitleColor = predictedWinner ? (() => {
    switch (predictedWinner.type) {
      case 'absolute_majority': return '#065f46'; // vert
      case 'second_round': return '#92400e'; // orange
      case 'second_round_leader': return '#0f5132';
      case 'elected': return '#065f46';
      default: return '#6b7280';
    }
  })() : '#6b7280';

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
    const header = ['candidate_id', 'candidate_name', 'votes', 'percent', 'is_null'];
    const rows = results.map(r => [r.candidate_id !== undefined ? r.candidate_id : '', `"${(r.candidate_name || '').replace(/"/g, '""')}"`, r.votes || 0, (r.percent !== undefined ? r.percent : ''), (r.candidate_id === null || (r.candidate_name && r.candidate_name.toLowerCase().includes('vote nul')) ) ? '1' : '0']);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `election-${electionId}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <button className="btn-secondary" onClick={() => navigate(-1)} style={{ marginRight: 8 }}>← Retour</button>
          <h1 style={{ display: 'inline-block', marginLeft: 6 }}>{meta.election_title || 'Résultats de l\'élection'}</h1>
          <div style={{ color: '#666', fontSize: 13 }}>Résultats consolidés de l'élection</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-secondary" onClick={exportCSV}>Exporter CSV</button>
        </div>
      </div>

      {/* Predicted/final winner cards are rendered below in the metrics grid to avoid duplication. */}

      {error && <div style={{ marginBottom: 12, color: 'red' }}>{error}</div>}
      {loading && <div style={{ marginBottom: 12 }}>Chargement des résultats…</div>}

      {!loading && !error && (!results || results.length === 0) && (meta.total_votes === 0) && (
        <div style={{ padding: 20, borderRadius: 8, background: '#fff', border: '1px solid #eee', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Aucun résultat disponible</div>
          <div style={{ color: '#666', marginBottom: 12 }}>Aucun vote n'a encore été enregistré pour cette élection.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-small" onClick={loadResults}>Rafraîchir</button>
            <button className="btn-secondary" onClick={() => navigate(`/institution/election/${electionId}`)}>Retour à l'élection</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {predictedWinner && (
            <Card>
              <div style={{ minWidth: 160 }}>
                <div style={{ color: predictionTitleColor, fontSize: 13 }}>{predictionTitle}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>
                  {predictedWinner.type === 'absolute_majority' && `${predictedWinner.candidate} — ${predictedWinner.percent}% (majorité absolue)`}
                  {predictedWinner.type === 'top' && `${predictedWinner.candidate} — ${predictedWinner.percent}% (en tête)`}
                  {predictedWinner.type === 'second_round' && `Qualifiés 2e tour: ${predictedWinner.qualified.join(', ')}`}
                  {predictedWinner.type === 'second_round_leader' && `${predictedWinner.candidate} — ${predictedWinner.percent}% (en tête au 2e tour)`}
                  {predictedWinner.type === 'elected' && `${predictedWinner.candidate} — ${predictedWinner.percent}%`}
                  {predictedWinner.type === 'no_majority' && `${predictedWinner.candidate} — ${predictedWinner.percent}% (aucune majorité)`}
                </div>
              </div>
            </Card>
          )}

          {finalWinner && (
            <Card>
              <div style={{ minWidth: 160 }}>
                <div style={{ color: '#6b7280', fontSize: 13 }}>Décision finale</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>{finalWinner}</div>
              </div>
            </Card>
          )}
          <Card>
            <div style={{ minWidth: 160 }}>
              <div style={{ color: '#6b7280', fontSize: 13 }}>Total éligibles</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{eligibleCount !== null ? eligibleCount : '—'}</div>
            </div>
          </Card>

          <Card>
            <div style={{ minWidth: 160 }}>
              <div style={{ color: '#6b7280', fontSize: 13 }}>Ont voté</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{votedCount !== null ? votedCount : (meta.total_votes ?? 0)}</div>
            </div>
          </Card>

          <Card>
            <div style={{ minWidth: 160 }}>
              <div style={{ color: '#6b7280', fontSize: 13 }}>Abstention</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{(eligibleCount !== null && votedCount !== null) ? (eligibleCount - votedCount) : (eligibleCount !== null ? (eligibleCount - (meta.total_votes || 0)) : '—')}</div>
            </div>
          </Card>

          <Card>
            <div style={{ minWidth: 160 }}>
              <div style={{ color: '#6b7280', fontSize: 13 }}>Taux de participation</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{meta.participation_rate}%</div>
            </div>
          </Card>

          {/* Votes nuls */}
          <Card>
            <div style={{ minWidth: 160 }}>
              <div style={{ color: '#6b7280', fontSize: 13 }}>Votes nuls / blancs</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {(() => {
                  const nul = results.find(r => r.candidate_id === null || (r.candidate_name && r.candidate_name.toLowerCase().includes('vote nul')));
                  const nulCount = nul ? (nul.votes || 0) : 0;
                  const total = meta.total_votes || results.reduce((s, r) => s + (r.votes || 0), 0);
                  const pct = total ? ((nulCount / total) * 100).toFixed(1) : '0.0';
                  return `${nulCount} (${pct}%)`;
                })()}
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, boxShadow: 'var(--shadow)' }}>
            <div style={{ height: Math.max(160, results.length * 80) }}>
                <Bar data={data} options={options} />
              </div>
              {timeline && timeline.length > 0 && (
                <div style={{ marginTop: 18, height: 200 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 8 }}>Evolution des votes</h3>
                  <div style={{ height: 140 }}>
                    <Bar data={timelineData} options={timelineOptions} />
                  </div>
                </div>
              )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {electionStatus === 'second_round_required' && qualifiedCandidates && qualifiedCandidates.length > 0 && (
              <div style={{ padding: 12, borderRadius: 8, background: '#fff', border: '1px solid #eee' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Candidats qualifiés pour le 2e tour</div>
                {qualifiedCandidates.map((q) => (
                  <div key={q.candidate_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                    <div>{q.candidate_name}</div>
                    <div style={{ color: '#6b7280' }}>{q.percent}%</div>
                  </div>
                ))}
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={() => { setShowCreateModal(true); setModalForm({ title: `2e tour - ${meta.election_title || ''}`, start: '', end: '', open_immediately: true }); }}>Créer le 2e tour</button>
                </div>
              </div>
            )}

          {showCreateModal && (
            <Modal title="Créer le 2e tour" open={showCreateModal} onClose={() => setShowCreateModal(false)}>
              {error && <Alert type="error">{error}</Alert>}
              {successMessage && <Alert type="success">{successMessage}</Alert>}
              <form onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                try {
                  const ids = qualifiedCandidates.map(c => c.candidate_id).filter(Boolean);
                  const payload = { create_new_election: true, qualified_candidate_ids: ids, title: modalForm.title, open_immediately: modalForm.open_immediately };
                  if (modalForm.start) payload.start = modalForm.start;
                  if (modalForm.end) payload.end = modalForm.end;
                  const resp = await advanceToRound2(electionId, payload);
                  if (resp && resp.data && resp.data.new_election_id) {
                    setSuccessMessage('2e tour créé avec succès.');
                    setShowCreateModal(false);
                    navigate(`/institution/election/${resp.data.new_election_id}`);
                  } else {
                    setSuccessMessage('2e tour créé.');
                    setShowCreateModal(false);
                    await loadResults();
                  }
                } catch (err) {
                  console.error('create 2e tour', err);
                  setError(err.response?.data?.detail || 'Erreur lors de la création du 2e tour');
                }
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label>Titre</label>
                  <input name="title" value={modalForm.title} onChange={(ev) => setModalForm({ ...modalForm, title: ev.target.value })} />
                  <label>Début (optionnel)</label>
                  <input type="datetime-local" name="start" value={modalForm.start} onChange={(ev) => setModalForm({ ...modalForm, start: ev.target.value })} />
                  <label>Fin (optionnel)</label>
                  <input type="datetime-local" name="end" value={modalForm.end} onChange={(ev) => setModalForm({ ...modalForm, end: ev.target.value })} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={modalForm.open_immediately} onChange={(ev) => setModalForm({ ...modalForm, open_immediately: ev.target.checked })} /> Ouvrir immédiatement</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="submit" className="btn-primary">Créer</button>
                    <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Annuler</button>
                  </div>
                </div>
              </form>
            </Modal>
          )}

          {successMessage && <div style={{ marginTop: 8 }}><Alert type="success">{successMessage}</Alert></div>}

            {(() => {
              const filteredResults = showNullVotes ? results : results.filter(r => !(r.candidate_id === null || (r.candidate_name && r.candidate_name.toLowerCase().includes('vote nul'))));
              const total = meta.total_votes || results.reduce((s, r) => s + (r.votes || 0), 0);
              const totalFiltered = filteredResults.reduce((s, r) => s + (r.votes || 0), 0);
              const leaderVotes = filteredResults.reduce((m, r) => Math.max(m, r.votes || 0), 0);
              const leaderPercent = totalFiltered ? (leaderVotes / totalFiltered) * 100 : 0;

              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: '#374151', fontWeight: 700 }}>Détails par candidat</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 13, color: '#6b7280' }}>
                        <input type="checkbox" checked={showNullVotes} onChange={() => setShowNullVotes(s => !s)} style={{ marginRight: 8 }} />
                        Afficher votes nuls
                      </label>
                    </div>
                  </div>

                  {filteredResults.map((r) => {
                    const isNull = r.candidate_id === null || (r.candidate_name && r.candidate_name.toLowerCase().includes('vote nul'));
                    const percent = total ? (r.votes / total) * 100 : 0;
                    const gap = Math.max(0, leaderPercent - percent);
                    const barWidth = `${total ? Math.round((r.votes / total) * 100) : 0}%`;
                    return (
                      <div key={`${r.candidate_id || 'null'}-${r.candidate_name}`} style={{ padding: 14, borderRadius: 10, background: isNull ? '#fff7f7' : 'white', border: isNull ? '1px solid #ffd6d6' : '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
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
                  })}
                </div>
              );
            })()}

          </div>
        </div>
      </div>
    </div>
  );
}
