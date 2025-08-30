import './global.css';
import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';

import { RootStackParamList } from './src/types/navigation';
import { getToken, api } from './src/lib/api';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import RegistrationScreen from './src/screens/RegistrationScreen';
import WaveSelectionScreen from './src/screens/WaveSelectionScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

export default function App() {
  const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'onboarding' | 'authenticated'>('loading');

  // Check authentication and onboarding status
  const checkAuthState = useCallback(async () => {
    const token = await getToken();
    
    if (!token) {
      setAuthState('unauthenticated');
      return;
    }

    try {
      // Check if user has completed onboarding by calling home endpoint
      const homeData = await api.getHome();
      
      // If they have a primary ripple, they're fully authenticated
      if (homeData.primary_ripple) {
        setAuthState('authenticated');
      } else {
        // They're registered but need to complete onboarding (select a wave)
        setAuthState('onboarding');
      }
    } catch (error) {
      // If home call fails, they might need to complete onboarding
      setAuthState('onboarding');
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
                <Stack.Screen name="Main">
                  {() => (
                    <View className="flex-1 bg-white items-center justify-center">
                      <Text className="text-2xl text-gray-800">Welcome to RIPPL!</Text>
                      <Text className="text-gray-600">Main app coming soon...</Text>
                    </View>
                  )}
                </Stack.Screen>
                {/* More authenticated screens will be added later */}
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
  );
}
