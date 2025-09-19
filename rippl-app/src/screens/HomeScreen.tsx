import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
  Animated,
  PanResponder,
  TextInput,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { MicroAction, TrendingRipple } from '../lib/api';
import { api } from '../lib/api';

const DEFAULT_WAVE_BADGE_COLOR = '#2AABC8';
interface TopBarProps {
  userPoints: number;
}

const TopBar: React.FC<TopBarProps> = ({ userPoints }) => {
  return (
    <View className="flex-row items-center justify-between px-5 py-4">
      {/* RIPPL Logo */}
      <View className="w-[120px] h-8">
        <Image
          source={require('../../assets/rippl-logo.png')}
          className="w-8 h-8"
          resizeMode="contain"
        />
        <Text className="text-[#2AABC8] text-xl font-bold ml-10 -mt-8">RIPPL</Text>
      </View>

      {/* Points and Notifications */}
      <View className="flex-row items-center gap-4">
        {/* User Points */}
        <View className="bg-[#f4f4f4] flex-row items-center px-3 py-2 rounded-[20px]">
          <Ionicons name="person-circle" size={28} color="#2AABC8" />
          <Text className="text-[#2AABC8] text-xl font-medium ml-2">{userPoints}</Text>
        </View>
        
        {/* Notification Bell */}
        <TouchableOpacity className="bg-[#ececec] p-3 rounded-full">
          <Ionicons name="notifications-outline" size={22} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface RippleTabsProps {
  activeTab: 'your' | 'trending';
  onTabChange: (tab: 'your' | 'trending') => void;
}

const RippleTabs: React.FC<RippleTabsProps> = ({ activeTab, onTabChange }) => {
  const handleTabPress = (tab: 'your' | 'trending') => {
    console.log('🔵 Tab pressed:', tab);
    try {
      onTabChange(tab);
      console.log('✅ Tab change successful');
    } catch (error) {
      console.error('❌ Tab change error:', error);
    }
  };

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
      <View style={{ backgroundColor: '#f0f0f0', padding: 4, borderRadius: 16, flexDirection: 'row' }}>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 16,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: activeTab === 'your' ? 'white' : 'transparent',
            shadowColor: activeTab === 'your' ? '#000' : 'transparent',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: activeTab === 'your' ? 2 : 0,
          }}
          onPress={() => handleTabPress('your')}
        >
          <Text style={{
            textAlign: 'center',
            fontWeight: '500',
            fontSize: 16,
            color: activeTab === 'your' ? 'black' : '#9b9b9b'
          }}>
            Your Ripples
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 16,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: activeTab === 'trending' ? 'white' : 'transparent',
            shadowColor: activeTab === 'trending' ? '#000' : 'transparent',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: activeTab === 'trending' ? 2 : 0,
          }}
          onPress={() => handleTabPress('trending')}
        >
          <Text style={{
            textAlign: 'center',
            fontWeight: '500',
            fontSize: 16,
            color: activeTab === 'trending' ? 'black' : '#9b9b9b'
          }}>
            Trending Ripples
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface Ripple {
  id: string;
  title: string;
  participants: number;
  impactIndex: number;
  waveTag: string;
}

interface SwipeableRippleCardsProps {
  ripples: Ripple[];
  onRipplePress: (rippleId: string) => void;
}

