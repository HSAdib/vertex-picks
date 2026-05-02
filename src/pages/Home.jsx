import { Link } from 'react-router-dom';
import { ShieldCheck, Leaf, Star } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col items-center w-full">
      
      {/* The Hero Banner */}
      <section className="w-full bg-brand-dark text-brand-light py-24 px-4 sm:px-6 lg:px-8 text-center border-b-4 border-brand-gold">
        <div className="max-w-4xl mx-auto mt-8">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 uppercase leading-tight">
            The Pinnacle of <br/><span className="text-brand-gold">Rajshahi Mangoes</span>
          </h1>
          <p className="text-lg md:text-2xl font-light text-gray-300 mb-10 max-w-2xl mx-auto">
            Hand-picked. Bagged on the tree. Delivered flawlessly to your doorstep. Experience the premium standard.
          </p>
          <Link to="/shop" className="inline-block bg-brand-gold text-brand-dark font-black text-lg px-8 py-4 uppercase tracking-widest hover:bg-yellow-400 hover:scale-105 transition-all duration-200">
            Reserve Your Box
          </Link>
        </div>
      </section>

      {/* The Trust Badges (Why they should pay premium) */}
      <section className="w-full max-w-7xl mx-auto py-20 px-4 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
        
        <div className="flex flex-col items-center p-6">
          <ShieldCheck className="h-16 w-16 text-brand-green mb-6" />
          <h3 className="text-2xl font-black mb-3 uppercase tracking-wide">Flawless Guarantee</h3>
          <p className="text-gray-600 text-lg">Find a fault inside? Send us a photo and we replace the box. No questions asked.</p>
        </div>

        <div className="flex flex-col items-center p-6">
          <Leaf className="h-16 w-16 text-brand-green mb-6" />
          <h3 className="text-2xl font-black mb-3 uppercase tracking-wide">100% Chemical Free</h3>
          <p className="text-gray-600 text-lg">Tree-bagged protection means zero harmful pesticides and a naturally sweet taste.</p>
        </div>

        <div className="flex flex-col items-center p-6">
          <Star className="h-16 w-16 text-brand-green mb-6" />
          <h3 className="text-2xl font-black mb-3 uppercase tracking-wide">Premium Grading</h3>
          <p className="text-gray-600 text-lg">Only the top 5% of the harvest meets our standard. Sized perfectly, unblemished skin.</p>
        </div>

      </section>
    </div>
  );
}