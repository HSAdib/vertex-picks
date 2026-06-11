import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useWishlist } from '../../hooks/useWishlist';
import { Heart } from 'lucide-react';

export default function ProductGallery({ product }) {
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [activeImageIndex, setActiveImageIndex] = useState(0);


  const thumbs = product.images || [];

  return (
    <div className="pdp-gallery">
      <div className="pdp-main-img" id="pdp-main-img">
        {thumbs.length > 0 ? (
          <img 
            src={thumbs[activeImageIndex] || thumbs[0]} 
            alt="Product Main" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray1)', color: 'var(--gray4)', fontSize: '1rem', fontWeight: 600 }}>
            No Image Available
          </div>
        )}
        <div className="pdp-badge-overlay" id="pdp-badge-overlay">
          {product.badge && (
            <span
              className={`badge badge-${
                product.badge === 'Best Seller'
                  ? 'orange'
                  : product.badge === 'Rare' || product.badge === 'Gift'
                  ? 'gold'
                  : 'green'
              }`}
            >
              {product.badge}
            </span>
          )}
        </div>
      </div>

      {thumbs.length > 1 && (
        <div className="pdp-thumbnails" id="pdp-thumbnails">
          {thumbs.map((thumb, i) => (
            <div
              key={i}
              className={`pdp-thumb ${activeImageIndex === i ? 'active' : ''}`}
              onClick={() => setActiveImageIndex(i)}
              style={{ padding: 0, overflow: 'hidden' }}
            >
              <img 
                src={thumb} 
                alt={`Thumbnail ${i}`} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            </div>
          ))}
        </div>
      )}

      <div className="pdp-share-row">
        <span className="pdp-share-label">Share:</span>
        <button 
          className="pdp-share-btn" 
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast.success('Link copied! 🔗');
          }}
          title="Copy Link"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </button>
        <button 
          className="pdp-share-btn" 
          onClick={() => {
            // Fix #9: don't toast here — we can't detect when/if the user completes sharing
            window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.href), '_blank');
          }}
          title="Share on Facebook"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </button>
        <button 
          className="pdp-share-btn" 
          onClick={() => {
            // Fix #9: same — can't confirm WhatsApp share completion
            window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(window.location.href), '_blank');
          }}
          title="Share on WhatsApp"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#25D366">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
          </svg>
        </button>
        <button
          style={{ 
            marginLeft: 'auto',
            background: 'var(--gray1)', border: 'none', cursor: 'pointer',
            fontSize: '1.2rem', color: isInWishlist(product.id) ? 'var(--primary)' : 'var(--gray4)',
            width: '32px', height: '32px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onClick={() => toggleWishlist(product)}
          title={isInWishlist(product.id) ? "Remove from Wishlist" : "Add to Wishlist"}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
          onMouseLeave={e => e.currentTarget.style.color = isInWishlist(product.id) ? 'var(--primary)' : 'var(--gray4)'}
        >
          <Heart size={20} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}
