import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Checkout() {
  const { cart } = useCart();

  // Calculate the total price of all mangoes
  const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const deliveryFee = 150; // Standard BDT delivery fee
  const grandTotal = subtotal + deliveryFee;

  const handleConfirmOrder = () => {
    // Show the premium sliding notification
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

    // Format the WhatsApp Message
    let message = `*NEW ORDER: VERTEX PICKS* 🥭\n\n`;
    message += `*Order Details:*\n`;

    cart.forEach((item, index) => {
      message += `${index + 1}. ${item.name} x${item.quantity} - ৳${item.price * item.quantity}\n`;
    });

    message += `\n*Subtotal:* ৳${subtotal}\n`;
    message += `*Delivery:* ৳${deliveryFee}\n`;
    message += `*Total:* ৳${grandTotal}\n`;

    // Generate the link and redirect
    const encodedMessage = encodeURIComponent(message);
    const whatsappNumber = "8801581221084";
    const whatsappURL = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    // Wait 1.5 seconds so they can read the toast, then open WhatsApp
    setTimeout(() => {
      window.open(whatsappURL, '_blank');
    }, 1500);
  };

  // --- EMPTY CART VIEW ---
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white p-10 rounded-xl shadow-lg text-center max-w-lg w-full border-t-8 border-gray-300">
          <h2 className="text-3xl font-black text-gray-900 mb-4 uppercase">Your Box is Empty</h2>
          <p className="text-gray-500 mb-8 font-medium">You haven't added any premium mangoes to your harvest box yet.</p>
          <Link 
            to="/shop" 
            className="bg-black text-white px-8 py-4 rounded-md font-black hover:bg-orange-500 transition-colors uppercase tracking-widest block"
          >
            Return to Shop
          </Link>
        </div>
      </div>
    );
  }

  // --- FULL CART VIEW ---
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight uppercase mb-10">
          Checkout <span className="text-orange-500">Summary</span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: The Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-6">
                <div className="h-24 w-24 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-grow">
                  <h3 className="text-xl font-black text-gray-900">{item.name}</h3>
                  <p className="text-gray-500 font-medium text-sm">Qty: {item.quantity}</p>
                </div>
                
                <div className="text-right">
                  <p className="text-xl font-black text-orange-500">৳{item.price * item.quantity}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: The Receipt */}
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

            <button 
              onClick={handleConfirmOrder}
              className="w-full bg-black text-white font-black text-lg py-4 rounded-md hover:bg-orange-500 transition-colors uppercase tracking-widest"
            >
              Confirm Order
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}