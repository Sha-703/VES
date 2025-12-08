import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// DÉPRÉCATÉ : vue de vote 'ballot' historique. Après la migration vers le vote
// au niveau de l'élection, ce stub redirige les anciennes routes /voter/vote/:ballotId
// vers la nouvelle route /voter/vote_election/:electionId en supposant que
// ballotId est en réalité un id d'élection. Conserver une redirection pour compatibilité.

export default function VoteBallotRedirect() {
  const { ballotId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // traiter ballotId comme electionId et naviguer
    if (ballotId) {
      navigate(`/voter/vote_election/${ballotId}`);
    } else {
      navigate('/voter/ballots');
    }
  }, [ballotId, navigate]);

  return null;
}
