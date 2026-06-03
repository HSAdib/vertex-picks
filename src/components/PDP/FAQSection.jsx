import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null);
  const [askName, setAskName] = useState('');
  const [askQuestion, setAskQuestion] = useState('');
  
  const [faqItems, setFaqItems] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);

  useEffect(() => {
    const fetchFAQs = async () => {
      try {
        const q = query(collection(db, 'faqs'), orderBy('order', 'asc'));
        const querySnapshot = await getDocs(q);
        const fetchedFaqs = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFaqItems(fetchedFaqs);
      } catch (error) {
        console.error("Error fetching FAQs:", error);
      } finally {
        setLoadingFaqs(false);
      }
    };
    
    fetchFAQs();
  }, []);

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const submitQuestion = () => {
    if (askName.trim() && askQuestion.trim()) {
      alert('Question submitted! We will reply within 2 hours.');
      setAskName('');
      setAskQuestion('');
    } else {
      alert('Please fill out both your name and question.');
    }
  };

  return (
    <div className="faq-layout">
      <div className="faq-list">
        {loadingFaqs ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="faq-item" style={{ pointerEvents: 'none', opacity: 0.7 }}>
              <div className="faq-question">
                <div style={{ width: '60%', height: 16, background: 'var(--gray2)', borderRadius: 4, animation: 'pulse 1.5s infinite' }}></div>
              </div>
            </div>
          ))
        ) : faqItems.length === 0 ? (
          <div className="faq-item">
            <div className="faq-question" style={{ color: 'var(--gray4)' }}>No FAQs available at the moment.</div>
          </div>
        ) : (
          faqItems.map((item, index) => (
            <div
              key={index}
              className={`faq-item ${openIndex === index ? 'open' : ''}`}
              onClick={() => toggleFaq(index)}
            >
              <div className="faq-question">
                {item.question} <span className="faq-chevron">▼</span>
              </div>
              <div className="faq-answer">
                <div
                  className="faq-answer-inner"
                  dangerouslySetInnerHTML={{ __html: item.answer }}
                />
              </div>
            </div>
          ))
        )}
      </div>
      <div className="ask-owner-card">
        <div className="ao-title">Ask the Farmer 🧑‍🌾</div>
        <div className="ao-sub">Have a specific question? Our team replies within 2 hours during season.</div>
        <div className="ao-owner-row">
          <div className="ao-owner-ava">🧑‍🌾</div>
          <div>
            <div className="ao-owner-name">Abdul Karim</div>
            <div className="ao-owner-resp">Avg. response: 1.5 hours</div>
          </div>
        </div>
        <input
          type="text"
          className="ao-input"
          placeholder="Your name"
          id="ao-name"
          value={askName}
          onChange={(e) => setAskName(e.target.value)}
        />
        <textarea
          className="ao-input ao-textarea"
          placeholder="Type your question..."
          id="ao-question"
          value={askQuestion}
          onChange={(e) => setAskQuestion(e.target.value)}
        ></textarea>
        <button className="ao-submit" onClick={submitQuestion}>Send Question →</button>
        <div className="ao-prev-q">
          <div className="ao-prev-title">Recent Q&As</div>
          <div className="ao-q-item">
            <div className="ao-q-text">Is the Himsagar available year-round?</div>
            <div className="ao-a-text">Himsagar is a seasonal mango available June–July only. Pre-order is open from May.</div>
          </div>
          <div className="ao-q-item">
            <div className="ao-q-text">Can I visit the farm?</div>
            <div className="ao-a-text">Yes! Farm visits are welcome during season. Contact us to schedule.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
