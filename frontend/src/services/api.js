import axios from 'axios';

// Utilise la variable d'environnement pour l'hôte backend si disponible (Vite).
// Permet de configurer le backend déployé sans modifier le code source.
const API_HOST = import.meta.env.VITE_API_BASE_URL || 'https://ves-mg2a.onrender.com';
const API_BASE = `${API_HOST}/api/`;

// Remarque : `withCredentials` est à false par défaut car l'application utilise l'authentification par token dans l'en-tête `Authorization`. Si vous passez à une authentification par cookie/session, définissez `VITE_API_WITH_CREDENTIALS=true` dans l'environnement et le backend doit activer `CORS_ALLOW_CREDENTIALS`.
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: import.meta.env.VITE_API_WITH_CREDENTIALS === 'true' || false,
});


// Ajoute le token aux requêtes si disponible
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  // Attache le token uniquement s'il est non vide (évite d'envoyer 'null'/'undefined')
  if (token && token !== 'null' && token !== 'undefined') {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// Intercepteur de réponse pour gérer l'absence ou l'invalidité du token
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Affiche une alerte utilisateur en français si le token est absent ou invalide
      if (typeof window !== 'undefined') {
        window.alert("Votre session a expiré ou vous n'êtes pas authentifié. Veuillez vous reconnecter.");
      }
      // Nettoie le token pour forcer la reconnexion
      localStorage.removeItem('token');
      // Redirige vers la page de connexion institution si possible
      if (typeof window !== 'undefined' && window.location.pathname !== '/institution/login') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// Authentification Institution
export const institutionRegister = (username, email, password, institution_name, institution_description = '') =>
  api.post('/auth/institution/register/', {
    username,
    email,
    password,
    institution_name,
    institution_description,
  });

export const institutionLogin = (institution_name, password) =>
  api.post('/auth/institution/login/', { institution_name, password });

// Authentification Votant
export const voterLogin = (identifier, institution_id) =>
  api.post('/auth/voter/login/', { identifier, institution_id });

// Endpoints Institution
export const getMyInstitution = () =>
  api.get('/institutions/my_institution/');

export const updateMyInstitution = (data) =>
  api.patch('/institutions/my_institution/', data);

// Élections
export const createElection = (title, description, scrutin_type, majority_threshold = null, advance_threshold = null, start = null, end = null, open_immediately = false) => {
  const payload = { title, description, scrutin_type };
  if (majority_threshold !== null && majority_threshold !== undefined) payload.majority_threshold = majority_threshold;
  if (advance_threshold !== null && advance_threshold !== undefined) payload.advance_threshold = advance_threshold;
  if (start !== null && start !== undefined) payload.start = start;
  if (end !== null && end !== undefined) payload.end = end;
  // Permet au client de demander explicitement l'ouverture de l'élection à la création (booléen)
  if (open_immediately) payload.open_immediately = true;
  return api.post('/elections/', payload);
};

export const getElections = (institutionId = null) =>
  api.get('/elections/', { params: institutionId ? { institution: institutionId } : {} });

export const getElection = (id) =>
  api.get(`/elections/${id}/`);

export const getElectionResults = (id) =>
  api.get(`/elections/${id}/results/`);

export const getElectionTimeline = (id, { unit = 'minute', start = null, end = null } = {}) => {
  const params = {};
  if (unit) params.unit = unit;
  if (start) params.start = start;
  if (end) params.end = end;
  return api.get(`/elections/${id}/timeline/`, { params });
};

export const advanceToRound2 = (electionId, { start = null, end = null, title = null, open_immediately = false, create_new_election = false, qualified_candidate_ids = null } = {}) =>
  api.post(`/elections/${electionId}/advance_to_round2/`, { start, end, title, open_immediately, create_new_election, qualified_candidate_ids });

export const finalizeWinner = (electionId, candidateId) =>
  api.post(`/elections/${electionId}/finalize_winner/`, { candidate_id: candidateId });

export const openElection = (electionId, data = {}) => api.post(`/elections/${electionId}/open_election/`, data);
export const closeElection = (electionId, data = {}) => api.post(`/elections/${electionId}/close_election/`, data);

export const deleteElection = (id) => api.delete(`/elections/${id}/`);
export const updateElection = (id, data) => api.patch(`/elections/${id}/`, data);

// Helpers pour les bulletins (compatibilité héritée) : redirige les opérations de bulletin vers les endpoints d'élection
// L'application utilise désormais les élections comme unité de vote. Ces wrappers permettent à l'ancien code frontend de fonctionner en déléguant vers les endpoints d'élection.
export const createBallot = (election, title, description, start, end) => {
  // Hérité : création d'un bulletin pour une élection -> met à jour la fenêtre/round de l'élection
  // On appelle advance_to_round2 quand c'est approprié, sinon on patch l'élection.
  if (!election) return Promise.reject(new Error('election id required'));
  return api.post(`/elections/${election}/advance_to_round2/`, { start, end, title, open_immediately: false });
};

export const getBallots = (institutionId = null) =>
  // Redirige vers la liste des élections pour l'institution
  api.get('/elections/', { params: institutionId ? { institution: institutionId } : {} });

export const getBallot = (id, voterId = null) =>
  // Considère l'id du bulletin comme l'id de l'élection dans le modèle migré
  api.get(`/elections/${id}/`, { params: voterId ? { voter_id: voterId } : {} });

export const openBallot = (id) =>
  // Ouvre l'élection
  api.post(`/elections/${id}/open_election/`);

export const closeBallot = (id) =>
  // Ferme l'élection
  api.post(`/elections/${id}/close_election/`);

export const getBallotResults = (id) =>
  // Redirige vers les résultats de l'élection
  api.get(`/elections/${id}/results/`);

export const updateBallot = (id, data) =>
  // Redirige vers la mise à jour de l'élection
  api.patch(`/elections/${id}/`, data);

export const deleteBallot = (id) =>
  // Redirige vers la suppression de l'élection
  api.delete(`/elections/${id}/`);

// Candidats
export const addCandidate = (election, name, bio, position, photo = null) => {
  const form = new FormData();
  form.append('election', election);
  form.append('name', name);
  form.append('bio', bio || '');
  form.append('position', position || '');
  if (photo) form.append('photo', photo);
  return api.post('/candidates/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const getCandidates = () =>
  api.get('/candidates/');

export const updateCandidate = (id, { election, name, bio, position, photo } = {}) => {
  // Envoie multipart/form-data s'il y a un fichier, sinon envoie un patch JSON
  const form = new FormData();
  if (election !== undefined) form.append('election', election);
  if (name !== undefined) form.append('name', name);
  if (bio !== undefined) form.append('bio', bio || '');
  if (position !== undefined) form.append('position', position || '');
  if (photo) form.append('photo', photo);
  // Patch avec form fonctionne pour les mises à jour multipart
  return api.patch(`/candidates/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const deleteCandidate = (id) => api.delete(`/candidates/${id}/`);

// Électeurs
export const addVoter = (identifier, name, eligible = true) =>
  api.post('/voters/', { identifier, name, eligible });

export const getVoters = () =>
  api.get('/voters/');

export const updateVoter = (id, data) =>
  api.patch(`/voters/${id}/`, data);

export const deleteVoter = (id) =>
  api.delete(`/voters/${id}/`);

// Importation des électeurs (CSV / XLSX) pour une institution
export const importVoters = (institutionId, file) => {
  const form = new FormData();
  form.append('file', file);
  // Laisse axios définir automatiquement le Content-Type (incluant le boundary).
  return api.post(`/institutions/${institutionId}/import_voters/`, form);
};

export const importVotersPreview = (institutionId, file) => {
  const form = new FormData();
  form.append('file', file);
  // Passe le paramètre preview pour que le backend analyse sans persister
  return api.post(`/institutions/${institutionId}/import_voters/?preview=true`, form);
};

// Obtenir un résumé simple des électeurs pour l'institution authentifiée
export const getVoterSummary = () => api.get('/institutions/voters_summary/');

// Gestion des fichiers d'import
// REMARQUE : Django APPEND_SLASH est activé ; utilisez le slash final pour les endpoints POST qui l'attendent.
export const getImportFiles = (institutionId) => api.get(`/institutions/${institutionId}/imports/`);
export const deleteImportFile = (institutionId, fileId) => api.post(`/institutions/${institutionId}/imports/delete/`, { file_id: fileId });
export const forceDeleteImportFile = (institutionId, fileId) => api.post(`/institutions/${institutionId}/imports/force_delete/`, { file_id: fileId });

// Votes
export const castVote = (ballot_id, candidate_id, voter_id, election_id = null) => {
  const payload = { ballot_id, candidate_id, voter_id };
  // Inclure election_id si fourni (supporte le vote au niveau de l'élection)
  if (election_id !== null && election_id !== undefined) payload.election_id = election_id;
  return api.post('/votes/cast_vote/', payload);
};

// Vérifie si un électeur a déjà voté dans une élection
export const checkHasVoted = (voter_id, election_id) =>
  api.get('/votes/has_voted/', { params: { voter_id, election_id } });

export default api;
export { API_BASE, API_HOST };
