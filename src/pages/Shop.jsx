import ProductCard from '../components/ProductCard';

const mangoData = [
  {
    id: 1,
    name: "Premium Himsagar",
    grade: "Export Grade • Tree-Bagged",
    description: "The king of Rajshahi mangoes. Flawless skin, fiber-less sweet flesh, and guaranteed 100% chemical-free.",
    price: 1200,
    unit: "10kg Box",
    image: "/himsagar.jpg" // Make sure this matches your exact file name!
  },
  {
    id: 2,
    name: "Rajshahi Langra",
    grade: "Premium Selection",
    description: "Famous for its unique aroma and perfect balance of sweet and slight tang. Hand-sorted for zero internal faults.",
    price: 1100,
    unit: "10kg Box",
    image: "/langra.jpg"
  },
  {
    id: 3,
    name: "Fazli Reserve",
    grade: "Late Season Giant",
    description: "Massive, perfectly ripened Fazli mangoes. We only pick the top 5% of the harvest for this reserve box.",
    price: 900,
    unit: "10kg Box",
    image: "/fazli.jpg"
  }
];

// ... keep the rest of the Shop() function exactly the same

export default function Shop() {
  return (
    <div className="w-full max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
      
      {/* Shop Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-brand-dark mb-4">
          The Premium Collection
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto font-light">
          Tree-bagged, hand-sorted, and guaranteed flawless. Select your box below.
        </p>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {mangoData.map((mango) => (
          <ProductCard key={mango.id} product={mango} />
        ))}
      </div>
      
    </div>
  );
}