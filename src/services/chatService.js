import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured, getSupabase } from '../config/supabase';

const STORAGE_KEY = '@holmia_messages_v2';

const INITIAL_CONVERSATIONS = [
  {
    id: 'conv-prop-1-agent-seller',
    propertyId: 'prop-1',
    propertyTitle: 'Central London Flat',
    hasAgent: true,
    channelType: 'agent_seller',
    participants: {
      sellerId: 'user-seller-1',
      sellerName: 'Demo Seller',
      agentId: 'user-agent-1',
      agentName: 'Demo Agent',
    },
    messages: [
      {
        id: 'msg-1',
        senderRole: 'seller',
        senderName: 'Demo Seller',
        text: 'Hello, have we received any serious offers on the London flat yet?',
        timestamp: '10:15 AM',
      },
      {
        id: 'msg-2',
        senderRole: 'agent',
        senderName: 'Demo Agent',
        text: 'Hi! Yes, we have an offer of £420,000 from David Smith. Shall we accept or ask for £425,000?',
        timestamp: '10:22 AM',
      },
    ],
  },
  {
    id: 'conv-prop-1-agent-buyer',
    propertyId: 'prop-1',
    propertyTitle: 'Central London Flat',
    hasAgent: true,
    channelType: 'agent_buyer',
    participants: {
      buyerId: 'user-buyer-1',
      buyerName: 'David Smith (Buyer)',
      agentId: 'user-agent-1',
      agentName: 'Demo Agent',
    },
    messages: [
      {
        id: 'msg-3',
        senderRole: 'buyer',
        senderName: 'David Smith',
        text: 'Hello, I submitted an offer of £420,000. Is the owner open to this price?',
        timestamp: '09:40 AM',
      },
      {
        id: 'msg-4',
        senderRole: 'agent',
        senderName: 'Demo Agent',
        text: 'Good morning David! I am presenting your offer to the seller today and will confirm shortly.',
        timestamp: '09:55 AM',
      },
    ],
  },
  {
    id: 'conv-prop-2-seller-buyer',
    propertyId: 'prop-2',
    propertyTitle: 'Spacious Family House in Manchester',
    hasAgent: false,
    channelType: 'seller_buyer',
    participants: {
      sellerId: 'user-seller-1',
      sellerName: 'Demo Seller (Owner)',
      buyerId: 'user-buyer-1',
      buyerName: 'Demo Buyer',
    },
    messages: [
      {
        id: 'msg-5',
        senderRole: 'buyer',
        senderName: 'Demo Buyer',
        text: 'Hello! I noticed there is no agent on this listing. Are you the direct owner?',
        timestamp: 'Yesterday',
      },
      {
        id: 'msg-6',
        senderRole: 'seller',
        senderName: 'Demo Seller (Owner)',
        text: 'Yes indeed, I am selling directly without agency fees. Feel free to ask any questions about the property or garden.',
        timestamp: 'Yesterday',
      },
    ],
  },
];

let inMemoryConversations = null;

async function loadLocalConversations() {
  if (inMemoryConversations) return inMemoryConversations;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      inMemoryConversations = JSON.parse(raw);
      return inMemoryConversations;
    }
  } catch (err) {
    console.warn('AsyncStorage load failed:', err);
  }
  inMemoryConversations = JSON.parse(JSON.stringify(INITIAL_CONVERSATIONS));
  return inMemoryConversations;
}

async function saveLocalConversations(convs) {
  inMemoryConversations = convs;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch (err) {
    console.warn('AsyncStorage save failed:', err);
  }
}

/**
 * Merge remote Supabase messages into local conversations
 */
