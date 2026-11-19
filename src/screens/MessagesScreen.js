import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { authColors as colors } from '../styles/authTheme';
import {
  getConversationsForRole,
  sendMessage,
  subscribeToRealtimeMessages,
} from '../services/chatService';

export default function MessagesScreen({ currentSession, initialConversationId, onBackToNav }) {
  const role = currentSession?.role || 'buyer';
  const userName = currentSession?.full_name || currentSession?.username || 'User';

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef(null);

  const fetchConversations = async () => {
    const list = await getConversationsForRole(role, currentSession?.id);
    setConversations(list);
    setActiveConv((currentActive) => {
      if (!currentActive) {
        if (initialConversationId) {
          return list.find((c) => c.id === initialConversationId) || null;
        }
        return null;
      }
      const updated = list.find((c) => c.id === currentActive.id);
      return updated || currentActive;
    });
  };

  useEffect(() => {
    fetchConversations();

    // 1. Polling interval (every 2.5s) for rock-solid sync across all devices
    const interval = setInterval(fetchConversations, 2500);

    // 2. Instant WebSocket listener for live Supabase broadcasts
    const unsubscribe = subscribeToRealtimeMessages((remoteMsg) => {
      setActiveConv((currentActive) => {
        if (!currentActive || currentActive.id !== remoteMsg.conversation_id) return currentActive;
        const exists = currentActive.messages.some((m) => m.id === remoteMsg.id);
        if (exists) return currentActive;

        const d = new Date(remoteMsg.created_at);
        const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        return {
          ...currentActive,
          messages: [
            ...currentActive.messages,
            {
              id: remoteMsg.id,
              senderRole: remoteMsg.sender_role,
              senderName: remoteMsg.sender_name,
              text: remoteMsg.text,
              timestamp: timeStr,
            },
          ],
        };
      });

      fetchConversations();
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 80);
    });

    return () => {
      clearInterval(interval);
      if (unsubscribe) unsubscribe();
    };
  }, [role, initialConversationId]);

  const handleSelectConversation = (conv) => {
    setActiveConv(conv);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activeConv || sending) return;
    setSending(true);
    try {
      const newMsg = await sendMessage(activeConv.id, {
        senderRole: role,
        senderName: userName,
        text: inputText,
      });
      setInputText('');
      // Update local state
      setActiveConv((prev) => ({
        ...prev,
        messages: [...(prev.messages || []), newMsg],
      }));
      fetchConversations();
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.warn('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const getPartnerDescription = (conv) => {
    if (conv.channelType === 'seller_buyer') {
      return role === 'buyer'
        ? `Direct with Seller: ${conv.participants?.sellerName || 'Owner'}`
        : `Direct with Buyer: ${conv.participants?.buyerName || 'Buyer'}`;
    }
    if (conv.channelType === 'agent_seller') {
      return role === 'seller'
        ? `With Agent: ${conv.participants?.agentName || 'Assigned Agent'}`
        : `With Seller: ${conv.participants?.sellerName || 'Owner'}`;
    }
    if (conv.channelType === 'agent_buyer') {
      return role === 'buyer'
        ? `With Agent: ${conv.participants?.agentName || 'Assigned Agent'}`
        : `With Buyer: ${conv.participants?.buyerName || 'Buyer'}`;
    }
    return 'Discussion';
  };

  // --- THREAD VIEW ---
  if (!activeConv) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <Text style={styles.screenTitle}>
              {role === 'agent' ? 'Enquiries' : 'Messages'}
            </Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{role.toUpperCase()}</Text>
            </View>
          </View>

          {/* Business Rules Explanation Card */}
          <View style={styles.ruleBox}>
            <Text style={styles.ruleTitle}>Communication Protocol</Text>
            <Text style={styles.ruleBody}>
              {role === 'buyer' &&
                '• Properties with Agent: You chat with the assigned Agent.\n• Direct Seller properties: You chat directly with the Owner.'}
              {role === 'seller' &&
                '• Properties with Agent: You coordinate with your Agent.\n• Direct properties: You negotiate directly with Buyers.'}
              {role === 'agent' &&
                '• You represent assigned properties: Chat with Sellers and prospective Buyers.'}
            </Text>
          </View>

          {conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No active conversations yet.</Text>
              <Text style={styles.emptySubtext}>
                {role === 'buyer'
                  ? 'Browse the catalogue to inquire about a property!'
                  : 'Conversations will appear here when buyers or partners contact you.'}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {conversations.map((conv) => {
                const lastMsg = conv.messages[conv.messages.length - 1];
                return (
                  <Pressable
                    key={conv.id}
                    style={styles.convCard}
                    onPress={() => handleSelectConversation(conv)}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.propertyTitle} numberOfLines={1}>
                        {conv.propertyTitle}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          conv.hasAgent ? styles.agentBadge : styles.directBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            conv.hasAgent ? styles.agentBadgeText : styles.directBadgeText,
                          ]}
                        >
                          {conv.hasAgent ? 'With Agent' : 'Direct (No Agent)'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.partnerText}>
                      {getPartnerDescription(conv)}
                    </Text>

                    {lastMsg ? (
                      <View style={styles.lastMsgRow}>
                        <Text style={styles.lastMsgText} numberOfLines={1}>
                          <Text style={{ fontWeight: '600' }}>{lastMsg.senderName}: </Text>
                          {lastMsg.text}
                        </Text>
                        <Text style={styles.timeText}>{lastMsg.timestamp}</Text>
                      </View>
                    ) : (
                      <Text style={styles.noMsgText}>No messages yet. Tap to start chatting.</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- CONVERSATION VIEW ---
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.chatHeader}>
          <Pressable style={styles.backBtn} onPress={() => setActiveConv(null)}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.chatPropertyTitle} numberOfLines={1}>
              {activeConv.propertyTitle}
            </Text>
            <Text style={styles.chatPartnerSub}>
              {getPartnerDescription(activeConv)}
            </Text>
          </View>
        </View>

        {/* Message Feed */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesScroll}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {activeConv.messages.map((msg) => {
            const isMe = msg.senderRole === role;
            return (
              <View
                key={msg.id}
                style={[
                  styles.msgWrapper,
                  isMe ? styles.msgWrapperRight : styles.msgWrapperLeft,
                ]}
              >
                <Text style={styles.senderLabel}>
                  {isMe ? 'You' : `${msg.senderName} (${msg.senderRole})`} · {msg.timestamp}
                </Text>
                <View
                  style={[
                    styles.msgBubble,
                    isMe ? styles.msgBubbleRight : styles.msgBubbleLeft,
                  ]}
                >
                  <Text
                    style={[
                      styles.msgText,
                      isMe ? styles.msgTextRight : styles.msgTextLeft,
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={`Reply as ${role}...`}
            placeholderTextColor="#888"
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <Pressable
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2A2424',
  },
  roleBadge: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2A2424',
  },
  ruleBox: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 4,
  },
  ruleBody: {
    fontSize: 12,
    lineHeight: 18,
    color: '#555555',
  },
  list: {
    gap: 12,
  },
  convCard: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  propertyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A2424',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  agentBadge: {
    borderColor: '#B6311E',
    backgroundColor: '#FFF5F4',
  },
  agentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B6311E',
  },
  directBadge: {
    borderColor: '#2A2424',
    backgroundColor: '#F5F5F5',
  },
  directBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2A2424',
  },
  partnerText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  lastMsgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 8,
  },
  lastMsgText: {
    fontSize: 12,
    color: '#444',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 11,
    color: '#888',
  },
  noMsgText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2A2424',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Active Chat Styles
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2424',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 10,
    backgroundColor: '#FFFFFF',
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2A2424',
  },
  headerInfo: {
    flex: 1,
  },
  chatPropertyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A2424',
  },
  chatPartnerSub: {
    fontSize: 11,
    color: '#666',
  },
  messagesScroll: {
    padding: 16,
    gap: 12,
  },
  msgWrapper: {
    maxWidth: '82%',
  },
  msgWrapperRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  msgWrapperLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderLabel: {
    fontSize: 10,
    color: '#777',
    marginBottom: 3,
  },
  msgBubble: {
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
  },
  msgBubbleRight: {
    backgroundColor: '#B6311E',
    borderColor: '#B6311E',
  },
  msgBubbleLeft: {
    backgroundColor: '#FFFFFF',
    borderColor: '#2A2424',
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18,
  },
  msgTextRight: {
    color: '#FFFFFF',
  },
  msgTextLeft: {
    color: '#2A2424',
  },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2424',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#2A2424',
    backgroundColor: '#FFFFFF',
  },
  sendBtn: {
    backgroundColor: '#B6311E',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

