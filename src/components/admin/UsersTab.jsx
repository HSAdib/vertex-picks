import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion } from 'framer-motion';

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // 1. Fetch all users
      const userSnap = await getDocs(collection(db, 'users'));
      
      // 2. Fetch all orders to compute stats
      const orderSnap = await getDocs(collection(db, 'orders'));
      const allOrders = orderSnap.docs.map(doc => doc.data());

      const fetchedUsers = userSnap.docs.map(doc => {
        const data = doc.data();
        const email = data.email || '';
        
        // Compute LTV and order counts by email
        const userOrders = allOrders.filter(o => o.customerEmail && o.customerEmail.toLowerCase() === email.toLowerCase() && !o.deleted);
        const totalSpent = userOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        const orderCount = userOrders.length;

        const defaultAddress = data.addresses?.find(a => a.isDefault) || data.addresses?.[0];

        return {
          id: doc.id,
          name: data.name || 'Anonymous Connoisseur',
          email: email || 'N/A',
          phone: defaultAddress?.phone || data.phone || 'N/A',
          createdAt: data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'Unknown',
          addressCount: data.addresses?.length || 0,
          totalSpent,
          orderCount
        };
      });

      // Sort by total spent to find highest LTV customers
      fetchedUsers.sort((a, b) => b.totalSpent - a.totalSpent);
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchUsers();
    });
  }, []);

  if (loading) {
    return (
      <div className="text-center p-12 font-black text-gray-500 uppercase tracking-widest animate-pulse">
        Loading Customers CRM...
      </div>
    );
  }

  // Get Top 3 Highest Spending Customers for the top cards grid
  const topCustomers = users.slice(0, 3);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 select-none"
    >
      {/* ============ HIGHEST SPENDING CUSTOMERS GRID ============ */}
      {topCustomers.length > 0 && (
        <div>
          <h4 className="text-[10px] font-black text-gray4 uppercase tracking-widest mb-3">👑 Highest Value Customers</h4>
          
          <div className="customer-grid">
            {topCustomers.map((cust) => {
              const initial = cust.name.charAt(0).toUpperCase();
              return (
                <div key={cust.id} className="cust-card">
                  <div className="cust-card-head">
                    <div className="cust-avatar">
                      {initial}
                    </div>
                    <div>
                      <div className="cust-name">{cust.name}</div>
                      <div className="cust-email">{cust.email}</div>
                    </div>
                  </div>
                  
                  <div className="cust-stats">
                    <div className="cs-item">
                      <strong>৳{cust.totalSpent.toLocaleString()}</strong>
                      Lifetime Value
                    </div>
                    <div className="cs-item">
                      <strong>{cust.orderCount}</strong>
                      Orders
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ CUSTOMERS DIRECTORY CRM ============ */}
      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <h3 className="ach-title">👥 Customer Directory CRM</h3>
            <span className="ach-sub">Track customer registration dates, contact directories, and lifetime values</span>
          </div>
          <span className="bg-primary-pale text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
            {users.length} Registered Users
          </span>
        </div>

        <div className="p-6">
          {users.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-gray2 rounded-brand text-gray4 font-bold text-xs">
              No registered customers found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Email Address</th>
                    <th>Primary Phone</th>
                    <th>Joined Date</th>
                    <th>Addresses</th>
                    <th>Total Orders</th>
                    <th>Lifetime Value</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const initialsAvatar = user.name.charAt(0).toUpperCase();
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="cust-avatar">
                              {initialsAvatar}
                            </div>
                            <span className="font-bold text-sm text-dark">{user.name}</span>
                          </div>
                        </td>
                        <td className="font-medium text-xs text-gray-600">{user.email}</td>
                        <td className="font-semibold text-xs text-blue">{user.phone}</td>
                        <td className="font-medium text-xs text-gray4">{user.createdAt}</td>
                        <td>
                          <span className="bg-gray1 text-gray-700 border border-gray2 px-2.5 py-0.5 rounded text-[10px] font-bold">
                            {user.addressCount} saved
                          </span>
                        </td>
                        <td className="font-bold text-xs text-gray-800">{user.orderCount}</td>
                        <td className="font-bold text-sm text-primary">৳{user.totalSpent.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </motion.div>
  );
}
