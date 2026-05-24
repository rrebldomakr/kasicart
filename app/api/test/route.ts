import { NextResponse } from 'next/server';
import { supabase } from '../../utils/supabase';

export async function GET() {
  // 1. Double check if Nenes is already there
  let { data: existingVendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('slug', 'nenes')
    .maybeSingle();

  // 2. If it is missing, force insert it right now
  if (!existingVendor) {
    const { data: insertedData, error: insertError } = await supabase
      .from('vendors')
      .insert([{ slug: 'nenes', name: 'Nenes Street Kitchen', whatsapp_number: '+27712345678' }])
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, message: "Failed to force insert vendor", error: insertError.message });
    }
    existingVendor = insertedData;
  }

  return NextResponse.json({
    success: true,
    message: "Nenes vendor profile verified and active!",
    vendor_details: existingVendor
  });
}