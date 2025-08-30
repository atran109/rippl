import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { api, setToken } from '../lib/api';
import { RootStackParamList } from '../types/navigation';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

interface LoginScreenProps { onComplete?: () => void }

export default function LoginScreen({ onComplete }: LoginScreenProps) {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForm, setShowForm] = useState(false);

  const loginMutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api.login(credentials.email, credentials.password),
    onSuccess: async (data) => {
      await setToken(data.token);
      if (onComplete) {
        // Trigger App-level auth check which switches stacks
        onComplete();
      } else {
        // Fallback: reset to Main
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    },
    onError: (error) => {
      Alert.alert('Login Failed', error.message);
    },
  });

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }
    loginMutation.mutate({ email: email.trim(), password });
  };

  if (!showForm) {
    // Landing screen matching Figma design
    return (
      <View className="flex-1 bg-[#2AABC8]">
        <SafeAreaView className="flex-1">
          {/* Logo */}
          <View className="items-center mt-16 mb-32">
            <Text className="text-white text-4xl font-bold tracking-wider">
              RIPPL
            </Text>
          </View>

          {/* Tagline */}
          <View className="flex-1 justify-center px-8">
            <Text className="text-white text-3xl font-semibold text-center leading-10">
              Better the world in just 5 seconds
            </Text>
          </View>

          {/* Buttons */}
          <View className="px-5 pb-16 space-y-4">
            <TouchableOpacity
              className="bg-white rounded-lg py-4"
              onPress={() => setShowForm(true)}
            >
              <Text className="text-[#2AABC8] text-center font-semibold text-base">
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="border-2 border-white rounded-lg py-4"
              onPress={() => navigation.navigate('Registration')}
            >
              <Text className="text-white text-center font-semibold text-base">
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Login form matching Figma design
  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1">
        {/* Header with back button and logo */}
        <View className="flex-row items-center justify-between px-5 py-[30px]">
          <TouchableOpacity onPress={() => setShowForm(false)} className="w-[26px] h-[26px]">
            <Text className="text-[#2AABC8] text-2xl">←</Text>
          </TouchableOpacity>
          
          {/* RIPPL Logo*/}
          <Image
            source={require('../../assets/rippl-logo.png')}
            className="w-[26px] h-[26px]"
            resizeMode="contain"
          />
          
          <View className="w-[26px]" />
        </View>

        <View className="flex-1 justify-center px-5">
          {/* Title */}
          <View className="items-center mb-[26px]">
            <Text className="text-[#2AABC8] text-[23px] font-bold text-center">
              Welcome Back
            </Text>
          </View>

          {/* Form */}
          <View className="gap-[15px] mb-[15px]">
            <TextInput
              className="bg-[#F4F4F4] p-[13px] rounded-[11px] text-[15px]"
              value={email}
              onChangeText={setEmail}
              placeholder="Email/Username"
              placeholderTextColor="#8A8A8E"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <TextInput
              className="bg-[#F4F4F4] p-[13px] rounded-[11px] text-[15px]"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#8A8A8E"
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {/* Forgot Password */}
          <View className="items-end mb-8">
            <TouchableOpacity>
              <Text className="text-[#007AFF] text-[13px]">
                Forgot Password?
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Action Button */}
        <View className="px-5 pb-8">
          <TouchableOpacity
            className="bg-[#2AABC8] py-[13px] rounded-[10px] items-center justify-center"
            onPress={handleLogin}
            disabled={loginMutation.isPending}
          >
            <Text className="text-white text-[14px] font-semibold">
              {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
