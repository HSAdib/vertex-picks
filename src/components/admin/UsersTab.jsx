import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion } from 'framer-motion';

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const fetchedUsers = snap.docs.map(doc => {
        const data = doc.data();
        // Find default address or first address to extract phone
        const defaultAddress = data.addresses?.find(a => a.isDefault) || data.addresses?.[0];
        
        return {
          id: doc.id,
          name: data.name || 'N/A',
          email: data.email || 'N/A',
          phone: defaultAddress?.phone || 'N/A',
          createdAt: data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'Unknown',
          addressCount: data.addresses?.length || 0
        };
      });
      // Sort by newest first, assuming createdAt exists. Otherwise, just keep order.
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center p-10 font-black text-gray-500 uppercase tracking-widest animate-pulse">Loading Customers...</div>;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h2 className="font-black uppercase text-xl">👥 Customer CRM</h2>
          <p className="text-gray-500 font-bold text-sm">Showing all registered users ({users.length})</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-500 text-xs font-black uppercase tracking-widest border-b border-gray-200">
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Primary Phone</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4">Saved Addresses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length > 0 ? users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-black text-gray-900">{user.name}</td>
                  <td className="p-4 font-bold text-gray-600">{user.email}</td>
                  <td className="p-4 font-bold text-blue-600">{user.phone}</td>
                  <td className="p-4 font-bold text-gray-500">{user.createdAt}</td>
                  <td className="p-4 font-bold text-gray-500">
                    <span className="bg-gray-200 px-2 py-1 rounded text-xs">{user.addressCount}</span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400 font-bold">No customers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
