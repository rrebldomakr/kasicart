'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ctnmiwmiymzhsafwxnxw.supabase.co',
  'sb_publishable_y0CVt3s9Psolebnf1SPRaA_TBI32jY7' // Safe public anon token
);

interface CartItem {
  name: string;
  price: number;
  qty: number;
}

export default function MobileOrderApp() {
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('almighty');

  const menuItems = {
    almighty: [
      { id: 'ITEM_SPECIAL', name: 'Almighty Special', price: 65.00 },
      { id: 'ITEM_FULLHOUSE', name: 'Full House Almighty', price: 85.00 }
    ],
    king: [
      { id: 'ITEM_KINGRIB', name: 'King Rib Kota', price: 55.00 },
      { id: 'ITEM_SOWETOBOSS', name: 'The Soweto Boss', price: 75.00 }
    ],
    drinks: [
      { id: 'ITEM_COKE', name: 'Coca-Cola Can', price: 18.00 },
      { id: 'ITEM_STONEY', name: 'Stoney Ginger Beer', price: 18.00 }
    ]
  };

  // Hydrate user metadata locally on viewport boot
  useEffect(() => {
    const savedName = localStorage.getItem('kasicart_name');
    const savedPhone = localStorage.getItem('kasicart_phone');
    if (savedName && savedPhone) {
      setCustomerName(savedName);
      setPhoneNumber(savedPhone);
      setIsRegistered(true);
    }
  }, []);

  const handleRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phoneNumber) return;
    localStorage.setItem('kasicart_name', customerName);
    localStorage.setItem('kasicart_phone', phoneNumber);
    setIsRegistered(true);
  };

  const addToCart = (name: string, price: number) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.name === name);
      if (existing) {
        return prevCart.map((item) =>
          item.name === name ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prevCart, { name, price, qty: 1 }];
    });
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.qty, 0);
  };

  const executeCheckout = async () => {
    if (cart.length === 0) return;

    try {
      // Direct stream to 'orders' table. Chefs monitor board will update via Postgres Realtime loops.
      const { error } = await supabase.from('orders').insert({
        vendor_id: 'a7c92bdf-df83-4a12-8827-86d037a9cf5b', // Replace with your true explicit vendor UUID
        customer_phone: `${customerName} (${phoneNumber})`,
        status: 'incoming',
        items_json: cart
      });

      if (error) throw error;

      alert(`🚀 Order filed successfully for ${customerName}! Head to the counter when notified.`);
      setCart([]);
    } catch (err: any) {
      console.error('Checkout error:', err.message);
    }
  };

  if (!isRegistered) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center p-6 font-sans">
        <div className="w-full max-w-sm space-y-6">
          <h1 className="text-3xl font-extrabold tracking-tight">🇿🇦 KasiCart</h1>
          <p className="text-zinc-400 text-sm">Enter details to unlock Nenes Street Kitchen interactive menu panel.</p>
          <form onSubmit={handleRegistration} className="space-y-4">
            <input
              type="text"
              placeholder="Your Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-orange-500"
              required
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-orange-500"
              required
            />
            <button type="submit" className="w-full bg-orange-600 font-bold p-4 rounded-xl hover:bg-orange-700 transition">
              View Menu
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans max-w-md mx-auto flex flex-col justify-between pb-24">
      {/* Header Container Layout */}
      <header className="p-6 border-b border-zinc-900 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Nenes Street Kitchen</h2>
          <p className="text-xs text-zinc-500">Welcome back, {customerName}</p>
        </div>
        <button 
          onClick={() => { localStorage.clear(); setIsRegistered(false); }} 
          className="text-xs text-zinc-500 underline"
        >
          Reset Profile
        </button>
      </header>

      {/* Category Tab Segment Filters */}
      <div className="grid grid-cols-3 gap-2 p-4">
        {['almighty', 'king', 'drinks'].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`p-3 rounded-xl font-bold capitalize text-sm transition ${
              activeCategory === cat ? 'bg-orange-600 text-white' : 'bg-zinc-900 text-zinc-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Dynamic Item Card Stream layout */}
      <main className="flex-1 p-4 space-y-3 overflow-y-auto">
        {menuItems[activeCategory as keyof typeof menuItems].map((item) => (
          <div key={item.id} className="bg-zinc-900 p-4 rounded-2xl flex justify-between items-center border border-zinc-900">
            <div>
              <h3 className="font-bold text-base">{item.name}</h3>
              <p className="text-orange-500 font-semibold text-sm">R {item.price.toFixed(2)}</p>
            </div>
            <button
              onClick={() => addToCart(item.name, item.price)}
              className="bg-zinc-800 text-white font-extrabold w-10 h-10 rounded-xl flex items-center justify-center hover:bg-zinc-700 transition"
            >
              +
            </button>
          </div>
        ))}
      </main>

      {/* Bottom Cart Drawer Layout Component Overlay */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 p-4 border-t border-zinc-800 rounded-t-3xl shadow-2xl space-y-4">
          <div className="flex justify-between items-center text-sm px-2 text-zinc-400">
            <span>Items in cart: {cart.reduce((a, b) => a + b.qty, 0)}</span>
            <span className="text-white font-bold text-base">Total: R {calculateTotal().toFixed(2)}</span>
          </div>
          <button
            onClick={executeCheckout}
            className="w-full bg-orange-600 text-white font-extrabold p-4 rounded-2xl text-center shadow-lg hover:bg-orange-700 transition"
          >
            Checkout Now 🛒
          </button>
        </div>
      )}
    </div>
  );
}