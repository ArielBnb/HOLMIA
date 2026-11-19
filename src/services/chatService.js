import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@holmia_messages_v1';

// Initial mock conversations demonstrating the exact required rules:
// 1. Property with Agent (e.g. prop-1: London Apartment):
//    - Agent <-> Seller chat
//    - Agent <-> Buyer chat
// 2. Property WITHOUT Agent (e.g. prop-2: Manchester House):
//    - Seller <-> Buyer direct chat
const INITIAL_CONVERSATIONS = [
  {
    id: 'conv-prop-1-agent-seller',
    propertyId: 'prop-1',
    propertyTitle: 'Central London Flat',
    hasAgent: true,
    channelType: 'agent_seller', // Agent <-> Seller
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
    channelType: 'agent_buyer', // Agent <-> Buyer
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
    hasAgent: false, // NO AGENT -> Direct conversation
    channelType: 'seller_buyer', // Seller <-> Buyer direct
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

async function loadConversations() {
  if (inMemoryConversations) return inMemoryConversations;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      inMemoryConversations = JSON.parse(raw);
      return inMemoryConversations;
    }
  } catch (err) {
    console.warn('AsyncStorage load failed, using fallback:', err);
  }
  inMemoryConversations = JSON.parse(JSON.stringify(INITIAL_CONVERSATIONS));
  return inMemoryConversations;
}

async function saveConversations(convs) {
  inMemoryConversations = convs;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch (err) {
    console.warn('AsyncStorage save failed:', err);
  }
}

export async function getConversationsForRole(role, userId) {
  const all = await loadConversations();
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
  const all = await loadConversations();
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

  // Check if conversation already exists
  let conv = all.find(
    (c) =>
      (c.propertyId === property.id || c.propertyTitle === property.title) &&
      c.channelType === targetChannelType
  );

  if (!conv) {
    conv = {
      id: `conv-${property.id}-${targetChannelType}-${Date.now()}`,
      propertyId: property.id,
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
    await saveConversations(all);
  }

  return conv;
}

export async function sendMessage(conversationId, { senderRole, senderName, text }) {
  if (!text || !text.trim()) return null;
  const all = await loadConversations();
  const conv = all.find((c) => c.id === conversationId);
  if (!conv) throw new Error('Conversation not found');

  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');

  const newMsg = {
    id: `msg-${Date.now()}`,
    senderRole,
    senderName,
    text: text.trim(),
    timestamp: `${hours}:${minutes}`,
  };

  conv.messages.push(newMsg);
  await saveConversations(all);
  return newMsg;
}

/**
 * Automatically logs a message and dispatches notifications when an offer is Accepted or Rejected.
 * Notifies the Buyer and the Seller in their respective chat channels.
 */
export async function notifyOfferAction({ propertyId, propertyTitle, buyerName, amount, action, agentName }) {
  const all = await loadConversations();
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const formattedAmount = Number(amount).toLocaleString('en-GB');

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
      text:
        action === 'accepted'
          ? `📢 Offer Accepted: We have accepted the offer of £${formattedAmount} from ${buyerName}. The listing is now Under Offer.`
          : `📢 Offer Rejected: The offer of £${formattedAmount} from ${buyerName} was rejected.`,
      timestamp: time,
    });
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
      text:
        action === 'accepted'
          ? `🎉 Great news! Your offer of £${formattedAmount} on "${propertyTitle}" has been ACCEPTED by the seller! The property is now Under Offer.`
          : `Update regarding your offer of £${formattedAmount} on "${propertyTitle}": the offer was not accepted by the seller. Feel free to submit a revised offer.`,
      timestamp: time,
    });
  }

  await saveConversations(all);
}
