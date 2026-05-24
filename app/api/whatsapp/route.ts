import { NextResponse } from 'next/server';
import { supabase } from '../../utils/supabase';

export async function POST(request: Request) {
  try {
    let incomingPhone = '';
    let incomingMessage = '';

    const contentType = request.headers.get('content-type') || '';

    // 1. Parse inbound data payload formats safely
    if (contentType.includes('application/json')) {
      const body = await request.json();
      incomingPhone = body.phone || '';
      incomingMessage = body.message || '';
    } else {
      const formData = await request.formData();
      incomingPhone = formData.get('From')?.toString() || ''; 
      incomingMessage = formData.get('Body')?.toString() || '';
      incomingPhone = incomingPhone.replace('whatsapp:', '').trim();
    }

    if (!incomingPhone || !incomingMessage) {
      return new Response('Missing transmission payloads', { status: 400 });
    }

    // Fetch vendor record to ensure everything attaches to the correct kitchen shop
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('slug', 'nenes')
      .single();
    
    if (!vendor) {
      return new Response('Vendor not configured in DB', { status: 500 });
    }

    // 2. Query/Create Customer Profile with explicit state machine tracking memory
    let { data: profile } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('phone_number', incomingPhone)
      .maybeSingle();

    let replyText = '';

    // STATE MACHINE CONTROLLER LAYER
    if (!profile) {
      // PHASE 0: Complete stranger touches the system
      if (incomingMessage.toLowerCase().startsWith('my name is')) {
        const extractedName = incomingMessage.replace(/my name is/i, '').trim();
        
        const { data: newProfile } = await supabase.from('customer_profiles').insert({
          phone_number: incomingPhone,
          customer_name: extractedName,
          loyalty_points: 5,
          current_state: 'menu' // Push them straight to menu state on registration success
        }).select().single();

        profile = newProfile;
        replyText = `✨ Sho, ${extractedName}! Account verified. You've scored 5 Loyalty Points! 🎉\n\n${await buildMenuText(vendor.id)}`;
      } else {
        replyText = `🇿🇦 Yo! Welcome to KasiCart // Nenes Street Kitchen!\n\nWe don't have your number registered yet.\n\nTo setup your profile instantly, reply with:\n"My name is [Your Name]"`;
      }
    } else {
      // Handle fallback resets if the user types "reset" or gets lost
      if (incomingMessage.toLowerCase().trim() === 'reset') {
        await supabase.from('customer_profiles').update({ current_state: 'menu' }).eq('id', profile.id);
        profile.current_state = 'menu';
      }

      // PHASE 1: User is currently browsing the menu table options
      if (profile.current_state === 'menu') {
        const selectedIndex = parseInt(incomingMessage.trim());

        if (!isNaN(selectedIndex) && selectedIndex > 0) {
          // Fetch menu items from database to match the number selection choice
          const { data: items } = await supabase
            .from('menu_items')
            .select('*')
            .eq('vendor_id', vendor.id)
            .order('created_at', { ascending: true });

          if (items && items[selectedIndex - 1]) {
            const chosenItem = items[selectedIndex - 1];

            // Store selection data directly inside the user profile memory space as temporary metadata
            await supabase.from('customer_profiles').update({ 
              current_state: 'cart',
              temp_cart_json: [{ name: chosenItem.name, qty: 1, price: chosenItem.price }]
            }).eq('id', profile.id);

            replyText = `🛒 CUSTOMER CART CHECKOUT:\n\nYou selected: *1x ${chosenItem.name} (R${chosenItem.price})*\n\nReply with:\n*Y* to confirm and send to kitchen\n*N* to clear and view menu again`;
          } else {
            replyText = `⚠️ Out of range! Please choose a valid index number from the list:\n\n${await buildMenuText(vendor.id)}`;
          }
        } else {
          replyText = `👋 Hello ${profile.customer_name}!\n\nHere is our current live kitchen selection:\n\n${await buildMenuText(vendor.id)}`;
        }
      } 
      
      // PHASE 2: User is standing at the transactional cart checkout line
      else if (profile.current_state === 'cart') {
        const choice = incomingMessage.trim().toLowerCase();

        if (choice === 'y') {
          const cartItems = profile.temp_cart_json || [{ name: "Almighty Burger with Rib & Bacon", qty: 1 }];

          // Write data straight into production kitchen streaming pipeline
          await supabase.from('orders').insert({
            vendor_id: vendor.id,
            customer_phone: profile.customer_name, 
            status: 'incoming',
            items_json: cartItems
          });

          // Reset user session engine state machine state safely back to browsing phase
          await supabase.from('customer_profiles').update({ 
            current_state: 'menu',
            temp_cart_json: null 
          }).eq('id', profile.id);

          replyText = `🚀 ORDER SHIPPED TO KITCHEN!\n\nOur chefs just received your order line. Keep this screen chat window open—we text you when it hits the grill! 🔥`;
        } else if (choice === 'n') {
          await supabase.from('customer_profiles').update({ 
            current_state: 'menu',
            temp_cart_json: null 
          }).eq('id', profile.id);

          replyText = `🗑️ Cart cleared out!\n\nHere is the menu list again:\n\n${await buildMenuText(vendor.id)}`;
        } else {
          replyText = `⚠️ Invalid entry! Please reply with *Y* to confirm your purchase or *N* to cancel it.`;
        }
      }
    }

    // 3. Compile output structural TwiML response container
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

// Helper Function to compile database records dynamically into beautiful text strings
async function buildMenuText(vendorId: string): Promise<string> {
  const { data: items } = await supabase
    .from('menu_items')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: true });

  if (!items || items.length === 0) {
    return "🍽️ Menu is currently loading up or sold out. Try again shortly!";
  }

  let menuString = "📋 SELECT YOUR MEAL:\n\n";
  items.forEach((item, index) => {
    menuString += `*${index + 1}*. ${item.name} — R${item.price}\n_${item.description || 'Freshly grilled custom special'}_\n\n`;
  });
  menuString += "Reply with the Option Number (e.g. 1) to start checkout.";
  return menuString;
}