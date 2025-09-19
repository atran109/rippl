import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { api, type PastMicroActionType, type ProfileStats, type CommunalStats } from '../lib/api';

// Use the backend type directly
type PastMicroAction = PastMicroActionType;

interface ProfileTabsProps {
  activeTab: 'past-actions' | 'individual' | 'communal';
  onTabChange: (tab: 'past-actions' | 'individual' | 'communal') => void;
}

const ProfileTabs: React.FC<ProfileTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
      <View style={{ backgroundColor: '#f0f0f0', padding: 4, borderRadius: 16, flexDirection: 'row' }}>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: activeTab === 'past-actions' ? 'white' : 'transparent',
          }}
          onPress={() => onTabChange('past-actions')}
        >
          <Text style={{
            textAlign: 'center',
            fontWeight: '500',
            fontSize: 14,
            color: activeTab === 'past-actions' ? 'black' : '#9b9b9b'
          }}>
            Past Actions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: activeTab === 'individual' ? 'white' : 'transparent',
          }}
          onPress={() => onTabChange('individual')}
        >
          <Text style={{
            textAlign: 'center',
            fontWeight: '500',
            fontSize: 14,
            color: activeTab === 'individual' ? 'black' : '#9b9b9b'
          }}>
            Individual Impact
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: activeTab === 'communal' ? 'white' : 'transparent',
          }}
          onPress={() => onTabChange('communal')}
        >
          <Text style={{
            textAlign: 'center',
            fontWeight: '500',
            fontSize: 14,
            color: activeTab === 'communal' ? 'black' : '#9b9b9b'
          }}>
            Communal Impact
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface PastActionCardProps {
  action: PastMicroAction;
}

const PastActionCard: React.FC<PastActionCardProps> = ({ action }) => {
  return (
    <View style={{
      backgroundColor: '#f0f0f0',
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
    }}>
      {/* Header with wave tag */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View style={{
          borderWidth: 1,
          borderColor: action.wave_color,
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 12,
        }}>
          <Text style={{
            color: action.wave_color,
            fontSize: 10,
            fontWeight: '500',
          }}>
            {action.wave_name}
          </Text>
        </View>
        <Text style={{
          color: '#9b9b9b',
          fontSize: 12,
        }}>
          {new Date(action.completed_at).toLocaleDateString()}
        </Text>
      </View>

      {/* Action text */}
      <Text style={{
        fontSize: 16,
        fontWeight: '600',
        color: 'black',
        marginBottom: 4,
      }}>
        {action.action_text}
      </Text>

      {/* Ripple title */}
      <Text style={{
        fontSize: 14,
        color: '#666',
        marginBottom: action.note ? 8 : 0,
      }}>
        Ripple: {action.ripple_title}
      </Text>

      {/* Optional note */}
      {action.note && (
        <View style={{
          backgroundColor: 'white',
          borderRadius: 8,
          padding: 12,
        }}>
          <Text style={{
            fontSize: 14,
            color: '#333',
            fontStyle: 'italic',
          }}>
            "{action.note}"
          </Text>
        </View>
      )}
    </View>
  );
};

interface StatsCardProps {
  title: string;
  value: string | number;
  fullWidth?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, fullWidth = false }) => {
  return (
    <View style={{
      backgroundColor: '#ececec',
      borderRadius: 16,
      padding: 12,
      alignItems: 'center',
      flex: fullWidth ? undefined : 1,
      marginHorizontal: fullWidth ? 16 : 6,
      marginBottom: 12,
    }}>
      <Text style={{
        fontSize: 14,
        fontWeight: '500',
        color: '#757575',
        marginBottom: 6,
        textAlign: 'center',
      }}>
        {title}
      </Text>
      <Text style={{
        fontSize: 32,
        fontWeight: 'bold',
        color: '#3584db',
        textAlign: 'center',
      }}>
        {value}
      </Text>
    </View>
  );
};