const SwipeableRippleCards: React.FC<SwipeableRippleCardsProps> = ({ 
  ripples, 
  onRipplePress 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const panX = useRef(new Animated.Value(0)).current;

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
    },
    onPanResponderGrant: () => {
      // Start fresh without setting offset to avoid buggy behavior
      panX.setValue(0);
    },
    onPanResponderMove: (_, gestureState) => {
      // Only respond to reasonable movements
      if (Math.abs(gestureState.dx) < 300) {
        panX.setValue(gestureState.dx);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      const threshold = 80;
      const velocity = gestureState.vx;
      
      if ((gestureState.dx < -threshold || velocity < -0.5) && currentIndex < ripples.length - 1) {
        // Swipe left - go to next ripple
        setCurrentIndex(currentIndex + 1);
      } else if ((gestureState.dx > threshold || velocity > 0.5) && currentIndex > 0) {
        // Swipe right - go to previous ripple
        setCurrentIndex(currentIndex - 1);
      }
      
      // Always reset position with smooth animation
      Animated.spring(panX, {
        toValue: 0,
        useNativeDriver: false,
        tension: 120,
        friction: 10,
      }).start();
    },
  });

  if (!ripples || ripples.length === 0) {
    return (
      <View className="mx-4 mb-4 p-8 bg-[#f0f0f0] rounded-2xl items-center">
        <Text className="text-gray-500">No ripples available</Text>
      </View>
    );
  }

  const renderCard = (ripple: Ripple, index: number) => {
    const stackOffset = index - currentIndex;
    
    // Only render visible cards (current + 2 behind)
    if (stackOffset < 0 || stackOffset > 2) return null;

    const isActive = stackOffset === 0;
    const translateX = isActive ? panX : stackOffset * 8;
    const scale = 1 - (stackOffset * 0.05);
    const opacity = 1 - (stackOffset * 0.2);

    return (
      <Animated.View 
        key={ripple.id} 
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          zIndex: 10 - stackOffset,
          transform: [
            { translateX },
            { scale }
          ],
          opacity,
        }}
      >
        <TouchableOpacity
          className="bg-[#f0f0f0] p-3 rounded-2xl mx-4"
          onPress={() => isActive && onRipplePress(ripple.id)}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 + stackOffset },
            shadowOpacity: 0.1 - (stackOffset * 0.02),
            shadowRadius: 8 - (stackOffset * 2),
            elevation: 8 - stackOffset,
          }}
        >
          {/* Header with title and wave tag */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-black text-base font-medium flex-1 mr-3">
              {ripple.title}
            </Text>
            <View 
              className="px-1.5 py-0.5 rounded-full border"
              style={{ borderColor: DEFAULT_WAVE_BADGE_COLOR }}
            >
              <Text 
                className="text-[10px] font-normal"
                style={{ color: DEFAULT_WAVE_BADGE_COLOR }}
              >
                {ripple.waveTag}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View className="flex-row items-center justify-center">
            {/* Participants */}
            <View className="items-center flex-1">
              <Text className="text-[#666] text-[12px] font-light">Participants</Text>
              <Text className="text-black text-[27px] font-bold">{ripple.participants}</Text>
            </View>

            {/* Divider */}
            <View className="w-[1px] h-12 bg-gray-300 mx-4" />

            {/* Impact Index */}
            <View className="items-center flex-1">
              <Text className="text-[#666] text-[12px] font-light">Index</Text>
              <Text className="text-black text-[27px] font-bold">{ripple.impactIndex}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View className="mb-2">
      <View 
        {...panResponder.panHandlers}
        style={{ 
          height: 140,
          position: 'relative',
        }}
      >
        {ripples.map((ripple, index) => renderCard(ripple, index))}
      </View>

      {/* Pagination dots */}
      {ripples.length > 1 && (
        <View className="flex-row justify-center mt-3 gap-2">
          {ripples.map((_, index) => (
            <View
              key={index}
              className={`w-2.5 h-2.5 rounded-full ${
                index === currentIndex ? 'bg-[#2AABC8]' : 'bg-gray-300'
              }`}
            />
          ))}
        </View>
      )}
    </View>
  );
};


interface ActionCardProps {
  action: MicroAction;
  onComplete: (note?: string) => void;
}

