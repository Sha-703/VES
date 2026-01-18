import React from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google';
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import logo from './assets/logo-white.svg'

// Pages
import Home from './pages/Home'
import InstitutionRegister from './pages/InstitutionRegister'
import InstitutionLogin from './pages/InstitutionLogin'
import InstitutionDashboard from './pages/InstitutionDashboard'
import ManageElection from './pages/ManageElection'
import ManageCandidates from './pages/ManageCandidates'
import ElectionResults from './pages/ElectionResults'
import ImportHistory from './pages/ImportHistory'
import CreateElection from './pages/CreateElection'
import VoterLogin from './pages/VoterLogin'
import VoterElections from './pages/VoterElections'
import VoteElection from './pages/VoteElection'
import { Footer } from './components/FormComponents'
// ...existing code...

function App() {
  // Remplacez par votre vrai client ID Google OAuth
  const GOOGLE_CLIENT_ID = '979207302038-rcoatkmnfapqvdrc746tnum8q3bvd2d2.apps.googleusercontent.com';
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Router>
        <div className="app-root">
          <header className="app-header" style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))' }}>
            <img src={logo} alt="VES logo" style={{ height: 40 }} />
          </header>
          <main className="app-main" style={{ padding: 24 }}>
            <Routes>
              {/* Accueil */}
              <Route path="/" element={<Home />} />

              {/* Routes Institution */}
              <Route path="/institution/register" element={<InstitutionRegister />} />
              <Route path="/institution/login" element={<InstitutionLogin />} />
              {/* Page de vérification supprimée : les utilisateurs peuvent se connecter immédiatement après l'inscription */}
              <Route path="/institution/dashboard" element={<InstitutionDashboard />} />
              <Route path="/institution/imports" element={<ImportHistory />} />
              {/* <Route path="/institution/settings" element={<InstitutionSettings />} /> */}
              <Route path="/institution/election/new" element={<CreateElection />} />
              <Route path="/institution/election/:electionId" element={<ManageElection />} />
              <Route path="/institution/election/:electionId/candidates" element={<ManageCandidates />} />
              <Route path="/institution/election/:electionId/results" element={<ElectionResults />} />

              {/* Voter Routes */}
              <Route path="/voter/login" element={<VoterLogin />} />
              <Route path="/voter/ballots" element={<VoterElections />} />
              <Route path="/voter/vote_election/:electionId" element={<VoteElection />} />
              <Route path="/voter/verify-email" element={<(await import('./pages/VoterEmailVerify.jsx')).default />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App
