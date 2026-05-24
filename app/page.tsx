'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ctnmiwmiymzhsafwxnxw.supabase.co',
  'sb_publishable_y0CVt3s9Psolebnf1SPRaA_TBI32jY7'
);

interface CartItem {
  name: string;
  price: number;
  qty: number;
  sauce: string;
}

export default function NenesBrutalApp() {
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('almighty');
  const [selectedSauce, setSelectedSauce] = useState('Nenes White Sauce & BBQ');

  const menuItems = {
    almighty: [
      { id: 'ALM_1', name: 'Almighty Rib, Footlong Russian and Bacon', price: 100 },
      { id: 'ALM_2', name: 'Almighty Rib, Burger, Egg and Bacon', price: 100 },
      { id: 'ALM_3', name: 'Almighty Rib, Burger, Footlong Russian, Egg and Bacon', price: 123 }
    ],
    kotas: [
      { id: 'KOT_1', name: 'Footlong Russian with Cheese', price: 69 },
      { id: 'KOT_2', name: 'KasiStyle Burger with Egg & Cheese', price: 69 },
      { id: 'KOT_3', name: 'King Rib with Bacon & Cheese', price: 86 },
      { id: 'KOT_4', name: 'King Rib with Footlong Russian & Cheese', price: 92 },
      { id: 'KOT_5', name: 'Chicken Russian with Cheese', price: 63 },
      { id: 'KOT_6', name: 'King Rib with Egg & Cheese', price: 72 },
      { id: 'KOT_7', name: 'Tasty Bacon with Egg & Cheese', price: 67 },
      { id: 'KOT_8', name: 'Egg & Cheese', price: 48 },
      { id: 'KOT_9', name: 'Footlong Russian with Egg & Cheese', price: 74 },
      { id: 'KOT_10', name: 'Chips & Cheese', price: 43 },
      { id: 'KOT_11', name: 'King Rib with Cheese', price: 67 }
    ],
    combos: [
      { id: 'CMB_1', name: 'King Rib w/ Egg & Cheese + Footlong Russian w/ Egg & Cheese', price: 133 },
      { id: 'CMB_2', name: 'King Rib w/ Cheese + Footlong Russian w/ Cheese', price: 123 }
    ],
    dagwoods: [
      { id: 'DAG_1', name: 'Cheese, Rib, Bacon Dagwood', price: 73 },
      { id: 'DAG_1_C', name: 'Cheese, Rib, Bacon Dagwood + Chips', price: 94 },
      { id: 'DAG_2', name: 'Cheese, Burger, Egg Dagwood', price: 56 },
      { id: 'DAG_2_C', name: 'Cheese, Burger, Egg Dagwood + Chips', price: 77 },
      { id: 'DAG_3', name: 'Cheese, Bacon & Egg Dagwood', price: 54 },
      { id: 'DAG_3_C', name: 'Cheese, Bacon & Egg Dagwood + Chips', price: 75 }
    ],
    toast: [
      { id: 'TST_1', name: 'Cheese, Rib & Bacon Toast', price: 47 },
      { id: 'TST_1_C', name: 'Cheese, Rib & Bacon Toast + Chips', price: 68 },
      { id: 'TST_2', name: 'Cheese, Burger & Egg Toast', price: 40 },
      { id: 'TST_2_C', name: 'Cheese, Burger & Egg Toast + Chips', price: 61 },
      { id: 'TST_3', name: 'Cheese, Bacon & Egg Toast', price: 30 },
      { id: 'TST_3_C', name: 'Cheese, Bacon & Egg Toast + Chips', price: 50 }
    ],
    chips: [
      { id: 'CHP_1', name: 'Mini Chips', price: 22 },
      { id: 'CHP_2', name: 'Small Chips', price: 33 },
      { id: 'CHP_3', name: 'Medium Chips', price: 46 },
      { id: 'CHP_4', name: 'Extra Large Chips', price: 70 }
    ],
    drinks: [
      { id: 'DRK_1', name: 'Colddrink', price: 24 },
      { id: 'DRK_2', name: 'Juice 100%', price: 24 },
      { id: 'DRK_3', name: 'Water', price: 17 }
    ]
  };

  const sauces = [
    'Nenes White Sauce & BBQ',
    'Nenes Chilli White Sauce & BBQ',
    'Chip Sauce & Prego'
  ];

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

  const changeQty = (name: string, price: number, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.name === name && item.sauce === selectedSauce);
      if (existing) {
        const nextQty = existing.qty + delta;
        if (nextQty <= 0) return prev.filter((item) => !(item.name === name && item.sauce === selectedSauce));
        return prev.map((item) => item.name === name && item.sauce === selectedSauce ? { ...item, qty: nextQty } : item);
      }
      if (delta > 0) return [...prev, { name, price, qty: 1, sauce: selectedSauce }];
      return prev;
    });
  };

  const getItemQty = (name: string) => {
    return cart.filter((item) => item.name === name).reduce((acc, item) => acc + item.qty, 0);
  };

  const calculateTotal = () => cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  const executeCheckout = async () => {
    if (cart.length === 0) return;
    try {
      const { error } = await supabase.from('orders').insert({
        vendor_id: 'a7c92bdf-df83-4a12-8827-86d037a9cf5b',
        customer_phone: `${customerName} (${phoneNumber})`,
        status: 'incoming',
        items_json: cart
      });

      if (error) throw error;
      alert(`🚀 Order locked in upfront for ${customerName}!`);
      setCart([]);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  if (!isRegistered) {
    return (
      <div className="min-h-screen bg-[#e2b407] flex flex-col justify-center items-center p-4 font-sans">
        <div className="w-full max-w-sm bg-[#b81d24] border-4 border-black rounded-2xl p-6 space-y-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-center space-y-3">
            <h1 className="text-5xl font-black text-white tracking-tighter uppercase drop-shadow-[3px_3px_0px_rgba(0,0,0,1)]">
              NENES<span className="text-[#e2b407]">.</span>
            </h1>
            <div className="inline-block bg-white text-black text-[10px] font-black px-4 py-1.5 border-2 border-black uppercase tracking-wider rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              ⚡ SKIP THE QUEUE // ORDER UPFRONT ⚡
            </div>
          </div>

          <form onSubmit={handleRegistration} className="space-y-4 bg-white p-5 border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-black tracking-wider text-black block">👤 ENTER YOUR NAME FOR THE ORDER:</label>
              <input
                type="text"
                placeholder="e.g., Olwam"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-white border-2 border-black p-3 rounded-lg text-black font-bold outline-none text-sm focus:bg-amber-50"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-black tracking-wider text-black block">📱 PHONE NUMBER:</label>
              <input
                type="tel"
                placeholder="e.g., 0676885554"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-white border-2 border-black p-3 rounded-lg text-black font-bold outline-none text-sm focus:bg-amber-50"
                required
              />
            </div>

            <button type="submit" className="w-full bg-[#e2b407] text-black border-2 border-black font-black text-xs uppercase tracking-widest py-4 rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all">
              OPEN KASI MENU
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e2b407] font-sans max-w-md mx-auto flex flex-col justify-between pb-32 border-x-4 border-black shadow-2xl relative">
      <header className="p-4 bg-[#b81d24] border-b-4 border-black text-center sticky top-0 z-50">
        <h1 className="text-4xl font-black uppercase text-white tracking-tighter drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          NENES<span className="text-[#e2b407]">.</span>
        </h1>
        <p className="text-[9px] text-white/90 uppercase font-black tracking-wider mt-1">Profile: {customerName}</p>
        <button 
          onClick={() => { localStorage.clear(); setIsRegistered(false); }} 
          className="absolute right-3 top-4 bg-white text-black border-2 border-black font-black text-[9px] px-2 py-1 rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        >
          RESET
        </button>
      </header>

      {/* SAUCE SELECTOR BAR */}
      <div className="p-4 bg-white border-b-4 border-black sticky top-[97px] z-40">
        <label className="text-[10px] uppercase font-black tracking-wider text-black block mb-1.5">🌶️ SELECT KITCHEN SAUCE BASE:</label>
        <select 
          value={selectedSauce} 
          onChange={(e) => setSelectedSauce(e.target.value)}
          className="w-full bg-white border-2 border-black text-black font-bold p-3 rounded-lg text-xs outline-none"
        >
          {sauces.map((sauce) => <option key={sauce} value={sauce}>{sauce}</option>)}
        </select>
      </div>

      {/* HORIZONTAL CATEGORY SLIDER */}
      <div className="flex gap-2 p-4 overflow-x-auto no-scrollbar bg-[#e2b407] border-b-2 border-black sticky top-[175px] z-30">
        {[
          { id: 'almighty', label: '⚡ Almighty' },
          { id: 'kotas', label: '🍔 Kotas' },
          { id: 'combos', label: '🤝 Combos' },
          { id: 'dagwoods', label: '🥪 Dagwoods' },
          { id: 'toast', label: '🍞 Toast' },
          { id: 'chips', label: '🍟 Chips' },
          { id: 'drinks', label: '🥤 Drinks' }
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 border-2 border-black rounded-lg font-black text-xs uppercase tracking-wider whitespace-nowrap shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${
              activeCategory === cat.id 
                ? 'bg-[#b81d24] text-white translate-x-0.5 translate-y-0.5 shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]' 
                : 'bg-white text-black'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* MENU STREAM */}
      <main className="flex-1 p-4 space-y-4 overflow-y-auto">
        {menuItems[activeCategory as keyof typeof menuItems].map((item) => {
          const qty = getItemQty(item.name);
          return (
            <div key={item.id} className="bg-white border-4 border-black p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center gap-4">
              <div className="space-y-1 flex-1">
                <h3 className="font-black text-sm text-black leading-tight">{item.name}</h3>
                <p className="text-[#b81d24] font-black text-base">R {item.price}</p>
              </div>
              
              <div className="flex items-center border-2 border-black rounded-lg bg-black text-white font-black overflow-hidden shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <button onClick={() => changeQty(item.name, item.price, -1)} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-base active:bg-zinc-700 select-none">-</button>
                <span className="px-3 py-1.5 bg-black min-w-[28px] text-center text-xs">{qty}</span>
                <button onClick={() => changeQty(item.name, item.price, 1)} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-base text-[#e2b407] active:bg-zinc-700 select-none">+</button>
              </div>
            </div>
          );
        })}
      </main>

      {/* FLOATING BASKET DRAWER OVERLAY */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white p-4 border-t-4 border-black rounded-t-2xl shadow-[0px_-4px_10px_rgba(0,0,0,0.15)] space-y-3 z-50">
          <div className="flex justify-between items-center px-1">
            <span className="text-black font-black uppercase text-xs tracking-wider">🛒 YOUR SELECTIONS TOTAL:</span>
            <span className="text-[#b81d24] font-black text-xl">R {calculateTotal()}</span>
          </div>
          <button 
            onClick={executeCheckout} 
            className="w-full bg-[#b81d24] text-white border-2 border-black font-black p-4 rounded-xl text-xs uppercase tracking-widest text-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            CONFIRM ORDER UPFRONT 🚀
          </button>
        </div>
      )}
    </div>
  );
}