import { NextResponse } from 'next/server';
import { supabase } from '../../utils/supabase';

export async function POST(request: Request) {
  try {
    let incomingPhone = '';
    let incomingMessage = '';

    const contentType = request.headers.get('content-type') || '';

    // 1. Parse inbound layout smartly based on content format
    if (contentType.includes('application/json')) {
      const body = await request.json();
      incomingPhone = body.phone || '';
      incomingMessage = body.message || '';
    } else {
      // Handles real incoming Twilio production form data payloads
      const formData = await request.formData();
      incomingPhone = formData.get('From')?.toString() || ''; // Looks like "whatsapp:+2781..."
      incomingMessage = formData.get('Body')?.toString() || '';
      
      // Strip the prefix if Twilio sends it with the wire string
      incomingPhone = incomingPhone.replace('whatsapp:', '').trim();
    }

    if (!incomingPhone || !incomingMessage) {
      return new Response('Missing transmission payloads', { status: 400 });
    }

    // 2. Query Memory Matrix for Customer Record via Supabase
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('phone_number', incomingPhone)
      .maybeSingle();

    let replyText = '';

    if (!profile) {
      // State A: Unregistered Number Processing
      if (incomingMessage.toLowerCase().startsWith('my name is')) {
        const extractedName = incomingMessage.replace(/my name is/i, '').trim();
        
        await supabase.from('customer_profiles').insert({
          phone_number: incomingPhone,
          customer_name: extractedName,
          loyalty_points: 5
        });

        replyText = `✨ Sho, ${extractedName}! Account verified. You've been loaded with 5 Loyalty Points! 🎉\n\nReply with "1" to look at the Nenes Kitchen Menu and place an order.`;
      } else {
        replyText = `🇿🇦 Yo! Welcome to KasiCart // Nenes Street Kitchen!\n\nWe don't have your number registered yet.\n\nTo setup your profile instantly, reply with:\n"My name is [Your Name]"`;
      }
    } else {
      // State B: Registered Operational User Flow Engine
      if (incomingMessage.trim() === '1') {
        const { data: vendor } = await supabase
          .from('vendors')
          .select('id')
          .eq('slug', 'nenes')
          .single();
        
        // TypeScript safety net: block execution if vendor table doesn't return data
        if (!vendor) {
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Store configuration error. Please try again later.</Message></Response>`, 
            { headers: { 'Content-Type': 'text/xml' }, status: 200 }
          );
        }

        // Inject a simulated order record directly into the live kitchen stream
        await supabase.from('orders').insert({
          vendor_id: vendor.id,
          customer_phone: profile.customer_name, // Maps profile name straight to card header
          status: 'incoming',
          items_json: [{ name: "Almighty Burger with Rib & Bacon", qty: 1 }]
        });

        replyText = `🍔 ORDER FIRED UP, ${profile.customer_name.toUpperCase()}!\n\nOur chefs just received your order for 1x Almighty Burger.\n\nKeep this chat open—we will text you the exact second it hits the grill! 🔥`;
      } else {
        replyText = `Yo ${profile.customer_name}! Reply with "1" to instantly order the Nenes Almighty Burger special right now! 📢`;
      }
    }

    // 3. Compile structural TwiML XML response so Twilio reads it perfectly
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Message>${replyText}</Message>
    </Response>`;

    return new Response(twimlResponse, {
      headers: { 'Content-Type': 'text/xml' },
      status: 200
    });

  } catch (err: any) {
    console.error("Critical Webhook Pipeline Failure:", err.message);
    return new Response('Internal Webhook Error', { status: 500 });
  }
}