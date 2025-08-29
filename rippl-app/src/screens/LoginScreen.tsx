import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { api, setToken } from '../lib/api';
import { RootStackParamList } from '../types/navigation';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForm, setShowForm] = useState(false);

  const loginMutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api.login(credentials.email, credentials.password),
    onSuccess: async (data) => {
      await setToken(data.token);
      // Force app to re-check authentication
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
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
      <View className="flex-1 bg-gradient-to-b from-[#2AABC8] to-[#4A90E2]">
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
              onPress={() => navigation.navigate('Register')}
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

  // Login form
  return (
    <View className="flex-1 bg-gradient-to-b from-[#2AABC8] to-[#4A90E2]">
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-4">
          <TouchableOpacity onPress={() => setShowForm(false)}>
            <Text className="text-white text-lg">← Back</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-1 justify-center px-6">
          {/* Title */}
          <View className="items-center mb-12">
            <Text className="text-white text-3xl font-bold mb-2">Welcome back</Text>
            <Text className="text-white opacity-80 text-center">Sign in to continue your rippl journey</Text>
          </View>

          {/* Form */}
          <View className="space-y-6">
            <View>
              <Text className="text-white font-medium mb-2">Email</Text>
              <TextInput
                className="bg-white bg-opacity-10 border border-white border-opacity-30 rounded-lg px-4 py-4 text-white text-base"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="rgba(255,255,255,0.6)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View>
              <Text className="text-white font-medium mb-2">Password</Text>
              <TextInput
                className="bg-white bg-opacity-10 border border-white border-opacity-30 rounded-lg px-4 py-4 text-white text-base"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="rgba(255,255,255,0.6)"
                secureTextEntry
                autoComplete="password"
              />
            </View>

            <TouchableOpacity
              className={`rounded-lg py-4 mt-8 ${
                loginMutation.isPending ? 'bg-white bg-opacity-50' : 'bg-white'
              }`}
              onPress={handleLogin}
              disabled={loginMutation.isPending}
            >
              <Text className="text-[#2AABC8] text-center font-semibold text-base">
                {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sign up link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-white opacity-80">Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text className="text-white font-semibold">Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}