async function syncFromSupabase(convs) {
  if (!isSupabaseConfigured || !supabase) return convs;
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) return convs;

    data.forEach((remoteMsg) => {
      let targetConv = convs.find((c) => c.id === remoteMsg.conversation_id);
      if (!targetConv) {
        // Create conversation if it was started from another device
        targetConv = {
          id: remoteMsg.conversation_id,
          propertyId: remoteMsg.property_id,
          propertyTitle: remoteMsg.property_title || 'Property',
          hasAgent: true,
          channelType:
            remoteMsg.sender_role === 'buyer' ? 'agent_buyer' : 'agent_seller',
          participants: {
            sellerName: 'Seller',
            agentName: 'Agent',
            buyerName: 'Buyer',
          },
          messages: [],
        };
        convs.unshift(targetConv);
      }

      // Check if message already exists locally
      const alreadyPresent = targetConv.messages.some(
        (m) => m.id === remoteMsg.id || (m.text === remoteMsg.text && m.senderRole === remoteMsg.sender_role)
      );

      if (!alreadyPresent) {
        const d = new Date(remoteMsg.created_at);
        const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        targetConv.messages.push({
          id: remoteMsg.id,
          senderRole: remoteMsg.sender_role,
          senderName: remoteMsg.sender_name,
          text: remoteMsg.text,
          timestamp: timeStr,
        });
      }
    });
  } catch (err) {
    // Graceful fallback if table not yet created
  }
  return convs;
}

export async function getConversationsForRole(role, userId) {
  let all = await loadLocalConversations();
  all = await syncFromSupabase(all);
  const normalizedRole = (role || 'buyer').toLowerCase();

  return all.filter((conv) => {
    if (normalizedRole === 'agent') {
      return conv.channelType === 'agent_seller' || conv.channelType === 'agent_buyer';
    }
    if (normalizedRole === 'seller') {
      return (
        conv.channelType === 'agent_seller' ||
        (conv.channelType === 'seller_buyer' && !conv.hasAgent)
      );
    }
    if (normalizedRole === 'buyer') {
      return (
        conv.channelType === 'agent_buyer' ||
        (conv.channelType === 'seller_buyer' && !conv.hasAgent)
      );
    }
    return false;
  });
}

export async function startOrFindConversation({ property, userRole, userName, targetChannel }) {
  const all = await loadLocalConversations();
  const hasAgent = property.agent_id !== null && property.agent_id !== undefined;
  const normalizedRole = (userRole || 'agent').toLowerCase();

  let targetChannelType = targetChannel;
  if (!targetChannelType) {
    if (hasAgent) {
      targetChannelType = normalizedRole === 'seller' ? 'agent_seller' : 'agent_buyer';
    } else {
      targetChannelType = 'seller_buyer';
    }
  }

  let conv = all.find(
    (c) =>
      (c.propertyId === property.id || c.propertyTitle === property.title) &&
      c.channelType === targetChannelType
  );

  if (!conv) {
    conv = {
      id: `conv-${property.id || 'new'}-${targetChannelType}`,
      propertyId: property.id || `prop-${Date.now()}`,
      propertyTitle: property.title || property.property_title || 'Property',
      hasAgent,
      channelType: targetChannelType,
      participants: {
        sellerId: property.seller_id || 'user-seller-1',
        sellerName: 'Demo Seller',
        agentId: property.agent_id || 'user-agent-1',
        agentName: 'Demo Agent',
        buyerId: 'user-buyer-1',
        buyerName: property.buyer_name || 'Interested Buyer',
      },
      messages: [],
    };
    all.unshift(conv);
    await saveLocalConversations(all);
  }

  return conv;
}

export async function contactAgentForTerms({ property, sellerName }) {
  const all = await loadLocalConversations();
  const propertyTitle = property?.title || 'Pre-Listing Consultation';
  const propertyId = property?.id || `draft-${Date.now()}`;

  let conv = all.find(
    (c) =>
      (c.propertyId === propertyId || c.propertyTitle === propertyTitle) &&
      c.channelType === 'agent_seller'
  );

  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  if (!conv) {
    conv = {
      id: `conv-${propertyId}-agent-seller`,
      propertyId: propertyId,
      propertyTitle: propertyTitle,
      hasAgent: true,
      channelType: 'agent_seller',
      participants: {
        sellerId: property?.seller_id || 'user-seller-1',
        sellerName: sellerName || 'Demo Seller',
        agentId: 'user-agent-1',
        agentName: 'Demo Agent',
      },
      messages: [
        {
          id: `msg-${Date.now()}-1`,
          senderRole: 'seller',
          senderName: sellerName || 'Demo Seller',
          text: `Hello! I am preparing to list "${propertyTitle}". Before officially publishing, I would like to discuss representation terms, agency commission, and valuation strategy.`,
          timestamp: time,
        },
        {
          id: `msg-${Date.now()}-2`,
          senderRole: 'agent',
          senderName: 'Demo Agent',
          text: `Hi! I would be delighted to assist. Our standard agency commission is 1.5% including professional photography, floor plans, and portal marketing. What asking price and timeline did you have in mind?`,
          timestamp: time,
        },
      ],
    };
    all.unshift(conv);
    await saveLocalConversations(all);
  }

  return conv;
}

