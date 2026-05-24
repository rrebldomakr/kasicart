import { NextResponse } from 'next/server';
import { supabase } from '../../utils/supabase';

// ==========================================
// UNIFIED LOCAL ACCESS CREDENTIALS
// ==========================================
const TWILIO_ACCOUNT_SID  = 'ACbf08959dc99af94412f4038dbebe6113';
const TWILIO_AUTH_TOKEN   = '827dffa937dcb6f83e91264220c38f5b';
const TWILIO_PHONE_NUMBER = '+14155238886'; 

// ==========================================
// PRODUCTION TWILIO TEMPLATE REGISTER
// ==========================================
const TEMPLATE_SECTIONS_SID = 'HX7bbe21cebedde5b2128187d4a56f0c88';
const TEMPLATE_ALMIGHTY_SID = 'HXb178629ebc0d15513ff1e561a9e5d173';
const TEMPLATE_KING_SID     = 'HX20163686b3dd0eb6bc28c948ac96c34c';     
const TEMPLATE_DRINKS_SID    = 'HXe8d3a2c3791b89b25078096fa5f5e22b';   
const TEMPLATE_CART_SID     = 'HX2c22420044694b5c0fa64ec25b14cf84';

export async function POST(request: Request) {
  try {
    let incomingPhone = '';
    let incomingMessage = '';
    let buttonPayload = '';

    const contentType = request.headers.get('content-type') || '';

    // EXTRACT PHASE: Parse inbound web data streaming directly out of Twilio's live webhook form
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

    // High-visibility log to tracking pipeline activity
    console.log(`📥 INBOUND WEBHOOK EXECUTION START -> Phone: ${incomingPhone}, Msg: ${incomingMessage}, Payload: ${buttonPayload}`);

    if (!incomingPhone || !incomingMessage) {
      return new Response('Missing transmission payloads', { status: 400 });
    }

    // NORMALIZATION PHASE: Strip out formatting and non-numeric artifacts to create clean matching keys
    const cleanedPhone = incomingPhone.replace('whatsapp:', '').replace(/\D/g, '').trim();
    const actionTrigger = buttonPayload || incomingMessage.trim();

    // VENDOR VERIFICATION: Establish presence tracking link for the destination storefront profile
    const { data: vendor } = await supabase.from('vendors').select('id').eq('slug', 'nenes').single();
    if (!vendor) {
      console.error("❌ ROUTE STOPPED: Vendor verification context model matching 'nenes' not located.");
      return new Response('Vendor mismatch', { status: 500 });
    }

    // PROFILE ACQUISITION: Pull user account details straight out of your live data rows
    let { data: profile } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('phone_number', cleanedPhone)
      .maybeSingle();

    // ==========================================
    // STATE LAYER A: ONBOARDING PIPELINE
    // ==========================================
    
    // CONDITION 1: User does not exist, or exists with a default unconfigured state marker
    if (!profile || profile.customer_name === 'Pending' || profile.customer_name === 'Pending Registration') {
      
      // If no profile object is present in local runtime memory, safely bootstrap a basic registration row
      if (!profile) {
        console.log(`🆕 ACCOUNT MISSING -> Compiling safe profile record wrapper for number: ${cleanedPhone}`);
        
        // UPSERT ENGINE: Prevents schema 400 crashes by safely matching matching rows or applying absolute defaults
        const { data: newProfile, error: upsertError } = await supabase
          .from('customer_profiles')
          .upsert({
            phone_number: cleanedPhone,
            customer_name: 'Pending Registration',
            loyalty_points: 0
          }, { onConflict: 'phone_number' })
          .select()
          .maybeSingle();

        if (upsertError) {
          console.error("❌ DATABASE WRITE REJECTED BY SCHEMA:", upsertError.message);
          // Fallback bypass: handle transmission delivery even if table constraints hit a wall
        }
        
        profile = newProfile;
      }

      // If they sent a system greeting text, fire the clean onboarding question block back to their screen
      if (actionTrigger.toLowerCase() === 'hi' || actionTrigger.toLowerCase() === 'menu' || !profile || profile.customer_name === 'Pending Registration') {
        console.log(`💬 Dispatching name intake interface payload to client screen...`);
        
        await sendTextMessage(
          incomingPhone, 
          `🇿🇦 Yo! Welcome to KasiCart // Nenes Street Kitchen!\n\nWe don't have your number registered yet.\n\nWhat should the chefs call you? Just reply with your name right now! 👇`
        );

        // Update name placeholder tracker state to prevent re-triggering this prompt
        if (profile) {
          await supabase.from('customer_profiles').update({ customer_name: 'Pending' }).eq('id', profile.id);
        }

        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' }, status: 200 });
      }

      // CONDITION 2: If their name tracker is set to 'Pending', whatever text string they type next becomes their saved name
      const chosenName = actionTrigger;
      console.log(`📝 CAPTURING INBOUND STRING TEXT -> Processing clean name change update: "${chosenName}"`);

      const { data: activatedProfile } = await supabase
        .from('customer_profiles')
        .update({
          customer_name: chosenName
        })
        .eq('phone_number', cleanedPhone)
        .select()
        .maybeSingle();

      if (activatedProfile) {
        profile = activatedProfile;
      }

      // Confirm their registration changes live, and push the interactive layout buttons straight to their phone
      await sendTextMessage(incomingPhone, `✨ Sho, ${chosenName}! Profile saved permanently. You've scored 5 Loyalty Points! 🎉`);
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_SECTIONS_SID);

      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' }, status: 200 });
    }

    // ==========================================
    // STATE LAYER B: INTERACTIVE BUTTON NAVIGATION ROUTER
    // ==========================================
    console.log(`🕹️ EVALUATING INTERACTIVE PAYLOAD KEY -> "${actionTrigger}" for customer: ${profile.customer_name}`);

    // Core Section Category Links
    if (actionTrigger === 'CAT_ALMIGHTY') {
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_ALMIGHTY_SID);
    } 
    else if (actionTrigger === 'CAT_KING') {
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_KING_SID);
    } 
    else if (actionTrigger === 'CAT_DRINKS') {
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_DRINKS_SID);
    } 

    // Specific Item Selection / Cart Insertion Array Processor
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

      // Append new items into the temporary json column array storage record
      const currentCart = profile.temp_cart_json || [];
      currentCart.push({ name: itemName, qty: 1, price: itemPrice });

      await supabase.from('customer_profiles').update({ temp_cart_json: currentCart }).eq('id', profile.id);
      
      // Dispatch the Cart Review action templates out
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_CART_SID);
    } 

    // Final Transaction Execution -> Streams data directly to your live kitchen board monitor screen
    else if (actionTrigger === 'CHECKOUT_CONFIRM') {
      const finalCart = profile.temp_cart_json || [];

      if (finalCart.length === 0) {
        await sendTextMessage(incomingPhone, `⚠️ Your cart is empty! Pick some food first.`);
        await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_SECTIONS_SID);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' }, status: 200 });
      }

      // Insert transactional data array card onto the chef dashboard pipeline streaming interface
      await supabase.from('orders').insert({
        vendor_id: vendor.id,
        customer_phone: profile.customer_name, 
        status: 'incoming',
        items_json: finalCart
      });

      // Completely clear out cart data storage space columns for future sessions
      await supabase.from('customer_profiles').update({ temp_cart_json: null }).eq('id', profile.id);

      await sendTextMessage(
        incomingPhone, 
        `🚀 WE FILING IT, ${profile.customer_name.toUpperCase()}!\n\nYour order just flew straight onto the chef's dashboard monitor screen. Completely interactive, zero typing required!\n\nKeep this chat open—we will drop an alert here the exact second your meal hits the roaring grill! 🔥🍟`
      );
    } 

    // System Reset Handlers (Clear commands, cancellation actions, navigation loops)
    else if (actionTrigger === 'CLEAR_CART' || actionTrigger === 'GO_BACK' || actionTrigger.toLowerCase() === 'menu' || actionTrigger.toLowerCase() === 'hi') {
      await supabase.from('customer_profiles').update({ temp_cart_json: null }).eq('id', profile.id);
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_SECTIONS_SID);
    } 
    
    else {
      // Fallback loop safety trap
      await sendTwilioButtonTemplate(incomingPhone, TEMPLATE_SECTIONS_SID);
    }

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
      status: 200
    });

  } catch (err: any) {
    console.error("❌ SYSTEM FAILURE ENCOUNTERED INSIDE FUNCTION ENGINE:", err.message);
    return new Response('Internal Webhook Error', { status: 500 });
  }
}

// NETWORK TRANSLATOR: Sends structured quick-reply template components using Fetch API to Twilio
async function sendTwilioButtonTemplate(to: string, templateSid: string) {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const params = new URLSearchParams();
    params.append('From', `whatsapp:${TWILIO_PHONE_NUMBER}`);
    params.append('To', to);
    params.append('ContentSid', templateSid);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const outputLog = await response.json();
    console.log(`📡 Twilio Template Delivery Attempt Status: [${response.status}]`, JSON.stringify(outputLog));
  } catch (e) {
    console.error("❌ PIPELINE REJECTION ERROR (sendTwilioButtonTemplate executed with invalid response):", e);
  }
}

// NETWORK TRANSLATOR: Sends standard message strings using Fetch API to Twilio
async function sendTextMessage(to: string, text: string) {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const params = new URLSearchParams();
    params.append('From', `whatsapp:${TWILIO_PHONE_NUMBER}`);
    params.append('To', to);
    params.append('Body', text);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const outputLog = await response.json();
    console.log(`📡 Twilio Text String Delivery Attempt Status: [${response.status}]`, JSON.stringify(outputLog));
  } catch (e) {
    console.error("❌ PIPELINE REJECTION ERROR (sendTextMessage executed with invalid response):", e);
  }
}