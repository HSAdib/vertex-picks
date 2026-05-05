import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'react-hot-toast';
export default function Checkout() {
  const handleConfirmOrder = async () => {
  if (!auth.currentUser) {
    toast.error("Please login to place an order!");
    return;
  }

  try {
    const orderData = {
      customerEmail: auth.currentUser.email,
      items: cart,
      total: grandTotal,
      status: 'Pending',
      createdAt: new Date()
    };

    await addDoc(collection(db, 'orders'), orderData);
    toast.success("Order Placed Successfully!");
    // You might want to clear the cart here
  } catch (error) {
    toast.error("Order failed. Try again.");
  }
};
  const { cart, removeFromCart, updateQuantity } = useCart();

  const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const deliveryFee = 150; 
  const grandTotal = subtotal + deliveryFee;

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white p-10 rounded-xl shadow-lg text-center max-w-lg w-full border-t-8 border-gray-300">
          <h2 className="text-3xl font-black text-gray-900 mb-4 uppercase">Your Box is Empty</h2>
          <p className="text-gray-500 mb-8 font-medium">You haven't added any premium mangoes to your harvest box yet.</p>
          <Link to="/shop" className="bg-black text-white px-8 py-4 rounded-md font-black hover:bg-orange-500 transition-colors uppercase tracking-widest block">
            Return to Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight uppercase mb-10">
          Checkout <span className="text-orange-500">Summary</span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="h-24 w-24 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-grow w-full">
                  <h3 className="text-xl font-black text-gray-900">{item.name}</h3>
                  <p className="text-gray-500 font-medium text-sm mb-3">৳{item.price} each</p>
                  
                  <div className="flex items-center gap-4">
                    {/* Quantity Selector */}
                    <div className="flex items-center border border-gray-300 rounded bg-gray-50 w-fit">
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)} 
                        disabled={item.quantity <= 1}
                        className="px-3 py-1 text-gray-600 hover:bg-gray-200 font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 font-bold text-sm border-l border-r border-gray-300 w-10 text-center bg-white">
                        {item.quantity}
                      </span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)} 
                        className="px-3 py-1 text-gray-600 hover:bg-gray-200 font-bold transition-colors"
                      >
                        +
                      </button>
                    </div>
                    
                    {/* NEW: Red Bin Icon Button */}
                    <button 
                      onClick={() => removeFromCart(item.id)} 
                      className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded transition-colors"
                      title="Remove Item"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="text-right sm:w-auto w-full mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-gray-100">
                  <p className="text-2xl font-black text-orange-500">৳{item.price * item.quantity}</p>
                </div>
              </div>
            ))}
          </div>

          {/* RECEIPT SECTION */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-t-8 border-orange-500 h-fit">
            <h2 className="text-xl font-black text-gray-900 mb-6 uppercase border-b pb-4">Order Total</h2>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-gray-600 font-medium">
                <span>Subtotal</span>
                <span>৳{subtotal}</span>
              </div>
              <div className="flex justify-between text-gray-600 font-medium">
                <span>Delivery Fee</span>
                <span>৳{deliveryFee}</span>
              </div>
            </div>
            
            <div className="border-t pt-4 mb-8">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Total</span>
                <span className="text-3xl font-black text-orange-500">৳{grandTotal}</span>
              </div>
            </div>

            <button className="w-full bg-black text-white font-black text-lg py-4 rounded-md hover:bg-orange-500 transition-colors uppercase tracking-widest">
              Confirm Order
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}