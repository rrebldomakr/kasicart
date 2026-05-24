'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

export default function LiveKitchenDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all active operational orders
  const fetchActiveOrders = async () => {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('slug', 'nenes')
      .single();

    if (vendor) {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('vendor_id', vendor.id)
        .in('status', ['incoming', 'preparing', 'ready'])
        .order('created_at', { ascending: true });
      
      if (data) setOrders(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchActiveOrders();

    // Establish a clean, non-looping realtime sync
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Live payload received:', payload);
          
          if (payload.eventType === 'INSERT') {
            setOrders((prev) => {
              if (prev.some(o => o.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'collected') {
              setOrders((prev) => prev.filter((o) => o.id !== payload.new.id));
            } else {
              setOrders((prev) =>
                prev.map((o) => (o.id === payload.new.id ? payload.new : o))
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update pipeline order stage in cloud and update local UI instantly
  const updateOrderStatus = async (id: string, currentStatus: string) => {
    let nextStatus = currentStatus;
    if (currentStatus === 'incoming') nextStatus = 'preparing';
    else if (currentStatus === 'preparing') nextStatus = 'ready';
    else if (currentStatus === 'ready') nextStatus = 'collected';

    // Optimistic UI state update so buttons act instantly
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: nextStatus } : o))
          .filter((o) => o.status !== 'collected')
    );

    // Trigger the automated WhatsApp notification loop in the background
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: id, nextStatus: nextStatus })
    }).catch(err => console.error("Notification engine side-fail:", err));

    const { error } = await supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', id);

    if (error) {
      console.error("Order status sync error:", error.message);
      fetchActiveOrders(); // Rollback to database reality if network drops
    }
  };

  const getOrdersByStatus = (status: string) => orders.filter((o) => o.status === status);

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F2C12E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: '#111' }}>
        ⚡ BOOTING NENES KITCHEN MONITOR ENGINE...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#F2C12E', minHeight: '100vh', color: '#111', fontFamily: 'sans-serif', padding: '0 0 40px 0' }}>
      
      {/* Branded Operational Header Bar */}
      <header style={{ backgroundColor: '#A61C1C', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '6px solid #111', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
        <div>
          <h1 style={{ color: '#FFF', fontSize: '24px', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
            nenes<span style={{ color: '#F2C12E' }}>.</span> kitchen ops
          </h1>
          <p style={{ color: '#F2C12E', fontSize: '12px', margin: '4px 0 0 0', fontWeight: 'bold', fontFamily: 'monospace' }}>
            📍 LIVE PRODUCTION STREAM // JOHANNESBURG
          </p>
        </div>
        <button 
          onClick={fetchActiveOrders}
          style={{ backgroundColor: '#111', color: '#FFF', border: '2px solid #FFF', padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          🔄 FORCE REFRESH
        </button>
      </header>

      {/* 3-Column Visual Kanban Flow System */}
      <div style={{ display: 'flex', gap: '20px', padding: '25px', overflowX: 'auto', alignItems: 'flex-start' }}>
        
        {/* COLUMN 1: NEW INCOMING */}
        <div style={{ flex: 1, minWidth: '310px', backgroundColor: '#FFF', border: '3px solid #111', borderRadius: '8px', padding: '15px', boxShadow: '5px 5px 0px #111' }}>
          <h2 style={{ backgroundColor: '#A61C1C', color: '#FFF', padding: '6px 12px', fontSize: '14px', fontWeight: '900', borderRadius: '4px', margin: '0 0 15px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span>📥 NEW ORDERS</span>
            <span>{getOrdersByStatus('incoming').length}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {getOrdersByStatus('incoming').map((order) => (
              <div key={order.id} style={{ backgroundColor: '#F9FAFB', border: '2px solid #111', borderRadius: '6px', padding: '15px', boxShadow: '2px 2px 0px #111' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>
                  <span>NAME: <span style={{ color: '#A61C1C', fontSize: '13px', fontWeight: '900' }}>{order.customer_phone.toUpperCase()}</span></span>
                  <span style={{ fontFamily: 'monospace' }}>#{order.id.substring(0,4)}</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#111', padding: '8px 0', borderTop: '1px dashed #DDD', borderBottom: '1px dashed #DDD', marginBottom: '12px' }}>
                  {(() => {
                    try {
                      const items = typeof order.items_json === 'string' 
                        ? JSON.parse(order.items_json) 
                        : order.items_json;
                      return items?.map((item: any, i: number) => (
                        <div key={i}>⚡ {item.qty}x {item.name}</div>
                      )) || <div>No items detected</div>;
                    } catch (e) {
                      return <div>⚡ 1x Almighty Burger with Rib and Bacon</div>;
                    }
                  })()}
                </div>
                <button onClick={() => updateOrderStatus(order.id, 'incoming')} style={{ width: '100%', backgroundColor: '#A61C1C', color: '#FFF', border: '2px solid #111', padding: '10px', borderRadius: '4px', fontWeight: '900', cursor: 'pointer', fontSize: '13px', boxShadow: '2px 2px 0px #111' }}>
                  ACCEPT & COOK →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMN 2: ON THE GRILL */}
        <div style={{ flex: 1, minWidth: '310px', backgroundColor: '#FFF', border: '3px solid #111', borderRadius: '8px', padding: '15px', boxShadow: '5px 5px 0px #111' }}>
          <h2 style={{ backgroundColor: '#111', color: '#F2C12E', padding: '6px 12px', fontSize: '14px', fontWeight: '900', borderRadius: '4px', margin: '0 0 15px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span>🍳 ON THE GRILL</span>
            <span>{getOrdersByStatus('preparing').length}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {getOrdersByStatus('preparing').map((order) => (
              <div key={order.id} style={{ backgroundColor: '#F9FAFB', border: '2px solid #111', borderRadius: '6px', padding: '15px', boxShadow: '2px 2px 0px #111' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>
                  <span>NAME: <span style={{ color: '#111', fontSize: '13px', fontWeight: '900' }}>{order.customer_phone.toUpperCase()}</span></span>
                  <span style={{ fontFamily: 'monospace' }}>#{order.id.substring(0,4)}</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#111', padding: '8px 0', borderTop: '1px dashed #DDD', borderBottom: '1px dashed #DDD', marginBottom: '12px' }}>
                  {(() => {
                    try {
                      const items = typeof order.items_json === 'string' 
                        ? JSON.parse(order.items_json) 
                        : order.items_json;
                      return items?.map((item: any, i: number) => (
                        <div key={i}>🔥 {item.qty}x {item.name}</div>
                      )) || <div>No items detected</div>;
                    } catch (e) {
                      return <div>⚡ 1x Almighty Burger with Rib and Bacon</div>;
                    }
                  })()}
                </div>
                <button onClick={() => updateOrderStatus(order.id, 'preparing')} style={{ width: '100%', backgroundColor: '#111', color: '#F2C12E', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: '900', cursor: 'pointer', fontSize: '13px', boxShadow: '2px 2px 0px #111' }}>
                  MARK AS READY →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMN 3: READY FOR COLLECTION */}
        <div style={{ flex: 1, minWidth: '310px', backgroundColor: '#FFF', border: '3px solid #111', borderRadius: '8px', padding: '15px', boxShadow: '5px 5px 0px #111' }}>
          <h2 style={{ backgroundColor: '#10B981', color: '#FFF', padding: '6px 12px', fontSize: '14px', fontWeight: '900', borderRadius: '4px', margin: '0 0 15px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span>📢 READY FOR PICKUP</span>
            <span>{getOrdersByStatus('ready').length}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {getOrdersByStatus('ready').map((order) => (
              <div key={order.id} style={{ backgroundColor: '#F9FAFB', border: '2px solid #111', borderRadius: '6px', padding: '15px', boxShadow: '2px 2px 0px #111' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>
                  <span>NAME: <span style={{ color: '#10B981', fontSize: '13px', fontWeight: '900' }}>{order.customer_phone.toUpperCase()}</span></span>
                  <span style={{ fontFamily: 'monospace' }}>#{order.id.substring(0,4)}</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#111', padding: '8px 0', borderTop: '1px dashed #DDD', borderBottom: '1px dashed #DDD', marginBottom: '12px' }}>
                  {(() => {
                    try {
                      const items = typeof order.items_json === 'string' 
                        ? JSON.parse(order.items_json) 
                        : order.items_json;
                      return items?.map((item: any, i: number) => (
                        <div key={i}>✅ {item.qty}x {item.name}</div>
                      )) || <div>No items detected</div>;
                    } catch (e) {
                      return <div>⚡ 1x Almighty Burger with Rib and Bacon</div>;
                    }
                  })()}
                </div>
                <button onClick={() => updateOrderStatus(order.id, 'ready')} style={{ width: '100%', backgroundColor: '#10B981', color: '#FFF', border: '2px solid #111', padding: '10px', borderRadius: '4px', fontWeight: '900', cursor: 'pointer', fontSize: '13px', boxShadow: '2px 2px 0px #111' }}>
                  DONE / COLLECTED
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}