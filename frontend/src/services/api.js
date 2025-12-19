import axios from 'axios';

// Use environment variable for the backend host when available (Vite).
// This lets you configure the deployed backend without changing source.
const API_HOST = import.meta.env.VITE_API_BASE_URL || 'https://ves-mg2a.onrender.com';
const API_BASE = `${API_HOST}/api/`;

// Note: `withCredentials` is false by default because the app uses token
// authentication sent in the `Authorization` header. If you switch to
// cookie-based/session auth, set `VITE_API_WITH_CREDENTIALS=true` in the
// environment and the backend must enable `CORS_ALLOW_CREDENTIALS`.
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: import.meta.env.VITE_API_WITH_CREDENTIALS === 'true' || false,
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  // Only attach a token when it's a real non-empty value (avoid sending 'null'/'undefined')
  if (token && token !== 'null' && token !== 'undefined') {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// Institution Auth
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

// SMS verification removed (Option A)

// Voter Auth
export const voterLogin = (identifier, institution_id) =>
  api.post('/auth/voter/login/', { identifier, institution_id });

// Institution endpoints
export const getMyInstitution = () =>
  api.get('/institutions/my_institution/');

export const updateMyInstitution = (data) =>
  api.patch('/institutions/my_institution/', data);

// Elections
export const createElection = (title, description, scrutin_type, majority_threshold = null, advance_threshold = null, start = null, end = null, open_immediately = false) => {
  const payload = { title, description, scrutin_type };
  if (majority_threshold !== null && majority_threshold !== undefined) payload.majority_threshold = majority_threshold;
  if (advance_threshold !== null && advance_threshold !== undefined) payload.advance_threshold = advance_threshold;
  if (start !== null && start !== undefined) payload.start = start;
  if (end !== null && end !== undefined) payload.end = end;
  // allow client to explicitly request opening the election at creation (boolean)
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

// Ballots
// Ballot helpers (legacy compatibility): map ballot operations to election-level endpoints
// The application now uses elections as the voting unit. These wrappers keep older
// frontend code working by delegating to election endpoints where possible.
export const createBallot = (election, title, description, start, end) => {
  // Legacy: creating a ballot for an election -> update election window / round
  // We'll call the advance_to_round2 endpoint when appropriate, otherwise patch the election.
  if (!election) return Promise.reject(new Error('election id required'));
  return api.post(`/elections/${election}/advance_to_round2/`, { start, end, title, open_immediately: false });
};

export const getBallots = (institutionId = null) =>
  // map to elections list for the institution
  api.get('/elections/', { params: institutionId ? { institution: institutionId } : {} });

export const getBallot = (id, voterId = null) =>
  // treat ballot id as election id in the migrated model
  api.get(`/elections/${id}/`, { params: voterId ? { voter_id: voterId } : {} });

export const openBallot = (id) =>
  // open election
  api.post(`/elections/${id}/open_election/`);

export const closeBallot = (id) =>
  // close election
  api.post(`/elections/${id}/close_election/`);

export const getBallotResults = (id) =>
  // map to election results
  api.get(`/elections/${id}/results/`);

export const updateBallot = (id, data) =>
  // map to election update
  api.patch(`/elections/${id}/`, data);

export const deleteBallot = (id) =>
  // map to election deletion
  api.delete(`/elections/${id}/`);

// Candidates
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
  // send multipart/form-data if there's a file, else send JSON patch
  const form = new FormData();
  if (election !== undefined) form.append('election', election);
  if (name !== undefined) form.append('name', name);
  if (bio !== undefined) form.append('bio', bio || '');
  if (position !== undefined) form.append('position', position || '');
  if (photo) form.append('photo', photo);
  // Patch with form works for multipart updates
  return api.patch(`/candidates/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const deleteCandidate = (id) => api.delete(`/candidates/${id}/`);

// Voters
export const addVoter = (identifier, name, eligible = true) =>
  api.post('/voters/', { identifier, name, eligible });

export const getVoters = () =>
  api.get('/voters/');

export const updateVoter = (id, data) =>
  api.patch(`/voters/${id}/`, data);

export const deleteVoter = (id) =>
  api.delete(`/voters/${id}/`);

// Import voters (CSV / XLSX) for an institution
export const importVoters = (institutionId, file) => {
  const form = new FormData();
  form.append('file', file);
  // Let axios set the Content-Type (including boundary) automatically.
  return api.post(`/institutions/${institutionId}/import_voters/`, form);
};

export const importVotersPreview = (institutionId, file) => {
  const form = new FormData();
  form.append('file', file);
  // pass preview query param so backend parses but does not persist
  return api.post(`/institutions/${institutionId}/import_voters/?preview=true`, form);
};

// Get a simple summary of voters for the authenticated institution
export const getVoterSummary = () => api.get('/institutions/voters_summary/');

// Import files management
export const getImportFiles = (institutionId) => api.get(`/institutions/${institutionId}/imports/`);
// NOTE: Django's APPEND_SLASH is enabled; use trailing slashes for POST endpoints that expect one.
export const deleteImportFile = (institutionId, fileId) => api.post(`/institutions/${institutionId}/imports/delete/`, { file_id: fileId });
export const forceDeleteImportFile = (institutionId, fileId) => api.post(`/institutions/${institutionId}/imports/force_delete/`, { file_id: fileId });

// Votes
export const castVote = (ballot_id, candidate_id, voter_id, election_id = null) => {
  const payload = { ballot_id, candidate_id, voter_id };
  // include election_id when provided (supports election-level voting)
  if (election_id !== null && election_id !== undefined) payload.election_id = election_id;
  return api.post('/votes/cast_vote/', payload);
};

// Check whether a voter has already voted in an election
export const checkHasVoted = (voter_id, election_id) =>
  api.get('/votes/has_voted/', { params: { voter_id, election_id } });

export default api;
export { API_BASE, API_HOST };
