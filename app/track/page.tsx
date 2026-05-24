'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../utils/supabase';

function TrackerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('id');

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    // 1. Fetch initial order status from cloud database
    const fetchOrder = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      if (data) setOrder(data);
      setLoading(false);
    };

    fetchOrder();

    // 2. Listen for real-time status updates from the kitchen dashboard
    const channel = supabase
      .channel(`order-track-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          setOrder(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F2C12E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>
        ⚡ SECURING SATELLITE CONNECTION TO NENES GRILL...
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ backgroundColor: '#F2C12E', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
        <h3>No active order token found.</h3>
        <button onClick={() => router.push('/')} style={{ marginTop: '15px', backgroundColor: '#111', color: '#FFF', padding: '10px 20px', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
          Go to Menu
        </button>
      </div>
    );
  }

  // Determine current stage index based on Supabase order status status
  const statuses = ['incoming', 'preparing', 'ready', 'collected'];
  const currentStageIndex = statuses.indexOf(order.status);

  return (
    <div style={{ backgroundColor: '#F2C12E', minHeight: '100vh', color: '#111', fontFamily: 'sans-serif', padding: '30px 20px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#FFF', border: '3px solid #111', borderRadius: '12px', padding: '25px', boxShadow: '6px 6px 0px #111' }}>
        
        {/* Header Status Text */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#A61C1C', letterSpacing: '1px', display: 'block', marginBottom: '5px' }}>
            ORDER DECK // #{order.id.substring(0, 6).toUpperCase()}
          </span>
          <h2 style={{ fontSize: '24px', fontWeight: '900', margin: 0, textTransform: 'uppercase' }}>
            Hey, {order.customer_phone}!
          </h2>
          <p style={{ color: '#555', fontSize: '14px', marginTop: '5px' }}>
            {order.status === 'incoming' && "📥 Order placed! Waiting for the grill team to accept."}
            {order.status === 'preparing' && "🔥 Your Kota is currently on the grill sizzle lines!"}
            {order.status === 'ready' && "📦 Order wrapped! Head to the counter to collect."}
          </p>
        </div>

        {/* Dynamic State Machine Animations & Graphics */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px', height: '100px', alignItems: 'center' }}>
          {order.status === 'incoming' && (
            <div style={{ fontSize: '50px', animation: 'bounce 1s infinite alternate' }}>📥</div>
          )}
          {order.status === 'preparing' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '50px', animation: 'spin 2s linear infinite' }}>🍳</div>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#A61C1C', display: 'block', marginTop: '5px', fontFamily: 'monospace' }}>FRIER ACTIVE</span>
            </div>
          )}
          {order.status === 'ready' && (
            <div style={{ fontSize: '60px', animation: 'pulse 1s infinite' }}>🛍️</div>
          )}
        </div>

        {/* Visual Progress Pipelines */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 10px' }}>
          
          {/* Node 1: Received */}
          <div style={{ zIndex: 2, textAlign: 'center' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: currentStageIndex >= 0 ? '#A61C1C' : '#DDD', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: '2px solid #111' }}>
              ✓
            </div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginTop: '6px' }}>Sent</span>
          </div>

          {/* Connection Pipe 1 */}
          <div style={{ flex: 1, height: '6px', backgroundColor: '#DDD', margin: '0 -5px', position: 'relative', top: '-8px', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              backgroundColor: '#A61C1C', 
              width: currentStageIndex > 0 ? '100%' : currentStageIndex === 0 ? '50%' : '0%',
              transition: 'width 0.5s ease',
              animation: currentStageIndex === 0 ? 'loadingBar 1.5s infinite linear' : 'none'
            }} />
          </div>

          {/* Node 2: On The Grill */}
          <div style={{ zIndex: 2, textAlign: 'center' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: currentStageIndex >= 1 ? '#A61C1C' : '#DDD', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: '2px solid #111' }}>
              {currentStageIndex >= 1 ? '✓' : '2'}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginTop: '6px' }}>Grill</span>
          </div>

          {/* Connection Pipe 2 */}
          <div style={{ flex: 1, height: '6px', backgroundColor: '#DDD', margin: '0 -5px', position: 'relative', top: '-8px', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              backgroundColor: '#A61C1C', 
              width: currentStageIndex > 1 ? '100%' : currentStageIndex === 1 ? '50%' : '0%',
              transition: 'width 0.5s ease',
              animation: currentStageIndex === 1 ? 'loadingBar 1.5s infinite linear' : 'none'
            }} />
          </div>

          {/* Node 3: Collection */}
          <div style={{ zIndex: 2, textAlign: 'center' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: currentStageIndex >= 2 ? '#10B981' : '#DDD', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: '2px solid #111' }}>
              {currentStageIndex >= 2 ? '🎁' : '3'}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginTop: '6px' }}>Ready</span>
          </div>

        </div>

        {/* CSS Animation Blocks injected natively inside components */}
        <style jsx global>{`
          @keyframes loadingBar {
            0% { transform: translateX(-100%); width: 100%; }
            100% { transform: translateX(100%); width: 100%; }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        `}</style>

        {/* Order Receipt Details Summary */}
        <div style={{ marginTop: '35px', borderTop: '2px dashed #111', paddingTop: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '800' }}>YOUR SELECTION:</h4>
          {order.items_json.map((item: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px', fontWeight: '500' }}>
              <span>{item.qty}x {item.name}</span>
              <span>R {item.price * item.qty}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', borderTop: '1px solid #EEE', paddingTop: '10px', marginTop: '10px', fontSize: '16px' }}>
            <span>TOTAL PAID</span>
            <span style={{ color: '#A61C1C' }}>R {order.total_amount}</span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function TrackerPage() {
  return (
    <Suspense fallback={
      <div style={{ backgroundColor: '#F2C12E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>
        LOADING SECURE MODULE RUNTIME...
      </div>
    }>
      <TrackerContent />
    </Suspense>
  );
}