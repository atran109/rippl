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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MicroAction } from '../lib/api';
import type { RootStackParamList } from '../types/navigation';
import { api } from '../lib/api';


type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface TopBarProps {
  userPoints: number;
}

const TopBar: React.FC<TopBarProps> = ({ userPoints }) => {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      {/* RIPPL Logo */}
      <View className="w-[104px] h-6">
        <Image
          source={require('../../assets/rippl-logo.png')}
          className="w-6 h-6"
          resizeMode="contain"
        />
        <Text className="text-[#2AABC8] text-lg font-bold ml-8 -mt-6">RIPPL</Text>
      </View>

      {/* Points and Notifications */}
      <View className="flex-row items-center gap-3">
        {/* User Points */}
        <View className="bg-[#f4f4f4] flex-row items-center px-2 py-1 rounded-[18px]">
          <Ionicons name="person-circle" size={23} color="#2AABC8" />
          <Text className="text-[#2AABC8] text-lg font-medium ml-2">{userPoints}</Text>
        </View>
        
        {/* Notification Bell */}
        <TouchableOpacity className="bg-[#ececec] p-2 rounded-full">
          <Ionicons name="notifications-outline" size={18} color="#666" />
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
  return (
    <View className="mx-4 mb-4">
      <View className="bg-[#f0f0f0] p-1 rounded-2xl flex-row">
        <TouchableOpacity
          className={`flex-1 py-3 px-4 rounded-xl ${activeTab === 'your' ? 'bg-white shadow-sm' : ''}`}
          onPress={() => onTabChange('your')}
        >
          <Text className={`text-center font-medium ${activeTab === 'your' ? 'text-black' : 'text-[#9b9b9b]'}`}>
            Your Ripples
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          className={`flex-1 py-3 px-4 rounded-xl ${activeTab === 'trending' ? 'bg-white shadow-sm' : ''}`}
          onPress={() => onTabChange('trending')}
        >
          <Text className={`text-center font-medium ${activeTab === 'trending' ? 'text-black' : 'text-[#9b9b9b]'}`}>
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
  waveColor: string;
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
  const panY = useRef(new Animated.Value(0)).current;

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dy) > 10;
    },
    onPanResponderGrant: () => {
      // Start fresh without setting offset to avoid buggy behavior
      panY.setValue(0);
    },
    onPanResponderMove: (_, gestureState) => {
      // Only respond to reasonable movements
      if (Math.abs(gestureState.dy) < 200) {
        panY.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      const threshold = 50;
      
      if (gestureState.dy > threshold && currentIndex < ripples.length - 1) {
        // Swipe down - go to next ripple
        setCurrentIndex(currentIndex + 1);
      } else if (gestureState.dy < -threshold && currentIndex > 0) {
        // Swipe up - go to previous ripple
        setCurrentIndex(currentIndex - 1);
      }
      
      // Always reset position
      Animated.spring(panY, {
        toValue: 0,
        useNativeDriver: false,
        tension: 150,
        friction: 8,
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
    const translateY = isActive ? panY : stackOffset * 4;
    const scale = 1 - (stackOffset * 0.03);
    const opacity = 1 - (stackOffset * 0.15);

    return (
      <Animated.View 
        key={ripple.id} 
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          zIndex: 10 - stackOffset,
          transform: [
            { translateY },
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
              style={{ borderColor: ripple.waveColor }}
            >
              <Text 
                className="text-[10px] font-normal"
                style={{ color: ripple.waveColor }}
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
    <View className="mb-4">
      <View 
        {...panResponder.panHandlers}
        style={{ 
          height: 120,
          position: 'relative',
        }}
      >
        {ripples.map((ripple, index) => renderCard(ripple, index))}
      </View>

      {/* Pagination dots */}
      {ripples.length > 1 && (
        <View className="flex-row justify-center mt-6 gap-2">
          {ripples.map((_, index) => (
            <View
              key={index}
              className={`w-2 h-2 rounded-full ${
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
    <View className="mx-4 mb-6">
      <Text className="text-black text-lg font-semibold text-center mb-4">Today's Action</Text>
      
      {/* Gradient Action Card (brand) */}
      <View className="rounded-2xl overflow-hidden">
        <LinearGradient
          colors={["#2AABC8", "#4EC9D9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 16 }}
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
    <View className="bg-white border-t border-gray-200 pb-8 pt-3">
      <View className="flex-row items-center justify-around px-12">
        <TouchableOpacity 
          className="items-center"
          onPress={() => onTabChange('home')}
        >
          <Ionicons 
            name="home-outline" 
            size={24} 
            color={activeTab === 'home' ? '#2AABC8' : '#666'} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="items-center"
          onPress={() => onTabChange('community')}
        >
          <Ionicons 
            name="people-outline" 
            size={24} 
            color={activeTab === 'community' ? '#2AABC8' : '#666'} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="items-center"
          onPress={() => onTabChange('profile')}
        >
          <Ionicons 
            name="person-outline" 
            size={24} 
            color={activeTab === 'profile' ? '#2AABC8' : '#666'} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [rippleTab, setRippleTab] = useState<'your' | 'trending'>('your');
  const [bottomTab, setBottomTab] = useState<'home' | 'community' | 'profile'>('home');

  // Fetch home data
  const { data: homeData, isLoading, error } = useQuery({
    queryKey: ['home'],
    queryFn: api.getHome,
  });

  // Mock data for multiple ripples with dynamic colors
  const mockRipples: Ripple[] = [
    {
      id: '1',
      title: homeData?.primary_ripple?.title || 'Mental Health Advocacy',
      participants: 127,
      impactIndex: 1.02,
      waveTag: homeData?.primary_ripple?.wave?.name || 'Mental Health',
      waveColor: '#289434',
    },
    {
      id: '2', 
      title: 'Community Garden Project',
      participants: 89,
      impactIndex: 0.76,
      waveTag: 'Environment',
      waveColor: '#2AABC8',
    },
    {
      id: '3',
      title: 'Local Food Bank Support',
      participants: 203,
      impactIndex: 1.47,
      waveTag: 'Hunger Relief', 
      waveColor: '#E67E22',
    },
  ];

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
    if (tab === 'community') {
      navigation.navigate('Community');
    } else if (tab === 'profile') {
      navigation.navigate('Profile');
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
        <SwipeableRippleCards
          ripples={mockRipples}
          onRipplePress={(rippleId) => {
            Alert.alert('Coming Soon', `Ripple detail page for ID: ${rippleId} is under development`);
          }}
        />

        {/* Spacer to push action card to bottom */}
        <View className="flex-1" />

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
