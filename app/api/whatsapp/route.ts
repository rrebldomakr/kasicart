import { NextResponse } from 'next/server';
import { supabase } from '../../utils/supabase';

// ==========================================
// UNIFIED LOCAL ACCESS CREDENTIALS
// ==========================================
const TWILIO_ACCOUNT_SID  = 'ACbf08959dc99af94412f4038dbebe6113';
const TWILIO_AUTH_TOKEN   = '12ce467c7b80172fc94c9c7c5f9c1967'; 
const TWILIO_PHONE_NUMBER = '+14155238886'; 

// ==========================================
// PRODUCTION PURE ENGLISH CONTENT SIDs
// ==========================================
const TEMPLATE_SECTIONS_SID = 'HX7bbe21cebedde5b2128187d4a56f0c88'; 
const TEMPLATE_ALMIGHTY_SID = 'HX22caec023b6720ffdbe41fdc8aa3e570';
const TEMPLATE_KING_SID     = 'HXd68eb7a54bccfba990891b1fdbf0090b';     
const TWILIO_DRINKS_SID     = 'HX74801bc0a507324aa6f22d5ecabb8442';   
const TEMPLATE_CART_SID     = 'HXd5b953f276e46fc680219e693dddf254';

export async function POST(request: Request) {
  try {
    let incomingPhone = '';
    let incomingMessage = '';
    let buttonPayload = '';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      incomingPhone = body.phone || '';
      incomingMessage = body.message || '';
    } else {
      const formData = await request.formData();
      incomingPhone = formData.get('From')?.toString() || ''; 
      incomingMessage = formData.get('Body')?.toString() || '';
      buttonPayload = formData.get('ButtonPayload')?.toString() || '';
    }

    console.log(`📥 INBOUND WEBHOOK -> Phone: ${incomingPhone}, Msg: ${incomingMessage}, Payload: ${buttonPayload}`);

    if (!incomingPhone || !incomingMessage) {
      return new Response('Missing transmission payloads', { status: 400 });
    }

    const cleanedPhone = incomingPhone.replace('whatsapp:', '').replace(/\D/g, '').trim();
    const actionTrigger = buttonPayload || incomingMessage.trim();

    const { data: vendor } = await supabase.from('vendors').select('id').eq('slug', 'nenes').single();
    if (!vendor) return new Response('Vendor mismatch', { status: 500 });

    let { data: profile } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('phone_number', cleanedPhone)
      .maybeSingle();

    if (!profile) {
      const { data: newProfile } = await supabase
        .from('customer_profiles')
        .upsert({
          phone_number: cleanedPhone,
          customer_name: 'Kasi Customer',
          loyalty_points: 5
        }, { onConflict: 'phone_number' })
        .select()
        .single();
      
      profile = newProfile;
    }

    // ==========================================
    // SYSTEM ROUTER (BUTTON INTERACTIONS ONLY)
    // ==========================================
    console.log(`🕹️ ACTION ENGINE -> Key Match: "${actionTrigger}"`);

    if (actionTrigger === 'CAT_ALMIGHTY') {
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_ALMIGHTY_SID);
    } 
    else if (actionTrigger === 'CAT_KING') {
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_KING_SID);
    } 
    else if (actionTrigger === 'CAT_DRINKS') {
      await sendTwilioButtonTemplate(incomingPhone, TWILIO_DRINKS_SID);
    } 

    // Item Selection Add-to-Cart Router
    else if (
      actionTrigger === 'ITEM_SPECIAL' || 
      actionTrigger === 'ITEM_FULLHOUSE' || 
      actionTrigger === 'ITEM_KINGRIB' || 
      actionTrigger === 'ITEM_SOWETOBOSS' || 
      actionTrigger === 'ITEM_COKE' || 
      actionTrigger === 'ITEM_STONEY'
    ) {
      let itemName = '';
      let itemPrice = 0;

      switch(actionTrigger) {
        case 'ITEM_SPECIAL':   itemName = 'Almighty Special';      itemPrice = 65.00; break;
        case 'ITEM_FULLHOUSE': itemName = 'Full House Almighty';   itemPrice = 85.00; break;
        case 'ITEM_KINGRIB':   itemName = 'King Rib Kota';         itemPrice = 55.00; break;
        case 'ITEM_SOWETOBOSS':itemName = 'The Soweto Boss';       itemPrice = 75.00; break;
        case 'ITEM_COKE':      itemName = 'Coca-Cola Can';         itemPrice = 18.00; break;
        case 'ITEM_STONEY':    itemName = 'Stoney Ginger Beer';    itemPrice = 18.00; break;
      }

      const currentCart = profile.temp_cart_json || [];
      currentCart.push({ name: itemName, qty: 1, price: itemPrice });

      await supabase.from('customer_profiles').update({ temp_cart_json: currentCart }).eq('phone_number', cleanedPhone);
      
      // Safe fallback line notification strategy
      await sendTextMessage(incomingPhone, ` added *${itemName}* (R${itemPrice}) straight into your shopping basket layout profile!`);
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_CART_SID);
    } 

    // Checkout Confirmation -> Directly files the ticket live to your kitchen monitor
    else if (actionTrigger === 'CHECKOUT_CONFIRM') {
      const finalCart = profile.temp_cart_json || [];

      if (finalCart.length === 0) {
        await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_SECTIONS_SID);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' }, status: 200 });
      }

      await supabase.from('orders').insert({
        vendor_id: vendor.id,
        customer_phone: cleanedPhone, 
        status: 'incoming',
        items_json: finalCart
      });

      await supabase.from('customer_profiles').update({ temp_cart_json: null }).eq('phone_number', cleanedPhone);

      await sendTextMessage(
        incomingPhone, 
        `🚀 ORDER FILED SUCCESSFULLY!\n\nYour menu selections just landed straight onto the chef's dashboard monitor screen.\n\nKeep this chat thread open—we will drop an alert here the exact second your meal hits the grill! 🔥🍟`
      );
    } 

    // Global reset fallback command handler
    else {
      await supabase.from('customer_profiles').update({ temp_cart_json: null }).eq('phone_number', cleanedPhone);
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_SECTIONS_SID);
    }

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
      status: 200
    });

  } catch (err: any) {
    console.error("❌ CRITICAL ROUTE EXCEPTION:", err.message);
    return new Response('Internal Webhook Error', { status: 500 });
  }
}

async function sendTwilioButtonTemplate(to: string, templateSid: string) {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const params = new URLSearchParams();
    params.append('From', `whatsapp:${TWILIO_PHONE_NUMBER}`);
    params.append('To', to);
    params.append('ContentSid', templateSid);

    await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
  } catch (e) {
    console.error("❌ Template send crash:", e);
  }
}

async function sendTextMessage(to: string, text: string) {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const params = new URLSearchParams();
    params.append('From', `whatsapp:${TWILIO_PHONE_NUMBER}`);
    params.append('To', to);
    params.append('Body', text);

    await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
  } catch (e) {
    console.error("❌ Text send crash:", e);
  }
}