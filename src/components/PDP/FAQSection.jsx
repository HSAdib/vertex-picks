import React, { useState } from 'react';

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null);
  const [askName, setAskName] = useState('');
  const [askQuestion, setAskQuestion] = useState('');

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

  const faqItems = [
    {
      question: 'Are the mangoes really chemical-free?',
      answer: 'Yes, absolutely. Our mangoes are <strong>tree-bagged from an early stage</strong> of growth to prevent any pest exposure. No pesticides are applied. No artificial ripening agents (like calcium carbide) are ever used. The fruit ripens naturally on the tree.'
    },
    {
      question: 'How fresh will the mangoes be when they arrive?',
      answer: 'Mangoes are picked at <strong>dawn on the day of dispatch</strong>. Orders placed before 12pm are shipped same-day. You can expect your mangoes to arrive within 24 hours of picking for Dhaka, or 1–2 days for other cities. No cold storage is used.'
    },
    {
      question: 'What if my mangoes arrive damaged or unsatisfactory?',
      answer: 'We offer a <strong>100% refund guarantee</strong>. If you\'re not happy with your mangoes for any reason — damage, quality, taste — just contact us within 24 hours of delivery with a photo. We\'ll issue a full refund or resend, no questions asked.'
    },
    {
      question: 'Can I order for gifting? Is there special packaging?',
      answer: 'Yes! We have dedicated <strong>Gift Box options</strong> with premium eco-friendly packaging, a personalised card slot, and a curated mix of varieties. Perfect for Eid, weddings, and corporate gifting. Check our Gift Box collection in the Shop.'
    },
    {
      question: 'Do you deliver outside Dhaka?',
      answer: 'Yes! We deliver to <strong>Dhaka, Chattogram, Sylhet, Rajshahi, and surrounding areas</strong>. Delivery fees and timelines vary by location. Dhaka Metro: ৳60, same day. Chattogram & Sylhet: ৳120–150, 1–2 days. Rajshahi local: free pickup available.'
    },
    {
      question: 'How long do the mangoes last?',
      answer: 'At room temperature, our mangoes last <strong>5–7 days</strong> after delivery. In a cool, shaded space they can last up to 10 days. Do not refrigerate unripe mangoes — it stops the ripening process. Once fully ripe, you can refrigerate for 2–3 more days.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept <strong>bKash, Nagad, Rocket, all major cards</strong> (Visa, Mastercard), and cash on delivery for select Dhaka areas. Online payment gets a 2% discount automatically applied at checkout.'
    }
  ];

  return (
    <div className="faq-layout">
      <div className="faq-list">
        {faqItems.map((item, index) => (
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
        ))}
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