interface BottomNavigationProps {
  activeTab: 'home' | 'community' | 'profile';
  onTabChange: (tab: 'home' | 'community' | 'profile') => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <View style={{ backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingBottom: 34, paddingTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 48 }}>
        <TouchableOpacity
          style={{ alignItems: 'center', paddingVertical: 8 }}
          onPress={() => onTabChange('home')}
        >
          <Ionicons
            name="home-outline"
            size={30}
            color={activeTab === 'home' ? '#666' : '#666'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={{ alignItems: 'center', paddingVertical: 8 }}
          onPress={() => onTabChange('community')}
        >
          <Ionicons
            name="people-outline"
            size={30}
            color={activeTab === 'community' ? '#666' : '#666'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={{ alignItems: 'center', paddingVertical: 8 }}
          onPress={() => onTabChange('profile')}
        >
          <Ionicons
            name="person-outline"
            size={30}
            color={activeTab === 'profile' ? '#666' : '#666'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState<'past-actions' | 'individual' | 'communal'>('individual');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  const [editedDream, setEditedDream] = useState('');
  const navigation = useNavigation<NavigationProp>();

  // Fetch user profile data (optional - will use fallback if fails)
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
    retry: false,
    throwOnError: false,
  });

  // Fetch home data for wave information
  const { data: homeData } = useQuery({
    queryKey: ['home'],
    queryFn: api.getHome,
  });

  // Fetch real data from backend endpoints
  const { data: pastActions = [], isLoading: pastActionsLoading } = useQuery({
    queryKey: ['pastActions'],
    queryFn: api.getPastActions,
    retry: false,
    throwOnError: false,
  });

  const { data: individualStats, isLoading: individualStatsLoading } = useQuery({
    queryKey: ['profileStats'],
    queryFn: api.getProfileStats,
    retry: false,
    throwOnError: false,
  });

  const { data: communalStats, isLoading: communalStatsLoading } = useQuery({
    queryKey: ['communalStats'],
    queryFn: api.getCommunalStats,
    retry: false,
    throwOnError: false,
  });

  // Provide fallback values if data is not loaded
  const stats = {
    individual: {
      ripples_joined: individualStats?.ripples_joined ?? 0,
      actions_taken: individualStats?.actions_taken ?? 0,
      impact_index: individualStats?.impact_index ?? 0,
    },
    communal: {
      actions_taken: communalStats?.actions_taken ?? 0,
      impact_index: communalStats?.impact_index ?? 0,
    },
  };

  const username = profileData?.username || 'AmbitiousWave';
  const userDream = profileData?.dream || 'This is a short profile description';
  const waveName = homeData?.wave?.name || 'Environment';
  // Fix: Use primary_ripple wave color as fallback since wave doesn't have color property
  const waveColor = homeData?.primary_ripple?.wave?.color || '#2AABC8';

  // Initialize edit state when profile data loads
  React.useEffect(() => {
    if (profileData && !editedUsername && !editedDream) {
      setEditedUsername(profileData.username || '');
      setEditedDream(profileData.dream || '');
    }
  }, [profileData]);

  // Show loading screen if profile data is still loading
  if (profileLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#2AABC8', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 18 }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const handleBottomTabChange = (tab: 'home' | 'community' | 'profile') => {
    if (tab === 'home') {
      navigation.navigate('Home');
    } else if (tab === 'community') {
      navigation.navigate('Community');
    }
    // If profile is selected, we're already on the profile screen
  };

  const handleEditProfile = () => {
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    try {
      let hasUpdates = false;

      // Update username if changed
      if (editedUsername !== profileData?.username) {
        try {
          await api.updateUsername(editedUsername);
          hasUpdates = true;
        } catch (error) {
          console.error('Username update error:', error);
          Alert.alert('Error', 'Failed to update username. It may already be taken.');
          return;
        }
      }

      // Update dream if changed
      if (editedDream !== profileData?.dream) {
        try {
          await api.updateDream(editedDream);
          hasUpdates = true;
        } catch (error) {
          console.error('Dream update error:', error);
          Alert.alert('Error', 'Failed to update description. Please try again.');
          return;
        }
      }

      setIsEditingProfile(false);

      if (hasUpdates) {
        Alert.alert('Success', 'Profile updated successfully!');
        // TODO: Add query invalidation here if using react-query mutations
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
      console.error('Profile update error:', error);
    }
  };

  const handleCancelEdit = () => {
    // Reset to original values
    setEditedUsername(profileData?.username || '');
    setEditedDream(profileData?.dream || '');
    setIsEditingProfile(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'past-actions':
        if (pastActionsLoading) {
          return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#666' }}>Loading past actions...</Text>
            </View>
          );
        }
        return (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {pastActions.length > 0 ? (
              pastActions.map((action) => (
                <PastActionCard key={action.id} action={action} />
              ))
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#666', textAlign: 'center' }}>
                  No past actions found. Complete some actions to see them here!
                </Text>
              </View>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        );

      case 'individual':
        return (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', paddingHorizontal: 10 }}>
              <StatsCard title="Ripples Joined" value={stats.individual.ripples_joined} />
              <StatsCard title="Actions Taken" value={stats.individual.actions_taken} />
            </View>
            <StatsCard title="Overall Impact Index" value={stats.individual.impact_index} fullWidth />
          </View>
        );

      case 'communal':
        return (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', paddingHorizontal: 10 }}>
              <StatsCard title="Actions Taken" value={stats.communal.actions_taken} />
              <StatsCard title="Impact Index" value={stats.communal.impact_index} />
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Top section with gradient background */}
      <View style={{ backgroundColor: '#2AABC8', paddingBottom: 20 }}>
        {/* Header with notification and points */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ width: 32 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* User Points */}
            <View style={{
              backgroundColor: 'rgba(244, 244, 244, 0.8)',
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 16,
            }}>
              <Ionicons name="person-circle" size={23} color="#2AABC8" />
              <Text style={{ color: '#2AABC8', fontSize: 18, fontWeight: '500', marginLeft: 6 }}>100</Text>
            </View>

            {/* Notification Bell */}
            <TouchableOpacity style={{
              backgroundColor: '#ececec',
              padding: 4,
              borderRadius: 16,
              width: 32,
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Ionicons name="notifications-outline" size={18} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Card */}
        <View style={{
          backgroundColor: 'white',
          marginHorizontal: 16,
          marginTop: 20,
          borderRadius: 16,
          padding: 20,
        }}>
          {/* Profile Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            {/* Profile Picture */}
            <View style={{
              width: 73,
              height: 73,
              borderRadius: 37,
              backgroundColor: '#a0f2e8',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 16,
            }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2AABC8' }}>R</Text>
            </View>

            {/* Username and Edit Button */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                {isEditingProfile ? (
                  <TextInput
                    value={editedUsername}
                    onChangeText={setEditedUsername}
                    style={{
                      fontSize: 20,
                      fontWeight: '600',
                      color: 'black',
                      backgroundColor: '#f0f0f0',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      flex: 1,
                      marginRight: 8,
                    }}
                    placeholder="Enter username"
                    maxLength={50}
                  />
                ) : (
                  <Text style={{ fontSize: 20, fontWeight: '600', color: 'black' }}>{username}</Text>
                )}

                {isEditingProfile ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={{
                      backgroundColor: '#2AABC8',
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }} onPress={handleSaveProfile}>
                      <Ionicons name="checkmark" size={16} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity style={{
                      backgroundColor: '#ececec',
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }} onPress={handleCancelEdit}>
                      <Ionicons name="close" size={16} color="#666" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={{
                    backgroundColor: '#ececec',
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }} onPress={handleEditProfile}>
                    <Ionicons name="pencil" size={16} color="#666" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Wave Tags */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{
                  borderWidth: 1,
                  borderColor: waveColor,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 12,
                }}>
                  <Text style={{ color: waveColor, fontSize: 12 }}>{waveName}</Text>
                </View>
                {homeData?.primary_ripple && (
                  <View style={{
                    borderWidth: 1,
                    borderColor: '#358fdb',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 12,
                  }}>
                    <Text style={{ color: '#358fdb', fontSize: 12 }}>Equality</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Profile Description */}
          <View style={{
            backgroundColor: '#ececec',
            borderRadius: 6,
            padding: 12,
          }}>
            {isEditingProfile ? (
              <TextInput
                value={editedDream}
                onChangeText={setEditedDream}
                style={{
                  fontSize: 14,
                  color: 'black',
                  minHeight: 40,
                  textAlignVertical: 'top',
                }}
                placeholder="Share your dream or goal..."
                multiline
                maxLength={200}
              />
            ) : (
              <Text style={{ fontSize: 14, color: 'black' }}>
                {userDream || 'No description yet. Tap edit to add your dream!'}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* White bottom section */}
      <View style={{
        flex: 1,
        backgroundColor: 'white',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        marginTop: -10,
      }}>
        {/* Profile Tabs */}
        <View style={{ paddingTop: 16 }}>
          <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </View>

        {/* Content */}
        {renderContent()}
      </View>

      {/* Bottom Navigation */}
      <BottomNavigation activeTab="profile" onTabChange={handleBottomTabChange} />
    </SafeAreaView>
  );
}