const ActionCard: React.FC<ActionCardProps> = ({ action, onComplete }) => {
  const [cardState, setCardState] = useState<'initial' | 'started' | 'note'>('initial');
  const [note, setNote] = useState('');

  const handleStartNow = () => {
    setCardState('started');
  };

  const handleComplete = () => {
    onComplete();
    setCardState('initial');
    setNote('');
  };

  const handleAddNote = () => {
    setCardState('note');
  };

  const handleCompleteWithNote = () => {
    onComplete(note);
    setCardState('initial');
    setNote('');
  };

  const handleCancel = () => {
    setCardState('initial');
    setNote('');
  };

  return (
    <View className="mx-5 mb-6">
      <Text className="text-black text-xl font-semibold text-center mb-4">Today's Action</Text>
      
      {/* Gradient Action Card (brand) */}
      <View className="rounded-2xl overflow-hidden">
        <LinearGradient
          colors={["#2AABC8", "#4EC9D9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 20 }}
        >
        {/* Header with count and wave tag */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center">
            <Text className="text-white text-base font-medium mr-1">10</Text>
            <Ionicons name="person" size={18} color="white" />
          </View>
          
          <View className="border border-white px-2 py-0.5 rounded-full">
            <Text className="text-white text-[10px] font-medium">Mental Health</Text>
          </View>
        </View>

        {/* Action Content */}
        <View className="mb-6">
          <Text className="text-white text-2xl font-semibold mb-2">
            {action.text || 'Offer a Helping Hand'}
          </Text>
          <Text className="text-white text-sm font-medium">
            Offer one spontaneous act of kindness today. Carry a bag, share advice, or lend an ear... 
            Your small gesture sends ripples of positivity farther than you think.
          </Text>
        </View>

        {/* Dynamic Action Buttons */}
        {cardState === 'initial' && (
          <TouchableOpacity 
            className="py-3 px-8 rounded-2xl self-start"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
            }}
            onPress={handleStartNow}
          >
            <Text className="text-[#2AABC8] text-lg font-semibold">Start now</Text>
          </TouchableOpacity>
        )}

        {cardState === 'started' && (
          <View className="gap-3">
            <Text className="text-white text-center mb-2">Did you complete this action?</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity 
                className="flex-1 py-3 rounded-xl"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                onPress={handleComplete}
              >
                <Text className="text-[#2AABC8] text-center font-semibold">Complete</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="flex-1 border border-white py-3 rounded-xl"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                onPress={handleAddNote}
              >
                <Text className="text-white text-center font-semibold">Add Note</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              className="py-2 rounded-xl"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              onPress={handleCancel}
            >
              <Text className="text-white/70 text-center">Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {cardState === 'note' && (
          <View className="gap-3">
            <Text className="text-white text-center mb-2">Add a short note (optional)</Text>
            <TextInput
              className="bg-white/95 text-black px-3 py-2 rounded-xl"
              placeholder="What did you do? (0–120 chars)"
              placeholderTextColor="#6b7280"
              value={note}
              onChangeText={setNote}
              maxLength={120}
            />
            <Text className="text-white/70 text-xs text-right">
              {note.length}/120
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity 
                className="flex-1 py-3 rounded-xl"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                onPress={handleCompleteWithNote}
              >
                <Text className="text-[#2AABC8] text-center font-semibold">Save & Complete</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="flex-1 border border-white py-3 rounded-xl"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                onPress={() => setCardState('started')}
              >
                <Text className="text-white text-center font-semibold">Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        </LinearGradient>
      </View>
    </View>
  );
};

interface BottomNavigationProps {
  activeTab: 'home' | 'community' | 'profile';
  onTabChange: (tab: 'home' | 'community' | 'profile') => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <View className="bg-white border-t border-gray-200 pb-8 pt-4">
      <View className="flex-row items-center justify-around px-12">
        <TouchableOpacity 
          className="items-center py-2"
          onPress={() => onTabChange('home')}
        >
          <Ionicons 
            name="home-outline" 
            size={30} 
            color={activeTab === 'home' ? '#2AABC8' : '#666'} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="items-center py-2"
          onPress={() => onTabChange('community')}
        >
          <Ionicons 
            name="people-outline" 
            size={30} 
            color={activeTab === 'community' ? '#2AABC8' : '#666'} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="items-center py-2"
          onPress={() => onTabChange('profile')}
        >
          <Ionicons 
            name="person-outline" 
            size={30} 
            color={activeTab === 'profile' ? '#2AABC8' : '#666'} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const [rippleTab, setRippleTab] = useState<'your' | 'trending'>('your');
  const [bottomTab, setBottomTab] = useState<'home' | 'community' | 'profile'>('home');

  // Debug logging for tab changes
  console.log('🔄 HomeScreen render, rippleTab:', rippleTab);

  // Fetch home data
  const { data: homeData, isLoading, error } = useQuery({
    queryKey: ['home'],
    queryFn: api.getHome,
  });

  // Fetch trending ripples
  const { data: trendingData, isLoading: trendingLoading, error: trendingError } = useQuery({
    queryKey: ['trending-ripples'],
    queryFn: () => api.getTrendingRipples('my_waves', 5),
    enabled: rippleTab === 'trending',
    retry: false,
    throwOnError: false,
  });

  if (trendingError) {
    if (trendingError instanceof Error) {
      console.error('Trending ripples failed:', trendingError.message);
    } else {
      console.error('Trending ripples failed:', trendingError);
    }
  } else if (trendingData) {
    console.log('Trending ripples loaded:', trendingData);
  }

  // Helper function to convert TrendingRipple to Ripple format
  const convertTrendingToRipple = (trending: TrendingRipple): Ripple => ({
    id: trending.ripple.id,
    title: trending.ripple.title,
    participants: trending.participants,
    impactIndex: trending.impact_chip?.value || 0,
    waveTag: trending.wave.name,
  });

  // Mock data for "Your Ripples"
  const mockRipples: Ripple[] = [
    {
      id: '1',
      title: homeData?.primary_ripple?.title || 'Mental Health Advocacy',
      participants: 127,
      impactIndex: 1.02,
      waveTag: homeData?.primary_ripple?.wave?.name || 'Mental Health',
    },
    {
      id: '2', 
      title: 'Community Garden Project',
      participants: 89,
      impactIndex: 0.76,
      waveTag: 'Environment',
    },
    {
      id: '3',
      title: 'Local Food Bank Support',
      participants: 203,
      impactIndex: 1.47,
      waveTag: 'Hunger Relief', 
    },
  ];

  // Create simple mock trending ripples without API dependency
  const mockTrendingRipples: Ripple[] = [
    {
      id: 'trending-1',
      title: 'Trending Mental Health Initiative',
      participants: 89,
      impactIndex: 1.2,
      waveTag: 'Mental Health',
    },
    {
      id: 'trending-2',
      title: 'Community Garden Trending',
      participants: 156,
      impactIndex: 0.8,
      waveTag: 'Environment',
    }
  ];

  // Get ripples based on selected tab
  const currentRipples = rippleTab === 'trending'
    ? (trendingData?.map(convertTrendingToRipple) || mockTrendingRipples)
    : mockRipples;

  // Show loading for trending when appropriate
  const showTrendingLoading = rippleTab === 'trending' && trendingLoading;

  const handleCompleteAction = (note?: string) => {
    // TODO: Call API to complete action with note
    console.log('Completing action with note:', note);
    Alert.alert(
      'Success!', 
      note 
        ? 'Action completed with your note!' 
        : 'Action completed successfully!'
    );
  };

  const handleBottomTabChange = (tab: 'home' | 'community' | 'profile') => {
    setBottomTab(tab);
    // For now, just handle tab state changes
    // TODO: Add navigation when the navigation context issue is resolved
    if (tab === 'community') {
      console.log('Navigate to Community');
    } else if (tab === 'profile') {
      console.log('Navigate to Profile');
    }
    // If home is selected, we're already on the home screen
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-lg text-gray-600">Loading...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-lg text-red-600">Failed to load home data</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Top Bar */}
      <TopBar userPoints={100} />

      {/* Content Container */}
      <View className="flex-1">
        {/* Ripple Tabs */}
        <RippleTabs activeTab={rippleTab} onTabChange={setRippleTab} />

        {/* Swipeable Ripple Cards */}
        <View className="mt-2">
          {showTrendingLoading ? (
            <View className="mx-4 mb-4 p-8 bg-[#f0f0f0] rounded-2xl items-center">
              <Text className="text-gray-500">Loading trending ripples...</Text>
            </View>
          ) : rippleTab === 'trending' && trendingError ? (
            <View className="mx-4 mb-4 p-8 bg-[#f0f0f0] rounded-2xl items-center">
              <Text className="text-gray-500">Unable to load trending ripples</Text>
              <Text className="text-gray-400 text-sm mt-2">Please try again later</Text>
            </View>
          ) : (
            <SwipeableRippleCards
              ripples={currentRipples}
              onRipplePress={(rippleId) => {
                Alert.alert('Coming Soon', `Ripple detail page for ID: ${rippleId} is under development`);
              }}
            />
          )}
        </View>

        {/* Minimal spacer for better balance */}
        <View className="flex-1 min-h-[10px]" />

        {/* Action Card */}
        {homeData?.today_action && (
          <ActionCard
            action={homeData.today_action}
            onComplete={handleCompleteAction}
          />
        )}
      </View>

      {/* Bottom Navigation */}
      <BottomNavigation activeTab={bottomTab} onTabChange={handleBottomTabChange} />
    </SafeAreaView>
  );
}
