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
    propertyId: 'a0000000-0000-4000-8000-000000000001',
    propertyTitle: 'Bright Apartment in Central London',
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
        text: 'Hi! Yes, we have 2 registered inquiries. One buyer is preparing an offer close to £420,000.',
        timestamp: '10:22 AM',
      },
    ],
  },
  {
    id: 'conv-prop-1-agent-buyer',
    propertyId: 'a0000000-0000-4000-8000-000000000001',
    propertyTitle: 'Bright Apartment in Central London',
    hasAgent: true,
    channelType: 'agent_buyer', // Agent <-> Buyer
    participants: {
      buyerId: 'user-buyer-1',
      buyerName: 'Demo Buyer',
      agentId: 'user-agent-1',
      agentName: 'Demo Agent',
    },
    messages: [
      {
        id: 'msg-3',
        senderRole: 'buyer',
        senderName: 'Demo Buyer',
        text: 'Good morning, is it possible to schedule a viewing this Saturday?',
        timestamp: '09:40 AM',
      },
      {
        id: 'msg-4',
        senderRole: 'agent',
        senderName: 'Demo Agent',
        text: 'Certainly! I have slots open at 11:00 AM or 2:30 PM. Which works best for you?',
        timestamp: '09:55 AM',
      },
    ],
  },
  {
    id: 'conv-prop-2-seller-buyer',
    propertyId: 'a0000000-0000-4000-8000-000000000002',
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

/**
 * Business Rule Check:
 * - If property HAS an agent:
 *     Buyer <-> Agent : ALLOWED
 *     Seller <-> Agent : ALLOWED
 *     Buyer <-> Seller : FORBIDDEN (Must go through Agent)
 * - If property has NO agent:
 *     Buyer <-> Seller : ALLOWED (Direct communication)
 *     Buyer/Seller <-> Agent : FORBIDDEN (No agent assigned)
 */
export function getChatRoutingRule(property) {
  const hasAgent = Boolean(property.agent_id);
  return {
    hasAgent,
    allowDirectSellerBuyer: !hasAgent,
    allowAgentBuyer: hasAgent,
    allowAgentSeller: hasAgent,
    description: hasAgent
      ? 'This property is represented by an Agent. Buyers and Sellers communicate with the Agent.'
      : 'This property has NO Agent (Direct Seller listing). Buyers communicate directly with the Seller.',
  };
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

export async function startOrFindConversation({ property, userRole, userName }) {
  const all = await loadConversations();
  const hasAgent = Boolean(property.agent_id);
  const normalizedRole = (userRole || 'buyer').toLowerCase();

  let targetChannelType = 'seller_buyer';
  if (hasAgent) {
    targetChannelType = normalizedRole === 'seller' ? 'agent_seller' : 'agent_buyer';
  } else {
    targetChannelType = 'seller_buyer';
  }

  // Check if conversation already exists
  let conv = all.find(
    (c) => c.propertyId === property.id && c.channelType === targetChannelType
  );

  if (!conv) {
    conv = {
      id: `conv-${property.id}-${targetChannelType}-${Date.now()}`,
      propertyId: property.id,
      propertyTitle: property.title,
      hasAgent,
      channelType: targetChannelType,
      participants: {
        sellerId: property.seller_id || 'user-seller-1',
        sellerName: 'Demo Seller',
        agentId: property.agent_id || null,
        agentName: hasAgent ? 'Demo Agent' : null,
        buyerId: normalizedRole === 'buyer' ? 'user-buyer-1' : null,
        buyerName: normalizedRole === 'buyer' ? (userName || 'Demo Buyer') : 'Interested Buyer',
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

