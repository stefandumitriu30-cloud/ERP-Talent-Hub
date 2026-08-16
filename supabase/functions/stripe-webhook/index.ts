import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const PRICE_TO_PLAN: Record<string, string> = {
  'price_1U43Yg3IOXaUYUGZPlMyf7qV': 'pro',
  'price_1U43bp3IOXaUYUGZHRAKTCAV': 'agency',
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret!);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.client_reference_id;

  if (!userId) {
    console.error('No client_reference_id in session');
    return new Response('Missing user ID', { status: 400 });
  }

  let plan = 'pro';
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const priceId = lineItems.data[0]?.price?.id;
    if (priceId && PRICE_TO_PLAN[priceId]) {
      plan = PRICE_TO_PLAN[priceId];
    }
  } catch (e) {
    console.warn('Could not fetch line items:', e);
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      plan,
      verified_by_admin: true,
      trial_started_at: null,
      stripe_customer_id: session.customer as string ?? null,
    })
    .eq('id', userId);

  if (error) {
    console.error('Supabase update failed:', error);
    return new Response('DB update failed', { status: 500 });
  }

  console.log(`Plan ${plan} activated for user ${userId}`);
  return new Response(JSON.stringify({ ok: true, plan, userId }), { status: 200 });
});
