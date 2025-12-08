import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo-white.svg';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #007bff, #0056b3)',
        color: 'white',
        padding: '80px 20px',
        textAlign: 'center',
        marginBottom: '40px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* semi-transparent dark overlay + blur */}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16, padding: '14px 22px', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', boxShadow: '0 6px 20px rgba(2,6,23,0.12)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ textAlign: 'left' }}>
              <h1 style={{ color: 'white', marginBottom: '6px', fontSize: '2.4rem' }}>
                VES — Vote Électronique Sûr
              </h1>
              <p style={{ fontSize: '1.05rem', margin: 0, opacity: 0.95, color: 'black', fontWeight: 700 }}>
                Plateforme moderne pour organiser et gérer des élections en ligne
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="grid" style={{ marginBottom: '40px' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <h2>Pour les Institutions</h2>
            <p>Créez vos élections, gérez les candidats et suivez les résultats en temps réel</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/institution/login')} className="btn-primary">
                Se connecter
              </button>
              <button onClick={() => navigate('/institution/register')} className="btn-secondary">
                S'inscrire
              </button>
            </div>
          </div>

          <div className="card" style={{ textAlign: 'center' }}>
            <h2>Pour les Électeurs</h2>
            <p>Votez facilement et en toute sécurité pour vos scrutins</p>
            <div>
              <button onClick={() => navigate('/voter/login')} className="btn-primary">
                Voter maintenant
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>✨ Fonctionnalités</h2>
          <ul style={{ listStyle: 'none', columns: 2, columnGap: '40px' }}>
            <li style={{ paddingBottom: '16px' }}>✓ Création d'élections simplifiée</li>
            <li style={{ paddingBottom: '16px' }}>✓ Gestion des candidats et votants</li>
            <li style={{ paddingBottom: '16px' }}>✓ Bulletin de vote sécurisé</li>
            <li style={{ paddingBottom: '16px' }}>✓ Résultats en temps réel</li>
            <li style={{ paddingBottom: '16px' }}>✓ Audit et traçabilité complets</li>
            <li style={{ paddingBottom: '16px' }}>✓ Interface intuitive et mobile-friendly</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
