import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api, setToken } from '../lib/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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

interface PasswordRequirement {
  text: string;
  isValid: boolean;
}

const validatePassword = (password: string): PasswordRequirement[] => [
  {
    text: '8 or more characters',
    isValid: password.length >= 8,
  },
  {
    text: 'Upper and lowercase letters',
    isValid: /[a-z]/.test(password) && /[A-Z]/.test(password),
  },
  {
    text: 'Numbers and symbols',
    isValid: /\d/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password),
  },
];

interface RegistrationScreenProps {
  onComplete?: () => void;
}

export default function RegistrationScreen({ onComplete }: RegistrationScreenProps) {
  const navigation = useNavigation<NavigationProp>();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const registerMutation = useMutation({
    mutationFn: () => api.register(formData.email, formData.username, formData.password),
    onSuccess: async (data) => {
      // Set the token - this will trigger App.tsx to re-check auth state
      // and show the wave selection screen
      await setToken(data.token || '');
      // Trigger auth state refresh
      if (onComplete) {
        onComplete();
      }
    },
    onError: (error) => {
      Alert.alert('Registration Failed', error.message);
    },
  });

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.email || !formData.email.includes('@')) {
        Alert.alert('Invalid Email', 'Please enter a valid email address');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!formData.username || formData.username.length < 3) {
        Alert.alert('Invalid Username', 'Username must be at least 3 characters long');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        Alert.alert('Invalid Username', 'Username can only contain letters, numbers, and underscores');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      const requirements = validatePassword(formData.password);
      const allRequirementsMet = requirements.every(req => req.isValid);
      
      if (!allRequirementsMet) {
        Alert.alert('Invalid Password', 'Please ensure your password meets all requirements');
        return;
      }
      
      if (formData.password !== formData.confirmPassword) {
        Alert.alert('Password Mismatch', 'Passwords do not match');
        return;
      }
      
      registerMutation.mutate();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View className="flex-1 justify-center px-5">
            <View className="mb-[130px]">
              <ProgressBar currentStep={currentStep} totalSteps={4} />
            </View>
            
            <View className="gap-[26px] items-center">
              <Text className="text-[#2AABC8] text-[23px] font-bold text-center">
                Hello, let's get you started
              </Text>
              
              <View className="w-full gap-[15px]">
                <TextInput
                  className="bg-[#F4F4F4] p-[13px] rounded-[10px] text-[15px]"
                  placeholder="Email"
                  placeholderTextColor="#8A8A8E"
                  value={formData.email}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </View>
        );

      case 2:
        return (
          <View className="flex-1 justify-center px-5">
            <View className="mb-[130px]">
              <ProgressBar currentStep={currentStep} totalSteps={4} />
            </View>
            
            <View className="gap-[26px] items-center">
              <Text className="text-[#2AABC8] text-[23px] font-bold text-center">
                Choose a username
              </Text>
              
              <View className="w-full gap-[15px]">
                <TextInput
                  className="bg-[#F4F4F4] p-[13px] rounded-[10px] text-[15px]"
                  placeholder="Username"
                  placeholderTextColor="#8A8A8E"
                  value={formData.username}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, username: text }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </View>
        );

      case 3:
        const passwordRequirements = validatePassword(formData.password);
        return (
          <View className="flex-1 justify-center px-5">
            <View className="mb-[130px]">
              <ProgressBar currentStep={currentStep} totalSteps={4} />
            </View>
            
            <View className="gap-[26px] items-center">
              <Text className="text-[#2AABC8] text-[23px] font-bold text-center">
                Set a secure password
              </Text>
              
              <View className="w-full gap-[15px]">
                <TextInput
                  className="bg-[#F4F4F4] p-[13px] rounded-[10px] text-[15px]"
                  placeholder="Password"
                  placeholderTextColor="#8A8A8E"
                  value={formData.password}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, password: text }))}
                  secureTextEntry
                  autoCapitalize="none"
                />
                
                <TextInput
                  className="bg-[#F4F4F4] p-[13px] rounded-[10px] text-[15px]"
                  placeholder="Repeat Password"
                  placeholderTextColor="#8A8A8E"
                  value={formData.confirmPassword}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, confirmPassword: text }))}
                  secureTextEntry
                  autoCapitalize="none"
                />

                {formData.password && (
                  <View className="bg-white p-[15px] rounded-[10px] border border-[#B3B3B3]">
                    <Text className="text-black text-[11px] mb-[8px]">
                      The password must contain:
                    </Text>
                    <View className="gap-[5px]">
                      {passwordRequirements.map((requirement, index) => (
                        <View key={index} className="flex-row items-center gap-[8px]">
                          <View className="w-[4px] h-[4px] bg-[#5E5E5E] rounded-full" />
                          <Text className={`text-[11px] ${requirement.isValid ? 'text-green-600' : 'text-[#5E5E5E]'}`}> 
                            {requirement.text}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Back Button */}
          <View className="p-5 pt-[30px]">
            <TouchableOpacity onPress={handleBack} className="w-[26px] h-[26px]">
              <Ionicons name="arrow-back" size={26} color="#2AABC8" />
            </TouchableOpacity>
          </View>

          {renderStepContent()}
        </ScrollView>

        {/* Bottom Action Area */}
        <View className="p-5 gap-[13px]">
          {currentStep === 3 && (
            <Text className="text-[#5E5E5E] text-[13px] text-center">
              By Proceeding, you agree to our{' '}
              <Text className="text-[#007AFF] font-medium">Terms of Service</Text>
              {' '}and{' '}
              <Text className="text-[#007AFF] font-medium">Privacy Policy</Text>
            </Text>
          )}
          
          <TouchableOpacity
            className="bg-[#2AABC8] py-[13px] rounded-[10px] items-center justify-center"
            onPress={handleNext}
            disabled={registerMutation.isPending}
          >
            <Text className="text-white text-[15px] font-semibold">
              {registerMutation.isPending ? 'Creating Account...' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
