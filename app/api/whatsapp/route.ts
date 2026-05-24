import { NextResponse } from 'next/server';
import { supabase } from '../../utils/supabase';

// ==========================================
// UNIFIED LOCAL ACCESS CREDENTIALS
// ==========================================
const TWILIO_ACCOUNT_SID  = 'ACbf08959dc99af94412f4038dbebe6113';
const TWILIO_AUTH_TOKEN   = '12ce467c7b80172fc94c9c7c5f9c1967'; 
const TWILIO_PHONE_NUMBER = '+14155238886'; 

// ==========================================
// NEW PRODUCTION PURE ENGLISH CONTENT SIDs
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

    // EXTRACT PHASE: Read incoming web payload parameters out of Twilio's incoming webhook post
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

    console.log(`📥 INBOUND WEBHOOK EXECUTION START -> Phone: ${incomingPhone}, Msg: ${incomingMessage}, Payload: ${buttonPayload}`);

    if (!incomingPhone || !incomingMessage) {
      return new Response('Missing transmission payloads', { status: 400 });
    }

    // NORMALIZATION PHASE: Keep pure numeric matching keys and strip format strings
    const cleanedPhone = incomingPhone.replace('whatsapp:', '').replace(/\D/g, '').trim();
    const actionTrigger = buttonPayload || incomingMessage.trim();

    // VENDOR MATCHING: Ensure nenes profile link context is active
    const { data: vendor } = await supabase.from('vendors').select('id').eq('slug', 'nenes').single();
    if (!vendor) return new Response('Vendor mismatch', { status: 500 });

    // Look up user profile row records
    let { data: profile } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('phone_number', cleanedPhone)
      .maybeSingle();

    // ==========================================
    // LAYER A: ONBOARDING REGISTRATION PIPELINE
    // ==========================================
    
    // STEP 1: Number hits for the first time -> create row card entry
    if (!profile) {
      console.log(`🆕 ACCOUNT MISSING -> Registering base database profile row for number: ${cleanedPhone}`);
      
      const { data: newProfile } = await supabase
        .from('customer_profiles')
        .upsert({
          phone_number: cleanedPhone,
          customer_name: 'AWAITING_NAME_STAGE',
          loyalty_points: 5
        }, { onConflict: 'phone_number' })
        .select()
        .single();

      await sendTextMessage(
        incomingPhone, 
        `🇿🇦 Yo! Welcome to KasiCart // Nenes Street Kitchen!\n\nWe don't have your number registered yet.\n\nWhat should the chefs call you? Just reply with your name right now! 👇`
      );

      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' }, status: 200 });
    }

    // STEP 2: Profile row exists but is currently flagged as awaiting setup name string
    if (profile.customer_name === 'AWAITING_NAME_STAGE') {
      const chosenName = actionTrigger;
      console.log(`📝 CAPTURING INBOUND NAME TEXT -> Target Phone: ${cleanedPhone} -> Setting value to: "${chosenName}"`);

      const { data: updatedProfile } = await supabase
        .from('customer_profiles')
        .update({
          customer_name: chosenName
        })
        .eq('phone_number', cleanedPhone)
        .select()
        .single();

      profile = updatedProfile;

      await sendTextMessage(
        incomingPhone, 
        `✨ Sho, ${chosenName}! Your profile is saved permanently. You've scored 5 Loyalty Points! 🎉\n\nTo view the interactive food menu, just reply with the word *'menu'* right now!`
      );

      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' }, status: 200 });
    }

    // ==========================================
    // LAYER B: INTERACTIVE BUTTON NAVIGATION ROUTER
    // ==========================================
    console.log(`🕹️ EVALUATING INTERACTIVE PAYLOAD KEY -> "${actionTrigger}" for customer: ${profile?.customer_name}`);

    if (actionTrigger === 'CAT_ALMIGHTY') {
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_ALMIGHTY_SID);
    } 
    else if (actionTrigger === 'CAT_KING') {
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_KING_SID);
    } 
    else if (actionTrigger === 'CAT_DRINKS') {
      await sendTwilioButtonTemplate(incomingPhone, TWILIO_DRINKS_SID);
    } 

    // Process meal items and add them straight to the temporary json cart data column
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
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_CART_SID);
    } 

    // Final Core checkout execution layer -> drops directly onto chef screen panel streams
    else if (actionTrigger === 'CHECKOUT_CONFIRM') {
      const finalCart = profile.temp_cart_json || [];

      if (finalCart.length === 0) {
        await sendTextMessage(incomingPhone, `⚠️ Your cart is empty! Pick some food first.`);
        await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_SECTIONS_SID);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' }, status: 200 });
      }

      await supabase.from('orders').insert({
        vendor_id: vendor.id,
        customer_phone: profile.customer_name, 
        status: 'incoming',
        items_json: finalCart
      });

      await supabase.from('customer_profiles').update({ temp_cart_json: null }).eq('phone_number', cleanedPhone);

      await sendTextMessage(
        incomingPhone, 
        `🚀 WE FILING IT, ${profile.customer_name.toUpperCase()}!\n\nYour order just flew straight onto the chef's dashboard monitor screen. Completely interactive, zero typing required!\n\nKeep this chat open—we will drop an alert here the exact second your meal hits the roaring grill! 🔥🍟`
      );
    } 

    else if (actionTrigger === 'CLEAR_CART' || actionTrigger === 'GO_BACK' || actionTrigger.toLowerCase() === 'menu' || actionTrigger.toLowerCase() === 'hi') {
      await supabase.from('customer_profiles').update({ temp_cart_json: null }).eq('phone_number', cleanedPhone);
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
    console.error(" Critical Button Pipeline Failure:", err.message);
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
    console.error("❌ TWILIO ROUTING EXCEPTION (Button template send failed):", e);
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
    console.error("❌ TWILIO ROUTING EXCEPTION (Plain text send failed):", e);
  }
}