import React from 'react';
import logo from '../assets/logo-white.svg';

export function FormField({ label, type = 'text', name, value, onChange, required = false, rows = null, ...props }) {
  return (
    <div className="form-group">
      <label htmlFor={name}>{label}</label>
      {rows ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          rows={rows}
          {...props}
        />
      ) : (
        <input
          id={name}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          {...props}
        />
      )}
    </div>
  );
}

export function FormContainer({ children, title, onSubmit, submitText = 'Soumettre', loading = false }) {
  return (
    <div className="flex-center">
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-lg)',
        width: '100%',
        maxWidth: '500px',
      }}>
        {title && <h2>{title}</h2>}
        <form onSubmit={onSubmit}>
          {children}
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '20px' }}>
            {loading ? 'Traitement...' : submitText}
          </button>
        </form>
      </div>
    </div>
  );
}

export function Alert({ type = 'info', children }) {
  const alertClass = type === 'success' ? 'alert-success' : type === 'error' ? 'alert-error' : 'alert-info';
  return <div className={`alert ${alertClass}`}>{children}</div>;
}

export function Card({ children, title }) {
  return (
    <div className="card">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}

export function Footer() {
  return (
    <footer style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white', padding: '18px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logo} alt="VES" style={{ width: 38, height: 38, borderRadius: 6 }} />
          <div>
            <strong>VES — Vote Électronique Sûr</strong>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>© {new Date().getFullYear()} - Projet interne</div>
          </div>
        </div>
        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
          Besoin d'aide ? <a href="#" style={{ color: 'white', textDecoration: 'underline' }}>Contact</a>
        </div>
      </div>
    </footer>
  );
}

export function CandidateCard({ candidate, onEdit, onDelete }) {
  return (
    <div className="candidate-card" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderRadius: 8, border: '1px solid var(--muted)', background: 'var(--card-bg)' }}>
      {candidate.photo ? (
        <img src={candidate.photo} alt={candidate.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />
      ) : (
        <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(0,0,0,0.05)' }}>📷</div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700 }}>{candidate.name}</div>
            {candidate.position && <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{candidate.position}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => onEdit(candidate)} style={{ padding: '6px 8px' }}>✏️</button>
            <button className="btn-danger" onClick={() => onDelete(candidate)} style={{ padding: '6px 8px' }}>🗑️</button>
          </div>
        </div>
        {candidate.bio && <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: '0.9rem' }}>{candidate.bio}</div>}
      </div>
    </div>
  );
}

export function CandidateForm({ initial = {}, onSubmit, onCancel, submitText = 'Enregistrer' }) {
  const [form, setForm] = React.useState({ name: initial.name || '', position: initial.position || '', bio: initial.bio || '', photo: null });
  const [preview, setPreview] = React.useState(initial.photo || null);

  React.useEffect(() => {
    setForm({ name: initial.name || '', position: initial.position || '', bio: initial.bio || '', photo: null });
    setPreview(initial.photo || null);
  }, [initial]);

  const handleFile = (e) => {
    const file = e.target.files?.[0] || null;
    setForm((s) => ({ ...s, photo: file }));
    if (file) setPreview(URL.createObjectURL(file));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Support async onSubmit handlers: wait for completion then reset form
        const r = onSubmit(form);
        if (r && typeof r.then === 'function') {
          r.then(() => {
            setForm({ name: '', position: '', bio: '', photo: null });
            setPreview(null);
          }).catch(() => {
            // swallow, parent displays errors
          });
        } else {
          // synchronous handler: reset immediately
          setForm({ name: '', position: '', bio: '', photo: null });
          setPreview(null);
        }
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <input placeholder="Nom complet" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input placeholder="Poste (ex : Président)" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
      <textarea placeholder="Brève description" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="file" accept="image/*" onChange={handleFile} />
        {preview && <img src={preview} alt="aperçu" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn-primary">{submitText}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

export function Modal({ title, children, onClose, open = false, initialFocusRef = null }) {
  const overlayRef = React.useRef(null);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;

    // disable page scroll while modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // focus management: prefer initialFocusRef, else focus first focusable element
    const focusTarget = initialFocusRef?.current || containerRef.current?.querySelector('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
    if (focusTarget) focusTarget.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      // trap focus
      if (e.key === 'Tab') {
        const focusable = containerRef.current.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;

  return (
    <div className="modal-root" ref={overlayRef} aria-hidden={!open}>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-window" role="dialog" aria-modal="true" aria-label={title} ref={containerRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} className="btn-secondary">✕</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Pagination({ total = 0, page = 1, pageSize = 10, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const items = [];
  for (let i = 1; i <= pages; i++) items.push(i);
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
      <button className="btn-secondary" disabled={page === 1} onClick={() => onPage(page - 1)}>◀</button>
      {items.map((p) => (
        <button key={p} className={`btn-small ${p === page ? 'btn-primary' : ''}`} onClick={() => onPage(p)} style={{ minWidth: 38 }}>{p}</button>
      ))}
      <button className="btn-secondary" disabled={page === pages} onClick={() => onPage(page + 1)}>▶</button>
    </div>
  );
}
