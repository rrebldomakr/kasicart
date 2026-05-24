'use client';

import { useState } from 'react';
import { supabase } from './utils/supabase';

const NENES_MENU = [
  {
    category: "Almighty Kota's",
    items: [
      { id: 'ak1', name: 'Almighty Burger with Rib and Bacon', price: 77, desc: 'Premium layers with signature sauce' },
      { id: 'ak2', name: 'Almighty Burger with Rib and Footlong Russian', price: 79, desc: 'Massive local favorite stack' },
      { id: 'ak3', name: 'Almighty Burger with Rib, Bacon and Footlong Russian', price: 93, desc: 'The ultimate loaded hunger buster' },
    ]
  },
  {
    category: "King Kota's",
    items: [
      { id: 'kk1', name: 'King Rib', price: 51, desc: 'Saucy rib patty inside a fresh loaf' },
      { id: 'kk2', name: 'King Rib with Egg', price: 55, desc: 'Classic rib with a perfectly fried egg' },
      { id: 'kk3', name: 'King Rib with Footlong', price: 69, desc: 'Rib patty paired with a footlong russian' },
    ]
  },
  {
    category: "Drinks",
    items: [
      { id: 'd1', name: 'Coca Cola', price: 18, desc: '330ml cold can' },
      { id: 'd2', name: 'Fanta Orange', price: 18, desc: '330ml cold can' },
    ]
  }
];

export default function NenesPortal() {
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [customerName, setCustomerName] = useState('');

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      const currentQty = prev[id] || 0;
      const newQty = Math.max(0, currentQty + delta);
      return { ...prev, [id]: newQty };
    });
  };

  const totalPrice = NENES_MENU.reduce((sum, cat) => {
    return sum + cat.items.reduce((catSum, item) => {
      const qty = cart[item.id] || 0;
      return catSum + item.price * qty;
    }, 0);
  }, 0);

  const handleCheckout = async () => {
    if (!customerName.trim()) {
      alert('Please enter your name so the kitchen can call you when it is ready!');
      return;
    }

    setLoading(true);

    const orderItems: any[] = [];
    NENES_MENU.forEach(cat => {
      cat.items.forEach(item => {
        if (cart[item.id] > 0) {
          orderItems.push({ name: item.name, qty: cart[item.id], price: item.price });
        }
      });
    });

    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('slug', 'nenes')
      .single();

    if (!vendor) {
      alert('Vendor setup configuration missing.');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('orders')
      .insert([
        {
          vendor_id: vendor.id,
          customer_phone: customerName, 
          items_json: orderItems,
          total_amount: totalPrice,
          payment_verified: true 
        }
      ]);

    setLoading(false);

    if (error) {
      alert(`Database error: ${error.message}`);
    } else {
      const { data: rawOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_phone', customerName)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (rawOrder) {
        window.location.href = `/track?id=${rawOrder.id}`;
      } else {
        setOrderComplete(true);
      }
      setCart({});
    }
  }; // Fixed missing closing bracket here

  if (orderComplete) {
    return (
      <div style={{ backgroundColor: '#F2C12E', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ backgroundColor: '#FFF', border: '3px solid #111', borderRadius: '8px', padding: '30px', boxShadow: '4px 4px 0px #111', maxWidth: '400px' }}>
          <h2 style={{ color: '#A61C1C', fontSize: '28px', fontWeight: '900', marginBottom: '10px' }}>🔥 ORDER SENT!</h2>
          <p style={{ color: '#111', fontWeight: 'bold' }}>Thanks, {customerName}!</p>
          <p style={{ color: '#555', fontSize: '14px', marginTop: '10px' }}>Keep an eye on the screen. The team will call out your name when your order is hot and ready.</p>
          <button onClick={() => { setOrderComplete(false); setCustomerName(''); }} style={{ marginTop: '20px', backgroundColor: '#111', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            ORDER SOMETHING ELSE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#F2C12E', minHeight: '100vh', color: '#111', fontFamily: 'sans-serif', padding: '0 0 ' + (totalPrice > 0 ? '180px' : '40px') + ' 0' }}>
      <div style={{ backgroundColor: '#A61C1C', padding: '30px 20px', textAlign: 'center', borderBottom: '6px solid #111' }}>
        <h1 style={{ color: '#FFF', fontSize: '38px', fontWeight: '900', margin: 0, textTransform: 'uppercase' }}>nenes.</h1>
        <div style={{ backgroundColor: '#FFF', color: '#A61C1C', display: 'inline-block', padding: '3px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '12px', marginTop: '10px' }}>
          ⚡ SKIP THE QUEUE // ORDER UPFRONT ⚡
        </div>
      </div>

      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ backgroundColor: '#FFF', border: '3px solid #111', borderRadius: '8px', padding: '15px', marginBottom: '25px', boxShadow: '4px 4px 0px #111' }}>
          <label style={{ display: 'block', fontWeight: '900', fontSize: '13px', marginBottom: '6px' }}>👤 ENTER YOUR NAME FOR THE ORDER:</label>
          <input 
            type="text" 
            placeholder="e.g., Olwam" 
            value={customerName} 
            onChange={(e) => setCustomerName(e.target.value)}
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '2px solid #111', fontWeight: 'bold' }}
          />
        </div>

        {NENES_MENU.map((cat) => (
          <div key={cat.category} style={{ marginBottom: '30px' }}>
            <h2 style={{ backgroundColor: '#A61C1C', color: '#FFF', padding: '6px 12px', fontSize: '16px', fontWeight: 'bold', display: 'inline-block', marginBottom: '15px', border: '2px solid #111', boxShadow: '2px 2px 0px #111' }}>
              {cat.category.toUpperCase()}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {cat.items.map((item) => {
                const qty = cart[item.id] || 0;
                return (
                  <div key={item.id} style={{ backgroundColor: '#FFF', border: '3px solid #111', borderRadius: '8px', padding: '15px', boxShadow: '4px 4px 0px #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, paddingRight: '15px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '800' }}>{item.name}</h3>
                      <span style={{ color: '#A61C1C', fontWeight: '900', display: 'block', marginTop: '4px' }}>R {item.price}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#111', borderRadius: '6px', padding: '4px' }}>
                      <button onClick={() => updateQuantity(item.id, -1)} style={{ backgroundColor: '#111', color: '#FFF', border: 'none', width: '30px', height: '30px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>-</button>
                      <span style={{ color: '#FFF', fontSize: '13px', fontWeight: 'bold', minWidth: '24px', textAlign: 'center' }}>{qty}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} style={{ backgroundColor: '#111', color: '#F2C12E', border: 'none', width: '30px', height: '30px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {totalPrice > 0 && (
        <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#111', borderTop: '4px solid #A61C1C', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 }}>
          <div>
            <span style={{ color: '#F2C12E', fontSize: '11px', fontWeight: 'bold', display: 'block' }}>TOTAL ORDER DUE</span>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#FFF' }}>R {totalPrice}</span>
          </div>
          <button 
            onClick={handleCheckout}
            disabled={loading}
            style={{ backgroundColor: loading ? '#555' : '#A61C1C', color: '#FFF', border: '2px solid #FFF', padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: '900', cursor: 'pointer' }}
          >
            {loading ? 'SENDING ORDER...' : 'PLACE ORDER & PAY'}
          </button>
        </footer>
      )}
    </div>
  );
}