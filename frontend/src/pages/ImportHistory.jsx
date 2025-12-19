import React, { useEffect, useState } from 'react';
import { getMyInstitution, getImportFiles, deleteImportFile, forceDeleteImportFile } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Modal, Alert } from '../components/FormComponents';

export default function ImportHistory() {
  const [institution, setInstitution] = useState(null);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forceModalOpen, setForceModalOpen] = useState(false);
  const [forceTarget, setForceTarget] = useState(null);
  const [forceLoading, setForceLoading] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/institution/login');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const inst = await getMyInstitution();
      setInstitution(inst.data);
      const resp = await getImportFiles(inst.data.id);
      setImports(resp.data.imports || []);
    } catch (err) {
      // afficher une erreur plus détaillée pour aider au débogage
      const status = err.response?.status;
      const data = err.response?.data;
      const msg = data?.detail || data || err.message || 'Erreur lors du chargement des imports.';
      setError(`Erreur${status ? ' ' + status : ''} : ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
      console.error('ImportHistory loadData error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Supprimer ce fichier importé ? Cette action est irréversible.')) return;
    try {
      await deleteImportFile(institution.id, fileId);
      // actualiser
      loadData();
    } catch (err) {
      const data = err.response?.data;
      if (data?.blocked_count) {
        // afficher la modale de forçage proposant la suppression forcée
        setBlockedInfo(data);
        setForceTarget(fileId);
        setForceModalOpen(true);
      } else {
        setError(err.response?.data?.detail || 'Erreur lors de la suppression.');
      }
    }
  };

  const handleForceDelete = async () => {
    if (!forceTarget) return;
    setForceLoading(true);
    setError('');
    try {
      const resp = await forceDeleteImportFile(institution.id, forceTarget);
      const backup = resp.data.backup;
      // déclencher le téléchargement du CSV de sauvegarde
      const blob = new Blob([backup], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import_backup_${forceTarget}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setForceModalOpen(false);
      setForceTarget(null);
      setBlockedInfo(null);
      // refresh
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la suppression forcée.');
    } finally {
      setForceLoading(false);
    }
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-secondary" onClick={() => navigate('/institution/dashboard')}>Retour</button>
          <h2 style={{ margin: 0 }}>Historique des imports</h2>
        </div>
        <div>
          <button className="btn-primary" onClick={loadData} style={{ marginLeft: 8 }}>Réessayer</button>
        </div>
      </div>

      {error && <div style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</div>}

      <Modal title="Suppression forcée" open={forceModalOpen} onClose={() => setForceModalOpen(false)}>
        <div>
          <p>Des votants importés ont déjà voté. Voulez-vous forcer la suppression ? Cela supprimera aussi les votes et générera un backup CSV téléchargeable.</p>
          {blockedInfo && (
            <div style={{ fontSize: 13, color: '#374151' }}>Votants bloquants (exemple): {blockedInfo.blocked_voters_sample?.slice(0,5).join(', ')} — total: {blockedInfo.blocked_count}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button className="btn-secondary" onClick={() => setForceModalOpen(false)}>Annuler</button>
            <button className="btn-danger" onClick={handleForceDelete} disabled={forceLoading}>{forceLoading ? 'Suppression…' : 'Forcer la suppression'}</button>
          </div>
        </div>
      </Modal>

      {imports.length === 0 ? (
        <div>Aucun fichier importé pour l'instant.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {imports.map((imp) => (
            <div key={imp.id} style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{imp.file_url ? imp.file_url.split('/').pop() : `Import ${imp.id}`}</div>
                  <div style={{ fontSize: 13, color: '#666' }}>Téléversé par {imp.uploaded_by} le {new Date(imp.uploaded_at).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {imp.file_url && (
                    <a className="btn-secondary" href={imp.file_url} target="_blank" rel="noreferrer">Télécharger</a>
                  )}
                  <button className="btn-danger" onClick={() => handleDelete(imp.id)}>Supprimer</button>
                </div>
              </div>

              <div style={{ marginTop: 8, fontSize: 13 }}>
                Lignes: {imp.total_rows ?? '—'} — Créés: {imp.created ?? '—'} — Mis à jour: {imp.updated ?? '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
