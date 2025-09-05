import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function ProfileScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#2AABC8" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800">Profile</Text>
        <TouchableOpacity>
          <Ionicons name="settings-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1">
        {/* Profile Info */}
        <View className="items-center py-8 px-4">
          <View className="w-20 h-20 bg-[#2AABC8] rounded-full items-center justify-center mb-4">
            <Ionicons name="person" size={40} color="white" />
          </View>
          <Text className="text-xl font-semibold text-gray-800">Your Profile</Text>
          <Text className="text-gray-600">@username</Text>
        </View>

        {/* Stats */}
        <View className="flex-row mx-4 mb-6">
          <View className="flex-1 bg-[#f0f0f0] p-4 rounded-xl mr-2 items-center">
            <Text className="text-2xl font-bold text-[#2AABC8]">0</Text>
            <Text className="text-xs text-gray-600">Actions</Text>
          </View>
          <View className="flex-1 bg-[#f0f0f0] p-4 rounded-xl mx-2 items-center">
            <Text className="text-2xl font-bold text-[#2AABC8]">0</Text>
            <Text className="text-xs text-gray-600">Ripples</Text>
          </View>
          <View className="flex-1 bg-[#f0f0f0] p-4 rounded-xl ml-2 items-center">
            <Text className="text-2xl font-bold text-[#2AABC8]">0</Text>
            <Text className="text-xs text-gray-600">Impact</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View className="mx-4">
          <TouchableOpacity className="flex-row items-center justify-between py-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text className="ml-3 text-gray-800">Activity History</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between py-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="heart-outline" size={20} color="#666" />
              <Text className="ml-3 text-gray-800">My Waves</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between py-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="trophy-outline" size={20} color="#666" />
              <Text className="ml-3 text-gray-800">Achievements</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between py-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="notifications-outline" size={20} color="#666" />
              <Text className="ml-3 text-gray-800">Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between py-4">
            <View className="flex-row items-center">
              <Ionicons name="help-circle-outline" size={20} color="#666" />
              <Text className="ml-3 text-gray-800">Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Coming Soon Notice */}
        <View className="mx-4 mt-8 bg-[#f0f0f0] p-4 rounded-xl">
          <Text className="text-sm text-gray-700 font-medium mb-2">Profile Features Coming Soon:</Text>
          <Text className="text-xs text-gray-600">• Detailed activity tracking</Text>
          <Text className="text-xs text-gray-600">• Personal impact metrics</Text>
          <Text className="text-xs text-gray-600">• Achievement badges</Text>
          <Text className="text-xs text-gray-600">• Customizable profile</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}