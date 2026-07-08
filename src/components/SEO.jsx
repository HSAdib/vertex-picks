import { Helmet } from 'react-helmet-async';
import { useStore } from '../context/useStore';

export default function SEO({ title, description, keywords, image }) {
  const { storeName } = useStore();
  const defaultTitle = `${storeName} | Premium Rajshahi Mangoes`;
  const finalTitle = title ? `${title} | ${storeName}` : defaultTitle;
  const finalDescription = description || "Hand-picked, tree-bagged, and delivered flawlessly. Premium Rajshahi mangoes, direct from farm to your door.";
  
  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      
      {/* Open Graph tags for social media previews */}
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:type" content="website" />
      {image && <meta property="og:image" content={image} />}
      
      {/* Twitter tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      {image && <meta name="twitter:image" content={image} />}
    </Helmet>
  );
}
