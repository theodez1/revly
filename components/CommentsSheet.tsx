import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Keyboard, Platform, useWindowDimensions, TextInput } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import rideCommentsService from '../services/supabase/rideCommentsService';
import postsService from '../services/supabase/postsService';

interface CommentUser {
  name: string;
  avatar: string | null;
  id: string;
}

interface Comment {
  id: string;
  user: CommentUser;
  text: string;
  time: string;
}

interface CommentsSheetProps {
  type?: 'ride' | 'post';
  entityId: string;
  onCommentAdded?: (comment: Comment) => void;
}

/**
 * CommentsSheet - Composant réutilisable pour les commentaires
 * @param {Object} props
 * @param {string} props.type - 'ride' ou 'post'
 * @param {string} props.entityId - ID du trajet ou du post
 * @param {Function} props.onCommentAdded - Callback appelé quand un commentaire est ajouté
 */
const CommentsSheet = React.forwardRef<BottomSheetModal, CommentsSheetProps>(({ type = 'ride', entityId, onCommentAdded }, ref) => {
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();
    const navigation = useNavigation<any>();
    const { user: currentUser, profile } = useAuth();
    const snapPoints = useMemo(() => ['75%'], []);
    const [commentText, setCommentText] = useState('');
    const [comments, setComments] = useState<Comment[]>([]);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Using any for the ref because BottomSheetTextInput ref type is complex/not exported easily or compatible with TextInput
    const inputRef = useRef<any>(null);

    // Load comments when entity changes
    useEffect(() => {
        if (entityId) {
            loadComments();
        }
    }, [entityId, type]);

    // Monitor keyboard visibility
    useEffect(() => {
        const keyboardWillShowListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardWillHideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                setKeyboardVisible(false);
                // Snap back to original position when keyboard closes
                if (ref && 'current' in ref && ref.current) {
                    ref.current.snapToIndex(0);
                }
            }
        );

        return () => {
            keyboardWillShowListener.remove();
            keyboardWillHideListener.remove();
        };
    }, []);

    const loadComments = async () => {
        if (!entityId) return;

        setIsLoading(true);
        try {
            let result;
            if (type === 'ride') {
                result = await rideCommentsService.getRideComments(entityId);
            } else {
                result = await postsService.getPostComments(entityId);
            }

            if (result.error) {
                console.error('Erreur chargement commentaires:', result.error);
                return;
            }

            // Format comments to match UI expectations
            const formattedComments: Comment[] = (result.comments || []).map(comment => ({
                id: comment.id,
                user: {
                    name: comment.author || 'Inconnu',
                    avatar: comment.avatar,
                    id: comment.author_id || '' // Assuming author_id might not be on PostComment type but is on RideComment
                },
                text: comment.content,
                time: formatTime(comment.createdAt)
            }));

            setComments(formattedComments);
        } catch (error) {
            console.error('Erreur loadComments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatTime = (timestamp: string) => {
        if (!timestamp) return 'À l\'instant';

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins}min`;
        if (diffHours < 24) return `Il y a ${diffHours}h`;
        if (diffDays === 1) return 'Hier';
        if (diffDays < 7) return `Il y a ${diffDays}j`;

        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    const handleSend = useCallback(async () => {
        if (commentText.trim().length === 0 || !entityId || !currentUser) return;

        const content = commentText.trim();
        setCommentText('');

        // Blur the input to dismiss keyboard and reset sheet position
        if (inputRef.current) {
            inputRef.current.blur();
        } else {
            Keyboard.dismiss();
        }

        try {
            let result;
            if (type === 'ride') {
                result = await rideCommentsService.createRideComment(
                    entityId,
                    currentUser.id,
                    content
                );
            } else {
                result = await postsService.createComment({
                    post_id: entityId,
                    author_id: currentUser.id,
                    content
                });
            }

            if (result.error || !result.comment) {
                console.error('Erreur création commentaire:', result.error);
                return;
            }

            // Add the new comment to the list
            const newComment: Comment = {
                id: result.comment.id,
                user: {
                    // @ts-ignore - Supabase services return slightly different objects sometimes
                    name: result.comment.author || profile?.username || profile?.full_name || currentUser.email || 'Moi', 
                    // @ts-ignore
                    avatar: result.comment.avatar || profile?.avatar_url || null,
                    // @ts-ignore
                    id: result.comment.author_id || currentUser.id
                },
                text: result.comment.content,
                time: 'À l\'instant'
            };

            setComments(prev => [...prev, newComment]);
            onCommentAdded?.(newComment);
        } catch (error) {
            console.error('Erreur handleSend:', error);
        }
    }, [commentText, entityId, currentUser, type, onCommentAdded, profile]);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        []
    );

    const renderCommentItem = (item: Comment) => {
        const canNavigateToProfile = item.user.id && item.user.id !== currentUser?.id;
        
        return (
            <View key={item.id} style={styles.commentItem}>
                <TouchableOpacity
                    onPress={() => {
                        if (canNavigateToProfile) {
                            navigation.navigate('UserProfile', { userId: item.user.id });
                        }
                    }}
                    activeOpacity={canNavigateToProfile ? 0.7 : 1}
                    disabled={!canNavigateToProfile}
                >
                    {item.user.avatar ? (
                        <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarInitial}>
                                {(item.user.name || 'U').charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
                <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                        <TouchableOpacity
                            onPress={() => {
                                if (canNavigateToProfile) {
                                    navigation.navigate('UserProfile', { userId: item.user.id });
                                }
                            }}
                            activeOpacity={canNavigateToProfile ? 0.7 : 1}
                            disabled={!canNavigateToProfile}
                        >
                            <Text style={[styles.userName, canNavigateToProfile && styles.userNameClickable]}>
                                {item.user.name}
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.timeText}>{item.time}</Text>
                    </View>
                    <Text style={styles.commentText}>{item.text}</Text>
                </View>
            </View>
        );
    };

    // Get current user avatar or placeholder
    const renderCurrentUserAvatar = () => {
        if (profile?.avatar_url) {
            return <Image source={{ uri: profile.avatar_url }} style={styles.inputAvatar} />;
        }
        return (
            <View style={styles.inputAvatarPlaceholder}>
                <Text style={styles.inputAvatarInitial}>
                    {(profile?.username || profile?.first_name || currentUser?.email || 'M').charAt(0).toUpperCase()}
                </Text>
            </View>
        );
    };

    return (
        <BottomSheetModal
            ref={ref}
            index={0}
            snapPoints={snapPoints}
            backdropComponent={renderBackdrop}
            enablePanDownToClose={true}
            enableDynamicSizing={false}
            backgroundStyle={styles.background}
            handleIndicatorStyle={styles.indicator}
            keyboardBehavior="interactive"
            android_keyboardInputMode="adjustResize"
            topInset={screenHeight * 0.1}
        >
            <View style={[
                styles.container,
                { paddingBottom: Platform.OS === 'android' ? 0 : (isKeyboardVisible ? 0 : insets.bottom) }
            ]}>
                <View style={styles.header}>
                    <Text style={styles.title}>Commentaires</Text>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{comments.length}</Text>
                    </View>
                </View>

                <BottomSheetScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {isLoading ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Chargement...</Text>
                        </View>
                    ) : comments.length > 0 ? (
                        comments.map(renderCommentItem)
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="chatbubble-ellipses-outline" size={48} color="#E5E7EB" />
                            <Text style={styles.emptyText}>Aucun commentaire pour le moment.</Text>
                            <Text style={styles.emptySubText}>Soyez le premier à réagir !</Text>
                        </View>
                    )}
                </BottomSheetScrollView>

                <View style={styles.inputContainer}>
                    {renderCurrentUserAvatar()}
                    <View style={styles.inputWrapper}>
                        <BottomSheetTextInput
                            ref={inputRef}
                            style={styles.input}
                            placeholder="Ajouter un commentaire..."
                            placeholderTextColor="#9CA3AF"
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                            maxLength={500}
                            returnKeyType="default"
                        />
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            {
                                backgroundColor: commentText.trim().length > 0 ? '#3B82F6' : '#F3F4F6',
                                transform: [{ scale: commentText.trim().length > 0 ? 1 : 0.95 }]
                            }
                        ]}
                        onPress={handleSend}
                        disabled={commentText.trim().length === 0}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="arrow-up"
                            size={20}
                            color={commentText.trim().length > 0 ? '#FFFFFF' : '#D1D5DB'}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </BottomSheetModal>
    );
});

const styles = StyleSheet.create({
    background: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
    },
    indicator: {
        backgroundColor: '#E5E7EB',
        width: 40,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    countBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginLeft: 8,
    },
    countText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4B5563',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 20,
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarInitial: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    commentContent: {
        flex: 1,
    },
    commentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    userName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    userNameClickable: {
        color: '#1E3A8A',
    },
    timeText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    commentText: {
        fontSize: 15,
        color: '#374151',
        lineHeight: 22,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        backgroundColor: '#FFFFFF',
        gap: 12,
    },
    inputAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginBottom: 4,
    },
    inputAvatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    inputAvatarInitial: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    inputWrapper: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 4,
    },
    input: {
        minHeight: 44,
        maxHeight: 100,
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 12,
        fontSize: 15,
        color: '#111827',
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
    },
    emptySubText: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 4,
    },
});

export default CommentsSheet;

