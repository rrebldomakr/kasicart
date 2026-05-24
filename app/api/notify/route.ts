import { NextResponse } from 'next/server';
import { supabase } from '../../utils/supabase';

export async function POST(request: Request) {
  try {
    const { orderId, nextStatus } = await request.json();

    if (!orderId || !nextStatus) {
      return NextResponse.json({ error: 'Missing routing parameters' }, { status: 400 });
    }

    // 1. Fetch the order details
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: 'Order record lookup failed' }, { status: 404 });
    }

    // 2. Query the profile memory table
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('phone_number')
      .eq('customer_name', order.customer_phone)
      .maybeSingle();

    const destinationPhone = profile ? profile.phone_number : '+27719998888';

    // 3. Compile the operational text response string safely
    let alertText = '';
    const customerNameUpper = order.customer_phone.toUpperCase();

    if (nextStatus === 'preparing') {
      alertText = `🔥 Yo, ${customerNameUpper}! The kitchen team just accepted your order. Your Kota is officially ON THE GRILL! 🍳`;
    } else if (nextStatus === 'ready') {
      alertText = `📦 NENES ALERTS // Yo ${customerNameUpper}, your order is wrapped and ready for collection! Come grab it while it's piping hot! 📢`;
    } else {
      return NextResponse.json({ success: true, message: 'Status logging complete' });
    }

    // 4. LOG OUTGOING PAYLOAD TO THE SYSTEM CONSOLE
    console.log(`\n--- 📱 OUTGOING WHATSAPP TEXT MESSAGE SENT ---`);
    console.log(`TO: whatsapp:${destinationPhone}`);
    console.log(`MESSAGE: "${alertText}"`);
    console.log(`-------------------------------------------\n`);

    return NextResponse.json({ success: true, message: 'Client text dispatches successfully logged', dispatchedText: alertText });

  } catch (err: any) {
    console.error("Internal Notification Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}