export async function sendMessage(conversationId, { senderRole, senderName, text }) {
  if (!text || !text.trim()) return null;
  const all = await loadLocalConversations();
  const conv = all.find((c) => c.id === conversationId);
  if (!conv) throw new Error('Conversation not found');

  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  let assignedId = `msg-${Date.now()}`;

  // Send to Supabase live table for real-time multi-device sync
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          property_id: conv.propertyId,
          property_title: conv.propertyTitle,
          sender_role: senderRole,
          sender_name: senderName,
          text: text.trim(),
        })
        .select()
        .single();

      if (data && data.id) {
        assignedId = data.id;
      }
    } catch (err) {
      console.warn('Supabase remote insert fallback to local:', err);
    }
  }

  const newMsg = {
    id: assignedId,
    senderRole,
    senderName,
    text: text.trim(),
    timestamp: time,
  };

  conv.messages.push(newMsg);
  await saveLocalConversations(all);

  return newMsg;
}

export async function notifyOfferAction({ propertyId, propertyTitle, buyerName, amount, action, agentName }) {
  const all = await loadLocalConversations();
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const formattedAmount = Number(amount).toLocaleString('en-GB');

  const sellerText =
    action === 'accepted'
      ? `📢 Offer Accepted: We have accepted the offer of £${formattedAmount} from ${buyerName}. The listing is now Under Offer.`
      : `📢 Offer Rejected: The offer of £${formattedAmount} from ${buyerName} was rejected.`;

  const buyerText =
    action === 'accepted'
      ? `🎉 Great news! Your offer of £${formattedAmount} on "${propertyTitle}" has been ACCEPTED by the seller! The property is now Under Offer.`
      : `Update regarding your offer of £${formattedAmount} on "${propertyTitle}": the offer was not accepted by the seller. Feel free to submit a revised offer.`;

  // 1. Notify Seller
  let sellerConv = all.find(
    (c) =>
      (c.propertyId === propertyId || c.propertyTitle === propertyTitle) &&
      c.channelType === 'agent_seller'
  );
  if (sellerConv) {
    sellerConv.messages.push({
      id: `msg-offer-seller-${Date.now()}`,
      senderRole: 'agent',
      senderName: agentName || 'Demo Agent',
      text: sellerText,
      timestamp: time,
    });
    if (isSupabaseConfigured && supabase) {
      supabase.from('messages').insert({
        conversation_id: sellerConv.id,
        property_id: propertyId,
        property_title: propertyTitle,
        sender_role: 'agent',
        sender_name: agentName || 'Demo Agent',
        text: sellerText,
      }).then(() => {}).catch(() => {});
    }
  }

  // 2. Notify Buyer
  let buyerConv = all.find(
    (c) =>
      (c.propertyId === propertyId || c.propertyTitle === propertyTitle) &&
      c.channelType === 'agent_buyer'
  );
  if (buyerConv) {
    buyerConv.messages.push({
      id: `msg-offer-buyer-${Date.now()}`,
      senderRole: 'agent',
      senderName: agentName || 'Demo Agent',
      text: buyerText,
      timestamp: time,
    });
    if (isSupabaseConfigured && supabase) {
      supabase.from('messages').insert({
        conversation_id: buyerConv.id,
        property_id: propertyId,
        property_title: propertyTitle,
        sender_role: 'agent',
        sender_name: agentName || 'Demo Agent',
        text: buyerText,
      }).then(() => {}).catch(() => {});
    }
  }

  await saveLocalConversations(all);
}

/**
 * Realtime Subscription listener for Supabase
 */
export function subscribeToRealtimeMessages(onNewMessage) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase
    .channel('public_messages_realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        if (payload.new && onNewMessage) {
          onNewMessage(payload.new);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
