import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';

export default function Checkout() {
  // NEW: Pulled updateQuantity out of the brain
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
                  
                  {/* NEW: Interactive Quantity Selector inside the Cart */}
                  <div className="flex items-center gap-4">
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
                    
                    <button 
                      onClick={() => removeFromCart(item.id)} 
                      className="text-red-500 hover:text-red-700 hover:underline text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                      Remove
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