import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { toast } from 'react-hot-toast';

export default function FiltersTab() {
  const [filters, setFilters] = useState({
    season: [],
    weight: [],
    priceRange: [],
    variety: []
  });
  const [newInputs, setNewInputs] = useState({
    season: '',
    weight: '',
    priceRange: '',
    variety: ''
  });
  const [editing, setEditing] = useState({ category: null, oldVal: '', newVal: '' });
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [detailView, setDetailView] = useState({ active: false, category: null, val: '' });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFilters();
  }, []);

  const fetchFilters = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'mangoes', 'FILTERS'));
      const data = docSnap.data();
      const isFunctionallyEmpty = !docSnap.exists() || !data || (
        (!data.variety || data.variety.length === 0) && 
        (!data.weight || data.weight.length === 0) && 
        (!data.season || data.season.length === 0)
      );

      if (isFunctionallyEmpty) {
        setFilters({
          variety: ['Himsagar', 'Langra', 'Fazli', 'Gopalbhog', 'Amrapali', 'Gift Box'],
          weight: ['5kg', '10kg', '20kg'],
          season: ['Early Season', 'Peak Season', 'Late Season'],
          priceRange: ['0-500', '501-1000', '1000+']
        });
      } else {
        setFilters({
          season: data.season || [],
          weight: data.weight || [],
          priceRange: data.priceRange || [],
          variety: data.variety || []
        });
      }
      
      const prodSnap = await getDocs(collection(db, 'mangoes'));
      setProducts(prodSnap.docs.filter(d => !['CATEGORIES','STORE_SECTIONS','STORE_SETTINGS','NAVBAR_TABS','FILTERS', 'VARIETIES'].includes(d.id)).map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedFilters) => {
    try {
      await setDoc(doc(db, 'mangoes', 'FILTERS'), updatedFilters, { merge: true });
      setFilters(updatedFilters);
      toast.success('Filters updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save filters');
    }
  };

  const handleAdd = (category) => {
    const val = newInputs[category].trim();
    if (!val) return;
    if (filters[category].includes(val)) {
      toast.error('Option already exists');
      return;
    }
    const updated = { ...filters, [category]: [...filters[category], val] };
    handleSave(updated);
    setNewInputs({ ...newInputs, [category]: '' });
  };

  const handleDelete = (category, val) => {
    if (!window.confirm(`Delete option "${val}" from ${category}?`)) return;
    const updated = { ...filters, [category]: filters[category].filter(v => v !== val) };
    handleSave(updated);
  };

  const handleEditSave = () => {
    const { category, oldVal, newVal } = editing;
    const val = newVal.trim();
    if (!val || val === oldVal) {
      setEditing({ category: null, oldVal: '', newVal: '' });
      return;
    }
    if (filters[category].includes(val)) {
      toast.error('Option already exists');
      return;
    }
    const updatedArray = filters[category].map(v => v === oldVal ? val : v);
    const updated = { ...filters, [category]: updatedArray };
    handleSave(updated);
    setEditing({ category: null, oldVal: '', newVal: '' });
  };

  const toggleProductFilter = async (product, category, val) => {
    try {
      const currentArr = product[category] || [];
      const isAssigned = Array.isArray(currentArr) ? currentArr.includes(val) : currentArr === val;
      let newArr;
      if (Array.isArray(currentArr)) {
        newArr = isAssigned ? currentArr.filter(i => i !== val) : [...currentArr, val];
      } else {
        newArr = isAssigned ? [] : [currentArr, val].filter(Boolean);
      }
      
      await updateDoc(doc(db, 'mangoes', product.id), { [category]: newArr });
      setProducts(p => p.map(pr => pr.id === product.id ? { ...pr, [category]: newArr } : pr));
      toast.success('Product updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update product');
    }
  };

  if (loading) return <div>Loading Filters...</div>;

  if (detailView.active) {
    const { category, val } = detailView;
    const filteredProducts = products.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    return (
      <div className="admin-tab active">
        <div className="admin-header" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="btn-secondary" onClick={() => { setDetailView({ active: false, category: null, val: '' }); setSearchQuery(''); }}>
            ← Back
          </button>
          <div className="admin-title">Assign: {val} ({category})</div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <input type="text" className="form-input" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="admin-card" style={{ padding: '1rem' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center' }}>Assign</th>
                <th>Product Name</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => {
                const currentArr = p[category] || [];
                const isAssigned = Array.isArray(currentArr) ? currentArr.includes(val) : currentArr === val;
                return (
                  <tr key={p.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={isAssigned} onChange={() => toggleProductFilter(p, category, val)} style={{ transform: 'scale(1.2)' }} />
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && <tr><td colSpan="2" style={{ textAlign: 'center', padding: '2rem' }}>No products found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const renderFilterSection = (title, key, placeholder) => (
    <div className="admin-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', marginBottom: '1rem', textTransform: 'capitalize' }}>{title} Options</h3>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input 
          type="text" 
          placeholder={placeholder} 
          value={newInputs[key]} 
          onChange={(e) => setNewInputs({ ...newInputs, [key]: e.target.value })}
          className="form-input"
          style={{ maxWidth: '300px' }}
        />
        <button className="add-btn" onClick={() => handleAdd(key)}>Add</button>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Option Name</th>
            <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {filters[key].length === 0 && (
            <tr><td colSpan="2" style={{ textAlign: 'center' }}>No options found.</td></tr>
          )}
          {filters[key].map((val, idx) => (
            <tr key={idx}>
              {editing.category === key && editing.oldVal === val ? (
                <>
                  <td style={{ fontWeight: 600 }}>
                    <input 
                      type="text" 
                      value={editing.newVal} 
                      onChange={e => setEditing({ ...editing, newVal: e.target.value })}
                      className="form-input"
                      style={{ padding: '0.25rem 0.5rem', margin: 0 }}
                      autoFocus
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="at-action-btn" onClick={handleEditSave} style={{ marginRight: '0.5rem' }}>
                      💾
                    </button>
                    <button className="at-action-btn" onClick={() => setEditing({ category: null, oldVal: '', newVal: '' })}>
                      ✖️
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td style={{ fontWeight: 600 }}>{val}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="at-action-btn" onClick={() => setDetailView({ active: true, category: key, val })} style={{ marginRight: '0.5rem' }} title="Assign Products">
                      ⚙️
                    </button>
                    <button className="at-action-btn" onClick={() => setEditing({ category: key, oldVal: val, newVal: val })} style={{ marginRight: '0.5rem' }} title="Rename">
                      ✏️
                    </button>
                    <button className="at-action-btn danger" onClick={() => handleDelete(key, val)} title="Delete">
                      🗑️
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="admin-tab active">
      <div className="admin-header">
        <div className="admin-title">🎛️ Manage Global Filters</div>
      </div>
      
      {renderFilterSection('Variety', 'variety', 'e.g. Himsagar, Langra')}
      {renderFilterSection('Price Range', 'priceRange', 'e.g. 0-500, 501-1000, 1000+')}
      {renderFilterSection('Weight', 'weight', 'e.g. 1 Dozen, 2 Kg, 5 Kg')}
      {renderFilterSection('Season', 'season', 'e.g. Early, Peak, Late')}
      
    </div>
  );
}
