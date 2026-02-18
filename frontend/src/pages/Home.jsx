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
        padding: 'clamp(40px, 10vw, 80px) 20px',
        textAlign: 'center',
        marginBottom: '40px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* superposition sombre semi-transparente + flou */}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '14px 22px', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', boxShadow: '0 6px 20px rgba(2,6,23,0.12)', border: '1px solid rgba(255,255,255,0.06)', maxWidth: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ color: 'white', marginBottom: '6px', fontSize: 'clamp(1.5rem, 5vw, 2.4rem)' }}>
                VES — Vote Électronique Sûr
              </h1>
              <p style={{ fontSize: 'clamp(0.9rem, 3vw, 1.05rem)', margin: 0, opacity: 0.95, color: 'white', fontWeight: 700 }}>
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
          <ul style={{ listStyle: 'none', columns: 'auto', columnWidth: '300px', columnGap: '40px', gap: '16px' }}>
            <li style={{ paddingBottom: '16px', breakInside: 'avoid' }}>✓ Création d'élections simplifiée</li>
            <li style={{ paddingBottom: '16px', breakInside: 'avoid' }}>✓ Gestion des candidats et votants</li>
            <li style={{ paddingBottom: '16px', breakInside: 'avoid' }}>✓ Bulletin de vote sécurisé</li>
            <li style={{ paddingBottom: '16px', breakInside: 'avoid' }}>✓ Résultats en temps réel</li>
            <li style={{ paddingBottom: '16px', breakInside: 'avoid' }}>✓ Audit et traçabilité complets</li>
            <li style={{ paddingBottom: '16px', breakInside: 'avoid' }}>✓ Interface intuitive et mobile-friendly</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
