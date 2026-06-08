import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { toast } from 'react-hot-toast';

export default function CategoriesTab() {
  const [categories, setCategories] = useState([]);
  const [newCat, setNewCat] = useState('');
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'mangoes', 'CATEGORIES'));
      if (docSnap.exists() && docSnap.data().list) {
        setCategories(docSnap.data().list);
      } else {
        setCategories([]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedList) => {
    try {
      await setDoc(doc(db, 'mangoes', 'CATEGORIES'), { list: updatedList }, { merge: true });
      setCategories(updatedList);
      toast.success('Categories updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save categories');
    }
  };

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      toast.error('Category already exists');
      return;
    }
    const updated = [...categories, trimmed];
    handleSave(updated);
    setNewCat('');
  };

  const handleDelete = (cat) => {
    if (!window.confirm(`Delete category "${cat}"?`)) return;
    const updated = categories.filter(c => c !== cat);
    handleSave(updated);
  };

  // 5. Data Migration Utility
  const runMigration = async () => {
    if (!window.confirm('This will update all products to use a category field based on their old section/variety. Proceed?')) return;
    setMigrating(true);
    try {
      const snap = await getDocs(collection(db, 'mangoes'));
      let count = 0;
      for (const d of snap.docs) {
        if (['STORE_SECTIONS', 'STORE_SETTINGS', 'NAVBAR_TABS', 'CATEGORIES'].includes(d.id)) continue;
        const data = d.data();
        const cat = data.section || data.variety || 'Uncategorized';
        await updateDoc(doc(db, 'mangoes', d.id), { category: cat });
        
        // Let's also add it to our active categories if it's not there
        setCategories(prev => {
          if (!prev.includes(cat)) {
            const next = [...prev, cat];
            setDoc(doc(db, 'mangoes', 'CATEGORIES'), { list: next }, { merge: true });
            return next;
          }
          return prev;
        });
        count++;
      }
      toast.success(`Migrated ${count} products successfully!`);
    } catch (err) {
      console.error(err);
      toast.error('Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  if (loading) return <div>Loading Categories...</div>;

  return (
    <div className="admin-tab active">
      <div className="admin-header">
        <div className="admin-title">📁 Manage Categories</div>
      </div>

      <div className="admin-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Category List</h3>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input 
            type="text" 
            placeholder="New Category Name (e.g. Mangoes)" 
            value={newCat} 
            onChange={(e) => setNewCat(e.target.value)}
            className="form-input"
            style={{ maxWidth: '300px' }}
          />
          <button className="add-btn" onClick={handleAdd}>Add</button>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Category Name</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr><td colSpan="2" style={{ textAlign: 'center' }}>No categories found.</td></tr>
            )}
            {categories.map((cat, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 600 }}>{cat}</td>
                <td style={{ textAlign: 'center' }}>
                  <button className="at-action-btn danger" onClick={() => handleDelete(cat)}>
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-card" style={{ padding: '1.5rem', border: '1.5px dashed var(--gray3)' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--red)' }}>Danger Zone / Utilities</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--gray4)', marginBottom: '1rem' }}>
          Run the migration utility to copy old `section` or `variety` fields into the new `category` field across all products.
        </p>
        <button 
          onClick={runMigration} 
          disabled={migrating}
          className="btn-outline" 
          style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
        >
          {migrating ? 'Migrating...' : 'Run Data Migration'}
        </button>
      </div>
    </div>
  );
}
