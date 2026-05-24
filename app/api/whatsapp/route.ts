import { NextResponse } from 'next/server';
import { supabase } from '../../utils/supabase';

export async function POST(request: Request) {
  try {
    let incomingPhone = '';
    let incomingMessage = '';

    const contentType = request.headers.get('content-type') || '';

    // 1. Safe Inbound Form Parser
    if (contentType.includes('application/json')) {
      const body = await request.json();
      incomingPhone = body.phone || '';
      incomingMessage = body.message || '';
    } else {
      const formData = await request.formData();
      incomingPhone = formData.get('From')?.toString() || ''; 
      incomingMessage = formData.get('Body')?.toString() || '';
    }

    if (!incomingPhone || !incomingMessage) {
      return new Response('Missing transmission payloads', { status: 400 });
    }

    // NORMALIZE PHONE NUMBER: Strip "whatsapp:", "+", and all non-numeric characters
    let cleanedPhone = incomingPhone.replace('whatsapp:', '').trim();
    cleanedPhone = cleanedPhone.replace(/\D/g, ''); // Leaves only pure digits like 27813988827

    const cleanedInput = incomingMessage.trim();

    // Fetch the active vendor record
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('slug', 'nenes')
      .single();
    
    if (!vendor) {
      return new Response('Vendor configuration mismatch', { status: 500 });
    }

    // 2. Fetch or Bootstrap Customer Dynamic Profile using cleaned phone digits
    let { data: profile } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('phone_number', cleanedPhone)
      .maybeSingle();

    let replyText = '';

    if (!profile) {
      // User Registration Onboarding Layer
      if (cleanedInput.toLowerCase().startsWith('my name is')) {
        const extractedName = cleanedInput.replace(/my name is/i, '').trim();
        
        const { data: newProfile } = await supabase.from('customer_profiles').insert({
          phone_number: cleanedPhone,
          customer_name: extractedName,
          loyalty_points: 5,
          current_state: 'category_selection'
        }).select().single();

        profile = newProfile;
        replyText = `✨ Sho, ${extractedName}! Account verified. You just scored 5 Loyalty Points! 🎉\n\n${await buildCategoryMenu(vendor.id)}`;
      } else {
        replyText = `🇿🇦 Yo! Welcome to KasiCart // Nenes Street Kitchen!\n\nWe don't have your number registered yet.\n\nTo setup your profile instantly, reply with:\n"My name is [Your Name]"`;
      }
    } else {
      // Direct Reset Flag
      if (cleanedInput.toLowerCase() === 'reset' || cleanedInput.toLowerCase() === 'menu') {
        await supabase.from('customer_profiles').update({ current_state: 'category_selection', temp_cart_json: null }).eq('id', profile.id);
        replyText = `🔄 Back to main menu!\n\n${await buildCategoryMenu(vendor.id)}`;
      } 
      
      // STATE 1: Choosing a Menu Category
      else if (profile.current_state === 'category_selection' || !profile.current_state) {
        const selectedCatIndex = parseInt(cleanedInput);

        if (!isNaN(selectedCatIndex) && selectedCatIndex > 0) {
          const { data: categories } = await supabase
            .from('menu_categories')
            .select('*')
            .eq('vendor_id', vendor.id)
            .order('display_order', { ascending: true });

          if (categories && categories[selectedCatIndex - 1]) {
            const chosenCategory = categories[selectedCatIndex - 1];

            // Advance state to item selection and store which category they are looking at
            await supabase.from('customer_profiles').update({ 
              current_state: `items_selection:${chosenCategory.id}` 
            }).eq('id', profile.id);

            replyText = await buildItemMenu(vendor.id, chosenCategory.id, chosenCategory.name);
          } else {
            replyText = `⚠️ Out of range. Choose a valid category number:\n\n${await buildCategoryMenu(vendor.id)}`;
          }
        } else {
          replyText = `👋 Hello ${profile.customer_name}!\n\n${await buildCategoryMenu(vendor.id)}`;
        }
      } 
      
      // STATE 2: Browsing Items Inside a Specific Category
      else if (profile.current_state.startsWith('items_selection:')) {
        const categoryId = profile.current_state.split(':')[1];
        const selectedItemIndex = parseInt(cleanedInput);

        if (cleanedInput.toLowerCase() === 'b') {
          // Go back to categories
          await supabase.from('customer_profiles').update({ current_state: 'category_selection' }).eq('id', profile.id);
          replyText = await buildCategoryMenu(vendor.id);
        } else if (!isNaN(selectedItemIndex) && selectedItemIndex > 0) {
          const { data: items } = await supabase
            .from('menu_items')
            .select('*')
            .eq('category_id', categoryId)
            .order('created_at', { ascending: true });

          if (items && items[selectedItemIndex - 1]) {
            const chosenItem = items[selectedItemIndex - 1];
            
            // Build modern interactive cart payload structure
            const totalCart = profile.temp_cart_json || [];
            totalCart.push({ name: chosenItem.name, qty: 1, price: chosenItem.price });

            await supabase.from('customer_profiles').update({
              current_state: 'cart_review',
              temp_cart_json: totalCart
            }).eq('id', profile.id);

            replyText = buildCartReviewText(profile.customer_name, totalCart);
          } else {
            replyText = `⚠️ Item number does not exist. Choose an option from the list or reply *B* to go back.`;
          }
        } else {
          replyText = `Standard text ignored. Please enter an option number or reply *B* to return to main categories.`;
        }
      } 
      
      // STATE 3: Standalone Cart Validation and Smart Interface Triggers
      else if (profile.current_state === 'cart_review') {
        const option = cleanedInput.toLowerCase();

        if (option === '1' || option === 'add') {
          // Send back to category selection to add more meals
          await supabase.from('customer_profiles').update({ current_state: 'category_selection' }).eq('id', profile.id);
          replyText = `➕ Let's add more grub!\n\n${await buildCategoryMenu(vendor.id)}`;
        } else if (option === '2' || option === 'checkout') {
          const activeCart = profile.temp_cart_json || [];

          if (activeCart.length === 0) {
            replyText = `⚠️ Your cart is empty! Let's grab food first.\n\n${await buildCategoryMenu(vendor.id)}`;
          } else {
            // Push structured multi-item order straight onto the live kitchen layout stream
            await supabase.from('orders').insert({
              vendor_id: vendor.id,
              customer_phone: profile.customer_name,
              status: 'incoming',
              items_json: activeCart
            });

            // Flush out session store states completely to safely conclude execution loop
            await supabase.from('customer_profiles').update({
              current_state: 'category_selection',
              temp_cart_json: null
            }).eq('id', profile.id);

            replyText = `🚀 WE FILING IT!\n\nYour order just flew straight onto the chef's dashboard monitor screen.\n\nKeep this chat open—we will drop a text here the exact second your meal hits the roaring grill! 🔥🍟`;
          }
        } else if (option === '3' || option === 'clear') {
          await supabase.from('customer_profiles').update({ current_state: 'category_selection', temp_cart_json: null }).eq('id', profile.id);
          replyText = `🗑️ Cart wiped out completely!\n\n${await buildCategoryMenu(vendor.id)}`;
        } else {
          replyText = `⚠️ Standard action locked out. Reply with:\n*1* to Add More\n*2* to Checkout\n*3* to Clear Cart`;
        }
      }
    }

    // 3. Compile structural output responses
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Message>${replyText}</Message>
    </Response>`;

    return new Response(twimlResponse, {
      headers: { 'Content-Type': 'text/xml' },
      status: 200
    });

  } catch (err: any) {
    console.error("Critical Webhook Failure:", err.message);
    return new Response('Internal Webhook Error', { status: 500 });
  }
}

async function buildCategoryMenu(vendorId: string): Promise<string> {
  const { data: categories } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('display_order', { ascending: true });

  if (!categories || categories.length === 0) {
    return "🍽️ Menu is currently updating. Text back in a few seconds!";
  }

  let text = "📋 NENES KITCHEN SECTIONS:\n\n";
  categories.forEach((cat, idx) => {
    text += `*${idx + 1}* — ${cat.name} 🛒\n`;
  });
  text += `\nReply with the section number to view items (or text *menu* anytime to reset).`;
  return text;
}

async function buildItemMenu(vendorId: string, categoryId: string, categoryName: string): Promise<string> {
  const { data: items } = await supabase
    .from('menu_items')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('category_id', categoryId)
    .order('created_at', { ascending: true });

  let text = `🔥 ${categoryName} SELECTION:\n\n`;
  
  if (!items || items.length === 0) {
    text += `Items currently sold out in this section.\n\n`;
  } else {
    items.forEach((item, idx) => {
      text += `*${idx + 1}*. ${item.name} — R${item.price}\n_${item.description || 'Fresh local prep'}_\n\n`;
    });
  }
  
  text += `Reply with the item number to pack it into your cart, or reply *B* to go back to categories.`;
  return text;
}

function buildCartReviewText(customerName: string, cart: any[]): string {
  let total = 0;
  let summary = `🛒 COCKED & LOADED CART // ${customerName.toUpperCase()}:\n\n`;
  
  cart.forEach((item) => {
    summary += `• 1x ${item.name} (R${item.price})\n`;
    total += parseFloat(item.price);
  });

  summary += `\n*Total Amount:* R${total.toFixed(2)}\n\n`;
  summary += `────────────────────\n`;
  summary += `*1* ➕ Add More Meals\n`;
  summary += `*2* 🚀 Proceed to Checkout\n`;
  summary += `*3* 🗑️ Clear Cart and Restart`;
  
  return summary;
}