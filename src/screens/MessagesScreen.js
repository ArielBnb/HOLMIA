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
import {
  getConversationsForRole,
  sendMessage,
  subscribeToRealtimeMessages,
} from '../services/chatService';

export default function MessagesScreen({ currentSession, initialConversationId }) {
  const role = currentSession?.role || 'buyer';
  const userName = currentSession?.full_name || currentSession?.username || 'User';

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [inputText, setInputText] = useState('');
  const [quickReplies, setQuickReplies] = useState({});
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef(null);

  const fetchConversations = async () => {
    const list = await getConversationsForRole(role, currentSession?.id);
    setConversations(list || []);
    setActiveConv((currentActive) => {
      if (!currentActive) {
        if (initialConversationId) {
          return (list || []).find((c) => c.id === initialConversationId) || null;
        }
        return null;
      }
      const updated = (list || []).find((c) => c.id === currentActive.id);
      return updated || currentActive;
    });
  };

  useEffect(() => {
    const first = setTimeout(fetchConversations, 0);
    const interval = setInterval(fetchConversations, 2500);

    const unsubscribe = subscribeToRealtimeMessages((remoteMsg) => {
      setActiveConv((currentActive) => {
        if (!currentActive || currentActive.id !== remoteMsg.conversation_id) return currentActive;
        const exists = (currentActive.messages || []).some((m) => m.id === remoteMsg.id);
        if (exists) return currentActive;

        const d = new Date(remoteMsg.created_at);
        const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        return {
          ...currentActive,
          messages: [
            ...(currentActive.messages || []),
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
    });

    return () => {
      clearTimeout(first);
      clearInterval(interval);
      if (unsubscribe) unsubscribe();
    };
  }, [role, initialConversationId]);

  const handleSendInThread = async () => {
    if (!inputText.trim() || !activeConv || sending) return;
    setSending(true);
    try {
      const newMsg = await sendMessage(activeConv.id, {
        senderRole: role,
        senderName: userName,
        text: inputText,
      });
      setInputText('');
      setActiveConv((prev) => ({
        ...prev,
        messages: [...(prev.messages || []), newMsg],
      }));
      fetchConversations();
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 80);
    } catch {
      // handled gracefully
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = async (convId) => {
    const text = (quickReplies[convId] || '').trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendMessage(convId, {
        senderRole: role,
        senderName: userName,
        text,
      });
      setQuickReplies((prev) => ({ ...prev, [convId]: '' }));
      await fetchConversations();
    } catch {
      // handled gracefully
    } finally {
      setSending(false);
    }
  };

  const getCounterpartyName = (conv) => {
    if (conv.channelType === 'agent_buyer') {
      return role === 'buyer'
        ? conv.participants?.agentName || 'Assigned Agent'
        : conv.participants?.buyerName || 'Buyer';
    }
    if (conv.channelType === 'agent_seller') {
      return role === 'seller'
        ? conv.participants?.agentName || 'Assigned Agent'
        : conv.participants?.sellerName || 'Seller';
    }
    return role === 'buyer'
      ? conv.participants?.sellerName || 'Seller'
      : conv.participants?.buyerName || 'Buyer';
  };

  // --- LIST VIEW (Figma 17 - Enquiries) ---
  if (!activeConv) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.screenTitle}>
            {role === 'agent' ? 'Enquiries' : 'Messages'}
          </Text>

          {conversations.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No enquiries yet</Text>
              <Text style={styles.emptySub}>
                Conversations will appear here when buyers or sellers message you.
              </Text>
            </View>
          ) : (
            conversations.map((conv) => {
              const msgs = conv.messages || [];
              const lastMsg = msgs[msgs.length - 1];
              const isAnswered = lastMsg && lastMsg.senderRole === role;
              const partnerName = getCounterpartyName(conv);

              return (
                <View key={conv.id} style={styles.card}>
                  <Pressable
                    style={styles.cardHeader}
                    onPress={() => setActiveConv(conv)}
                  >
                    <Text style={styles.buyerName} numberOfLines={1}>
                      {partnerName}
                    </Text>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>
                        {isAnswered ? 'Answered' : 'New'}
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable onPress={() => setActiveConv(conv)}>
                    <Text style={styles.questionText} numberOfLines={2}>
                      {conv.propertyTitle} - {lastMsg ? lastMsg.text : 'No messages yet'}
                    </Text>
                  </Pressable>

                  {/* Figma 17 Inline Reply Input + Primary CTA for New enquiries */}
                  {!isAnswered && (
                    <>
                      <View style={styles.inputBox}>
                        <TextInput
                          style={styles.inputField}
                          placeholder="Reply..."
                          placeholderTextColor="#7A736D"
                          value={quickReplies[conv.id] || ''}
                          onChangeText={(val) =>
                            setQuickReplies((prev) => ({ ...prev, [conv.id]: val }))
                          }
                        />
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={sending || !(quickReplies[conv.id] || '').trim()}
                        style={[
                          styles.primaryBtn,
                          (!(quickReplies[conv.id] || '').trim() || sending) &&
                            styles.primaryBtnDisabled,
                        ]}
                        onPress={() => handleQuickReply(conv.id)}
                      >
                        <Text style={styles.primaryBtnText}>Reply</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- FULL THREAD VIEW ---
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={styles.threadHeader}>
          <Pressable onPress={() => setActiveConv(null)}>
            <Text style={styles.screenTitle} numberOfLines={1}>
              ← {getCounterpartyName(activeConv)}
            </Text>
          </Pressable>
          <Text style={styles.threadSubtitle} numberOfLines={1}>
            {activeConv.propertyTitle}
          </Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.flex1}
          contentContainerStyle={styles.threadMessages}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
        >
          {(activeConv.messages || []).map((msg, idx) => {
            const isMine = msg.senderRole === role;
            return (
              <View
                key={msg.id || idx}
                style={[styles.bubbleWrap, isMine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}
              >
                <Text style={styles.bubbleMeta}>
                  {isMine ? 'You' : msg.senderName} · {msg.timestamp}
                </Text>
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                    {msg.text}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.composerRow}>
          <TextInput
            style={styles.composerInput}
            placeholder="Reply..."
            placeholderTextColor="#7A736D"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSendInThread}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!inputText.trim() || sending}
            style={[
              styles.sendBtn,
              (!inputText.trim() || sending) && styles.primaryBtnDisabled,
            ]}
            onPress={handleSendInThread}
          >
            <Text style={styles.sendBtnText}>Reply</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F6F5F0',
  },
  content: {
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 12,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#292424',
  },
  card: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    padding: 12,
    gap: 6,
    backgroundColor: '#F6F5F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  buyerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#292424',
  },
  pill: {
    backgroundColor: '#F6F5F0',
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#292424',
  },
  questionText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#292424',
  },
  inputBox: {
    height: 48,
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#F6F5F0',
    marginTop: 4,
  },
  inputField: {
    fontSize: 14,
    color: '#292424',
    padding: 0,
  },
  primaryBtn: {
    height: 52,
    backgroundColor: '#B6331E',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F6F5F0',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#292424',
  },
  emptySub: {
    fontSize: 13,
    color: '#66605A',
    textAlign: 'center',
  },
  threadHeader: {
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DDDDDD',
    gap: 2,
  },
  threadSubtitle: {
    fontSize: 13,
    color: '#66605A',
  },
  threadMessages: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  bubbleWrap: {
    maxWidth: '82%',
    gap: 4,
  },
  bubbleWrapMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleWrapOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubbleMeta: {
    fontSize: 11,
    color: '#66605A',
  },
  bubble: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleMine: {
    backgroundColor: '#B6331E',
  },
  bubbleOther: {
    backgroundColor: '#F6F5F0',
    borderWidth: 1,
    borderColor: '#292424',
  },
  bubbleText: {
    fontSize: 14,
    color: '#292424',
  },
  bubbleTextMine: {
    color: '#F6F5F0',
  },
  composerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#DDDDDD',
    backgroundColor: '#F6F5F0',
  },
  composerInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#292424',
    backgroundColor: '#F6F5F0',
  },
  sendBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#B6331E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F6F5F0',
  },
});
