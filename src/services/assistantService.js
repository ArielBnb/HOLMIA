// HOLMIA assistant client. The AI call runs in the Supabase Edge Function
// `holmia-assistant` (supabase/functions/holmia-assistant), which holds the
// Anthropic key and reads data with the signed-in user's own permissions.
import { getSupabase } from '../config/supabase';

export const ASSISTANT_MAX_CHARS = 2000;

// Starter questions per role (shown when the conversation is empty).
export const ASSISTANT_SUGGESTIONS = {
  buyer: [
    'I earn £3,200 a month and want to rent in London. What can I afford?',
    'Find me a family house to buy under £600k with a garden.',
    'Which of my saved listings is the best value?',
  ],
  seller: [
    'Is my asking price right compared with similar listings?',
    'Which offer or rental application should I accept, and why?',
    'Draft replies to my pending enquiries.',
  ],
  agent: [
    'What needs my attention today?',
    'Compare the offers on my listings and recommend one.',
    'Write a polite reply to the latest buyer enquiry.',
  ],
};

export const ASSISTANT_INTRO = {
  buyer: 'Tell me your budget or income, the city and what you are looking for, and I will suggest the best listings for you.',
  seller: 'I can help you price your listings, compare offers and applications, and draft replies to buyers.',
  agent: 'I can prioritise your day, compare offers and applications on your portfolio, and draft messages to buyers and sellers.',
};

// messages: [{ role: 'user' | 'assistant', content: string }]
// Returns { reply, listings: [{ id, title, price, listing_type, ... }] }.
export async function askAssistant(messages) {
  const { data, error } = await getSupabase().functions.invoke('holmia-assistant', {
    body: { messages: messages.map(({ role, content }) => ({ role, content })) },
  });
  if (error) {
    // The function returns { error } with a readable message on 4xx / 5xx.
    let message = '';
    try {
      message = (await error.context?.json?.())?.error || '';
    } catch {
      // ignore unreadable body
    }
    // Function missing (404) or unreachable: on the web a missing function also
    // surfaces as a fetch failure ("Failed to send a request to the Edge Function").
    if (!message && (error.context?.status === 404 || error.name === 'FunctionsFetchError'
      || /not found|404|failed to send/i.test(error.message || ''))) {
      message = 'The assistant is not deployed yet. Deploy the Supabase Edge Function "holmia-assistant" (see README › Assistant IA).';
    }
    throw new Error(message || error.message || 'The assistant could not answer.');
  }
  if (data?.error) throw new Error(data.error);
  return { reply: data?.reply || '', listings: data?.listings || [] };
}
