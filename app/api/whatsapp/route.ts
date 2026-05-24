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

    // Profile retrieval/safe bootstrap wrapper
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
          current_state: 'browsing',
          loyalty_points: 5
        }, { onConflict: 'phone_number' })
        .select()
        .single();
      
      profile = newProfile;
    }

    // ==========================================
    // INTERCEPTOR: MID-CHECKOUT NAME COLLECTION
    // ==========================================
    if (profile.current_state === 'awaiting_checkout_name') {
      const customerNameInput = actionTrigger;
      console.log(`📝 MID-CHECKOUT NAME CAPTURED -> Saving name: "${customerNameInput}" for order filing`);

      const finalCart = profile.temp_cart_json || [];

      // 1. Stream the final transactional order ticket card directly onto the chef live dash monitor
      await supabase.from('orders').insert({
        vendor_id: vendor.id,
        customer_phone: customerNameInput, // Saved under their real inputted tracking name
        status: 'incoming',
        items_json: finalCart
      });

      // 2. Reset customer state metrics and clean out the temporary json columns
      await supabase.from('customer_profiles').update({ 
        customer_name: customerNameInput,
        temp_cart_json: null,
        current_state: 'browsing' 
      }).eq('phone_number', cleanedPhone);

      await sendTextMessage(
        incomingPhone, 
        `🚀 WE FILING IT, ${customerNameInput.toUpperCase()}!\n\nYour order just flew straight onto Nenes Street Kitchen monitor board dashboard monitor screen.\n\nKeep this chat open—we will drop an alert here the exact second your meal hits the roaring grill! 🔥🍟`
      );

      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' }, status: 200 });
    }

    // ==========================================
    // ACTIONS SYSTEM CORE ROUTER
    // ==========================================
    console.log(`🕹️ ACTION ENGINE -> Processing key: "${actionTrigger}"`);

    // Category Navigation Streams
    if (actionTrigger === 'CAT_ALMIGHTY') {
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_ALMIGHTY_SID);
    } 
    else if (actionTrigger === 'CAT_KING') {
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_KING_SID);
    } 
    else if (actionTrigger === 'CAT_DRINKS') {
      await sendTwilioButtonTemplate(incomingPhone, TWILIO_DRINKS_SID);
    } 

    // Specific Item Order Processing
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
      
      // Deliver the cart selection buttons review page template layout
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_CART_SID);
    } 

    // Checkout Confirmation Trigger (User clicks Checkout Now button component)
    else if (actionTrigger === 'CHECKOUT_CONFIRM') {
      const checkCart = profile.temp_cart_json || [];

      if (checkCart.length === 0) {
        await sendTextMessage(incomingPhone, `⚠️ Your cart is currently empty! Pick some food from the selections first.`);
        await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_SECTIONS_SID);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' }, status: 200 });
      }

      // Instead of locking execution, update state to expect a name string reply text input next
      await supabase.from('customer_profiles').update({ current_state: 'awaiting_checkout_name' }).eq('phone_number', cleanedPhone);

      await sendTextMessage(
        incomingPhone, 
        `🛒 Sweet, meals added successfully!\n\nWho is this order for? Just reply with your name right now so the chefs know who to call when it's sizzling hot! 👇`
      );
    } 

    // Fallback Reset Commands
    else if (actionTrigger === 'CLEAR_CART' || actionTrigger === 'GO_BACK' || actionTrigger.toLowerCase() === 'menu' || actionTrigger.toLowerCase() === 'hi') {
      await supabase.from('customer_profiles').update({ temp_cart_json: null, current_state: 'browsing' }).eq('phone_number', cleanedPhone);
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_SECTIONS_SID);
    } 
    
    else {
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
    console.error("❌ Template delivery error:", e);
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
    console.error("❌ Text delivery error:", e);
  }
}