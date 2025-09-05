import 'react-native-gesture-handler';
import 'react-native-reanimated';
import './global.css';
import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text, View } from 'react-native';

import { RootStackParamList } from './src/types/navigation';
import { getToken, api } from './src/lib/api';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import RegistrationScreen from './src/screens/RegistrationScreen';
import WaveSelectionScreen from './src/screens/WaveSelectionScreen';
import HomeScreen from './src/screens/HomeScreen';
import CommunityScreen from './src/screens/CommunityScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

export default function App() {
  const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'onboarding' | 'authenticated'>('loading');

  // Check authentication and onboarding status
  const checkAuthState = useCallback(async () => {
    console.log('🔍 Checking auth state...');
    const token = await getToken();
    console.log('📱 Token exists:', !!token);
    
    if (!token) {
      console.log('❌ No token, setting unauthenticated');
      setAuthState('unauthenticated');
      return;
    }

    try {
      // Check if user has completed onboarding by calling home endpoint
      console.log('🌐 Calling /me/home API...');
      const homeData = await api.getHome();
      console.log('📊 Home data:', homeData);
      
      // Use the has_wave field to determine authentication state
      if (homeData.has_wave === true) {
        console.log('✅ User has joined a wave, setting authenticated');
        setAuthState('authenticated');
      } else if (homeData.has_wave === false) {
        console.log('⏳ User has not joined a wave yet, setting onboarding');
        setAuthState('onboarding');
      } else {
        // Fallback to old logic if has_wave is not provided
        console.log('🔄 Using fallback logic with primary_ripple check');
        if (homeData.primary_ripple) {
          console.log('✅ User has primary ripple, setting authenticated');
          setAuthState('authenticated');
        } else {
          console.log('⏳ User has no primary ripple, setting onboarding');
          setAuthState('onboarding');
        }
      }
    } catch (error) {
      console.error('❌ Home API failed:', error);
      // Token is invalid, remove it and set to unauthenticated
      setAuthState('unauthenticated');
    }
  }, []);

  // Check on app start
  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);


  // Show loading screen while checking auth
  if (authState === 'loading') {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <Text className="text-lg text-gray-600">Loading...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
          <StatusBar style="auto" />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
            }}
          >
            {authState === 'authenticated' ? (
              // Fully authenticated and onboarded users
              <>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Community" component={CommunityScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
              </>
            ) : authState === 'onboarding' ? (
              // Registered but needs to complete onboarding
              <>
                <Stack.Screen name="WaveSelection">
                  {(props) => <WaveSelectionScreen {...props} onComplete={checkAuthState} />}
                </Stack.Screen>
              </>
            ) : (
              // Unauthenticated users
              <>
                <Stack.Screen name="Login">
                  {(props) => <LoginScreen {...props} onComplete={checkAuthState} />}
                </Stack.Screen>
                <Stack.Screen name="Registration">
                  {(props) => <RegistrationScreen {...props} onComplete={checkAuthState} />}
                </Stack.Screen>
              </>
            )}
          </Stack.Navigator>
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
