import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

export default function HomeTab() {
  const [storeSections, setStoreSections] = useState([]);
  const [newSectionName, setNewSectionName] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    try {
      const docRef = doc(db, 'mangoes', 'STORE_SECTIONS');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setStoreSections(docSnap.data().list || []);
      }
    } catch (err) {
      console.error('Failed to fetch sections:', err);
      toast.error("Failed to load sections. Check Firestore rules.");
    } finally {
      setLoading(false);
    }
  };

  const saveSections = async (updatedSections) => {
    await setDoc(doc(db, 'mangoes', 'STORE_SECTIONS'), { list: updatedSections }, { merge: true });
    setStoreSections(updatedSections);
  };

  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    if (storeSections.includes(newSectionName.trim())) return toast.error("Section already exists!");
    try {
      await saveSections([...storeSections, newSectionName.trim()]);
      setNewSectionName('');
      toast.success("Section Added!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add section.");
    }
  };

  const handleRemoveSection = async (sec) => {
    try {
      await saveSections(storeSections.filter(s => s !== sec));
      toast.success("Section Removed!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove section.");
    }
  };

  const handleRenameSection = async (idx) => {
    if (!editingName.trim()) return;
    if (storeSections.includes(editingName.trim())) return toast.error("That name already exists!");
    try {
      const updated = [...storeSections];
      updated[idx] = editingName.trim();
      await saveSections(updated);
      setEditingIndex(null);
      setEditingName('');
      toast.success("Section Renamed!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to rename section.");
    }
  };

  const moveSection = async (index, direction) => {
    const newSections = [...storeSections];
    if (direction === 'up' && index > 0) {
      [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
    } else if (direction === 'down' && index < newSections.length - 1) {
      [newSections[index + 1], newSections[index]] = [newSections[index], newSections[index + 1]];
    } else {
      return;
    }
    try {
      await saveSections(newSections);
    } catch (err) {
      console.error(err);
      toast.error("Failed to rearrange sections.");
    }
  };

  if (loading) return <div className="text-center p-10 font-black text-gray-500 uppercase tracking-widest">Loading Tools...</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-black uppercase text-xl mb-4 text-gray-900">Manage Store Sections</h2>
        <p className="text-sm text-gray-500 font-bold mb-6">Create, delete, rename, and arrange the order of your shop's categories. The order here determines the layout of your Shop's navigation bar.</p>
        
        <form onSubmit={handleAddSection} className="flex gap-2 mb-8">
          <input type="text" placeholder="New Section Name (e.g. Sweets)" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} className="p-3 bg-gray-50 border rounded font-bold outline-none flex-grow" />
          <button type="submit" className="bg-black text-white font-black px-6 py-3 rounded uppercase text-sm hover:bg-orange-500 transition-colors">Add</button>
        </form>

        {storeSections.length > 0 ? (
          <div className="space-y-3">
            {storeSections.map((sec, idx) => (
              <div key={idx} className="bg-gray-50 p-4 rounded-lg flex items-center justify-between border border-gray-200 shadow-sm gap-3">
                {editingIndex === idx ? (
                  <div className="flex items-center gap-2 flex-grow">
                    <input 
                      type="text" 
                      value={editingName} 
                      onChange={e => setEditingName(e.target.value)} 
                      className="p-2 bg-white border-2 border-orange-400 rounded font-bold outline-none flex-grow"
                      autoFocus
                    />
                    <button onClick={() => handleRenameSection(idx)} className="bg-orange-500 text-white px-4 py-2 rounded font-black text-xs uppercase hover:bg-orange-600 transition-colors">Save</button>
                    <button onClick={() => { setEditingIndex(null); setEditingName(''); }} className="bg-gray-200 text-gray-600 px-4 py-2 rounded font-black text-xs uppercase hover:bg-gray-300 transition-colors">Cancel</button>
                  </div>
                ) : (
                  <span className="font-black text-lg text-gray-800">{sec}</span>
                )}

                {editingIndex !== idx && (
                  <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                    <div className="flex gap-1 bg-white border border-gray-200 rounded overflow-hidden">
                      <button 
                        onClick={() => moveSection(idx, 'up')} 
                        disabled={idx === 0}
                        className={`px-3 py-2 ${idx === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100 hover:text-black'} transition-colors font-bold border-r border-gray-200`}
                      >
                        ▲
                      </button>
                      <button 
                        onClick={() => moveSection(idx, 'down')} 
                        disabled={idx === storeSections.length - 1}
                        className={`px-3 py-2 ${idx === storeSections.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100 hover:text-black'} transition-colors font-bold`}
                      >
                        ▼
                      </button>
                    </div>
                    <button onClick={() => { setEditingIndex(idx); setEditingName(sec); }} className="bg-blue-50 text-blue-600 px-4 py-2 rounded font-black text-xs uppercase hover:bg-blue-500 hover:text-white transition-colors border border-blue-100 shadow-sm">Edit</button>
                    <button onClick={() => handleRemoveSection(sec)} className="bg-red-50 text-red-600 px-4 py-2 rounded font-black text-xs uppercase hover:bg-red-500 hover:text-white transition-colors border border-red-100 shadow-sm">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400 font-bold">
            <p className="text-lg">No sections yet.</p>
            <p className="text-sm mt-1">Use the input above to create your first store section!</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
