import { NextResponse } from 'next/server';
import { supabase } from '../../utils/supabase';

export async function POST(request: Request) {
  try {
    // 1. Capture the incoming data package from the WhatsApp network
    const contentType = request.headers.get('content-type') || '';
    let bodyText = '';
    let incomingMessage = '';
    let customerPhone = '';

    // WhatsApp gateways usually send data as URL-encoded forms
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      incomingMessage = formData.get('Body')?.toString().trim() || '';
      customerPhone = formData.get('From')?.toString().trim() || ''; // e.g., "whatsapp:+27712345678"
    } else {
      // Fallback for raw JSON testing
      const json = await request.json();
      incomingMessage = json.message || '';
      customerPhone = json.phone || '';
    }

    if (!customerPhone) {
      return NextResponse.json({ error: 'Missing phone endpoint token' }, { status: 400 });
    }

    // Clean up the phone string for cleaner database matching
    const cleanPhone = customerPhone.replace('whatsapp:', '');

    // 2. Check if this profile already exists in our loyalty memory bank
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('phone_number', cleanPhone)
      .maybeSingle();

    let replyText = '';

    // CASE 1: Brand New User (First time texting the bot)
    if (!profile) {
      // Split strings to parse if they are sending their name
      if (incomingMessage.toLowerCase().startsWith('my name is ')) {
        const extractedName = incomingMessage.substring(11).trim();

        // Save them permanently into the profile bank
        await supabase
          .from('customer_profiles')
          .insert([{ phone_number: cleanPhone, customer_name: extractedName, total_points: 10 }]);

        replyText = `🔥 Perfect, ${extractedName}! You've been registered to Nenes Orders. You just earned *10 Loyalty Points*!\n\nReply with *MENU* to see what's cooking today.`;
      } else {
        replyText = `👋 Yo! Welcome to the Nenes Street Kitchen bot.\n\nI don't have your number saved yet. Reply with *My name is [Your Name]* so the kitchen knows who to call! (e.g., *My name is Olwam*)`;
      }
    } 
    
    // CASE 2: Returning User
    else {
      const userText = incomingMessage.toLowerCase();

      if (userText === 'menu' || userText === 'hi' || userText === 'hey') {
        replyText = `🔥 Welcome back, ${profile.customer_name}!\n⭐ Balance: *${profile.total_points} Points*\n\nWhat are we smashing today?\n\n*1* 👉 Almighty Burger with Rib & Bacon (R77)\n*2* 👉 Almighty Burger with Rib & Footlong Russian (R79)\n*3* 👉 King Rib Kota (R51)\n\nReply with the *Number* of the item you want to order!`;
      } else if (userText === '1' || userText === '2' || userText === '3') {
        // Map selection options to database products
        let itemName = 'Almighty Burger with Rib and Bacon';
        let itemPrice = 77;
        
        if (userText === '2') {
          itemName = 'Almighty Burger with Rib and Footlong Russian';
          itemPrice = 79;
        } else if (userText === '3') {
          itemName = 'King Rib';
          itemPrice = 51;
        }

        // Get Nenes Vendor ID
        const { data: vendor } = await supabase.from('vendors').select('id').eq('slug', 'nenes').single();

        if (vendor) {
          // Push the order directly into the cloud orders table
          const { data: newOrder } = await supabase
            .from('orders')
            .insert([
              {
                vendor_id: vendor.id,
                customer_phone: profile.customer_name, // Map name straight to dashboard rendering layout
                items_json: [{ name: itemName, qty: 1, price: itemPrice }],
                total_amount: itemPrice,
                payment_verified: true
              }
            ])
            .select()
            .single();

          // Reward loyalty stack points
          await supabase
            .from('customer_profiles')
            .update({ total_points: profile.total_points + 10 })
            .eq('phone_number', cleanPhone);

          replyText = `🚀 ORDER FIRED UP, ${profile.customer_name.toUpperCase()}!\n\n🍔 *1x ${itemName}*\n💰 Total Due: *R${itemPrice}*\n⭐ +10 Points Added!\n\nThe kitchen just caught it. I'll ping you here the exact second it's on the grill!`;
        } else {
          replyText = `⚠️ System sync error. Try again later.`;
        }
      } else {
        replyText = `🤖 Code not recognized, ${profile.customer_name}.\n\nReply with *MENU* to view the current food list, or reply with *1*, *2*, or *3* to place an order instantly.`;
      }
    }

    // 3. Return response back to WhatsApp Gateway integration provider
    return NextResponse.json({ reply: replyText });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}