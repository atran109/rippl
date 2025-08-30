import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { api, type Wave } from '../lib/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Predefined colors for waves
const waveColors = [
  '#289434', // Green - Sustainability
  '#007aff', // Blue - Equality
  '#d9372c', // Red - Justice
  '#a15af4', // Purple - Mental Health/Human Rights
  '#f5af02', // Yellow/Orange - Kindness
  '#51d2c3', // Teal - Climate
  '#3584db', // Light Blue - Diversity
  '#86b817', // Lime Green
  '#ffb155', // Orange
];

// Function to get a consistent color for each wave based on its name
const getWaveColor = (waveName: string): string => {
  // Use a simple hash of the wave name to get consistent color assignment
  const hash = waveName.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return waveColors[Math.abs(hash) % waveColors.length];
};

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps }) => {
  return (
    <View className="flex-row gap-[10px] items-center justify-center w-[310px] h-[5px] mx-auto">
      {Array.from({ length: totalSteps }, (_, index) => (
        <View
          key={index}
          className={`flex-1 h-full rounded-[81px] ${
            index < currentStep ? 'bg-[#2AABC8]' : 'bg-[#EDEDED]'
          }`}
        />
      ))}
    </View>
  );
};

interface WavePillProps {
  wave: Wave;
  color: string;
  isSelected: boolean;
  onSelect: () => void;
}

const WavePill: React.FC<WavePillProps> = ({ wave, color, isSelected, onSelect }) => {
  return (
    <TouchableOpacity
      onPress={onSelect}
      className="rounded-[100px] px-[12px] py-[4px] border-[1px] m-[4px]"
      style={{
        borderColor: color,
        backgroundColor: isSelected ? color + '20' : 'transparent',
        transform: isSelected ? [{ scale: 1.05 }] : [{ scale: 1 }],
      }}
    >
      <Text 
        className="text-[16px]"
        style={{ color: color, letterSpacing: -0.18 }}
      >
        {wave.name}
      </Text>
    </TouchableOpacity>
  );
};

interface WaveSelectionScreenProps {
  onComplete?: () => void;
}

export default function WaveSelectionScreen({ onComplete }: WaveSelectionScreenProps) {
  const navigation = useNavigation<NavigationProp>();
  const [selectedWaveId, setSelectedWaveId] = useState<string | null>(null);

  // Fetch waves from API
  const { data: waves, isLoading, error } = useQuery({
    queryKey: ['waves'],
    queryFn: api.getWaves,
  });

  const handleWaveSelect = (waveId: string) => {
    setSelectedWaveId(waveId);
  };

  const joinWaveMutation = useMutation({
    mutationFn: (waveId: string) => api.joinWave(waveId),
    onSuccess: () => {
      // Wave joined successfully, user is now fully onboarded
      // Refresh the auth state to move to authenticated state
      if (onComplete) {
        onComplete();
      }
    },
    onError: (error) => {
      Alert.alert('Failed to join wave', error.message);
    },
  });

  const handleContinue = () => {
    if (!selectedWaveId) {
      Alert.alert('Please select a wave', 'Choose a purpose that resonates with you');
      return;
    }

    // Join the selected wave to complete onboarding
    joinWaveMutation.mutate(selectedWaveId);
  };

  const handleBack = () => {
    navigation.goBack();
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-lg text-gray-600">Loading waves...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-lg text-red-600">Failed to load waves</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header with back button */}
        <View className="p-5 pt-[30px]">
          <TouchableOpacity onPress={handleBack} className="w-[26px] h-[26px]">
            <Ionicons name="arrow-back" size={26} color="#2AABC8" />
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View className="mb-[50px]">
          <ProgressBar currentStep={4} totalSteps={4} />
        </View>

        {/* Title */}
        <View className="items-center mb-[40px] px-5">
          <Text className="text-[#2AABC8] text-[23px] font-bold text-center" style={{ lineHeight: 28 }}>
            Pick a purpose that resonates with you the most
          </Text>
        </View>

        {/* Wave Selection Pills */}
        <View className="flex-1 px-[37px] mb-[50px]">
          <View className="flex-row flex-wrap justify-start">
            {waves?.map((wave) => (
              <WavePill
                key={wave.id}
                wave={wave}
                color={getWaveColor(wave.name)}
                isSelected={selectedWaveId === wave.id}
                onSelect={() => handleWaveSelect(wave.id)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Continue Button */}
      <View className="px-5 pb-8">
        <TouchableOpacity
          className={`py-[13px] rounded-[10px] items-center justify-center ${
            selectedWaveId && !joinWaveMutation.isPending ? 'bg-[#2AABC8]' : 'bg-gray-300'
          }`}
          onPress={handleContinue}
          disabled={!selectedWaveId || joinWaveMutation.isPending}
        >
          <Text className="text-white text-[15px] font-semibold">
            {joinWaveMutation.isPending ? 'Joining Wave...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
