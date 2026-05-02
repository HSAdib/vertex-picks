import { useCart } from '../context/CartContext';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Checkout() {
  const { cart, removeFromCart, cartTotal } = useCart();

  if (cart.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto py-24 px-4 text-center">
        <h2 className="text-3xl font-black uppercase text-gray-300 mb-4">Your Cart is Empty</h2>
        <p className="text-gray-500">Visit the shop to select your premium mangoes.</p>
      </div>
    );
  }

  const handleOrder = (e) => {
    e.preventDefault();
    
    // 1. Grab the data from the form
    const formData = new FormData(e.target);
    const customerName = formData.get('name');
    const phone = formData.get('phone');
    const address = formData.get('address');

    // 2. Show the premium sliding notification
    toast.success('Order prepared! Redirecting to WhatsApp...', {
      style: {
        border: '1px solid #f59e0b',
        padding: '16px',
        color: '#1a1a1a',
        fontWeight: 'bold',
      },
      iconTheme: {
        primary: '#f59e0b',
        secondary: '#fafafa',
      },
    });

    // 3. Format the WhatsApp Message cleanly
    let message = `*NEW ORDER: VERTEX PICKS* 🥭\n\n`;
    message += `*Customer:* ${customerName}\n`;
    message += `*Phone:* ${phone}\n`;
    message += `*Address:* ${address}\n\n`;
    message += `*Order Details:*\n`;

    cart.forEach((item, index) => {
       message += `${index + 1}. ${item.name} (${item.unit}) - ৳${item.price}\n`;
    });

    message += `\n*Total:* ৳${cartTotal}\n`;

    // 4. Generate the link and redirect
    const encodedMessage = encodeURIComponent(message);
    // REPLACE THIS NUMBER WITH YOUR ACTUAL BUSINESS WHATSAPP NUMBER
    const whatsappNumber = "8801581221084"; 
    const whatsappURL = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    // Wait 1.5 seconds so they can read the toast, then open WhatsApp
    setTimeout(() => {
      window.open(whatsappURL, '_blank');
    }, 1500);
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16">
      
      {/* Left Side: Order Summary */}
      <div>
        <h2 className="text-3xl font-black uppercase tracking-tight border-b-2 border-brand-gold pb-4 mb-8">Order Summary</h2>
        <div className="space-y-6">
          {cart.map((item, index) => (
            <div key={index} className="flex justify-between items-center bg-white p-4 shadow-sm border border-gray-100">
              <div>
                <h4 className="font-bold text-lg">{item.name}</h4>
                <p className="text-sm text-gray-500">{item.unit}</p>
              </div>
              <div className="flex items-center space-x-6">
                <span className="font-black text-brand-green">৳{item.price}</span>
                <button onClick={() => removeFromCart(index)} className="text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 p-6 bg-brand-dark text-brand-light flex justify-between items-center">
          <span className="text-xl font-bold uppercase tracking-widest">Total</span>
          <span className="text-3xl font-black text-brand-gold">৳{cartTotal}</span>
        </div>
      </div>

      {/* Right Side: Delivery Details Form */}
      <div>
        <h2 className="text-3xl font-black uppercase tracking-tight border-b-2 border-brand-gold pb-4 mb-8">Delivery Details</h2>
        <form onSubmit={handleOrder} className="space-y-6 bg-white p-8 shadow-sm border border-gray-100">
          
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-gray-700 mb-2">Full Name</label>
            <input required name="name" type="text" className="w-full border-2 border-gray-200 p-3 focus:border-brand-gold focus:outline-none transition-colors" placeholder="e.g. Asif Mahmud" />
          </div>

          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-gray-700 mb-2">Phone Number</label>
            <input required name="phone" type="tel" className="w-full border-2 border-gray-200 p-3 focus:border-brand-gold focus:outline-none transition-colors" placeholder="017XX-XXXXXX" />
          </div>

          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-gray-700 mb-2">Full Delivery Address</label>
            <textarea required name="address" rows="3" className="w-full border-2 border-gray-200 p-3 focus:border-brand-gold focus:outline-none transition-colors" placeholder="House No, Road No, Area, City" />
          </div>

          <button type="submit" className="w-full bg-brand-gold text-brand-dark font-black text-lg py-4 uppercase tracking-widest hover:bg-yellow-400 hover:scale-[1.02] transition-all duration-200">
            Confirm Order
          </button>

        </form>
      </div>

    </div>
  );
}