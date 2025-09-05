import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function CommunityScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#2AABC8" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800">Community</Text>
        <View className="w-6" />
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center px-4">
        <Ionicons name="people-outline" size={80} color="#E0E0E0" />
        <Text className="text-2xl font-semibold text-gray-800 mt-4 mb-2">
          Community
        </Text>
        <Text className="text-gray-600 text-center mb-8">
          This feature is coming soon!
        </Text>
        
        <View className="bg-[#f0f0f0] p-4 rounded-xl w-full">
          <Text className="text-sm text-gray-700 font-medium mb-2">Coming Soon:</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}