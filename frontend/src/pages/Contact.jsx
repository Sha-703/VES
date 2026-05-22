import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Contact() {
  const navigate = useNavigate();

  return (
    <div className="container app-main" style={{ padding: '24px', maxWidth: 860, margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} className="btn-secondary" style={{ marginBottom: 18 }}>
        ← Retour
      </button>
      <div className="card" style={{ padding: 24, borderRadius: 14, boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)' }}>
        <h1 style={{ marginTop: 0 }}>Contact</h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: '#374151' }}>
          Bonjour, je suis <strong>KIBAMBE LONGO Charia</strong>.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: '#374151' }}>
          Étudiant en Master de l'enseignement de l'informatique à l'<strong>ISP Mbanza</strong>.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: '#374151' }}>
          Email : <a href="mailto:shrlongo@gmail.com" style={{ color: '#2563eb', textDecoration: 'underline' }}>shrlongo@gmail.com</a>
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: '#374151' }}>
          Contact : <strong>+243 895 499 412</strong>
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: '#4b5563' }}>
          Si vous souhaitez plus d'informations, vous pouvez revenir en arrière ou naviguer vers votre tableau de bord.
        </p>
      </div>
    </div>
  );
}
