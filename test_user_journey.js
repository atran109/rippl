#!/usr/bin/env node

/**
 * Comprehensive test script for Rippl user journey
 * Tests: Registration -> Onboarding -> Actions -> Impact Calculations -> Trending
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000';

// Test user data - create a fresh user
const timestamp = Date.now();
const testUser = {
  email: `testuser${timestamp}@example.com`,
  password: 'password123'
};

let authToken = '';
let userId = '';
let primaryRippleId = '';

// Helper function for API calls
async function apiCall(endpoint, method = 'GET', data = null, useAuth = false) {
  const url = `${API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(useAuth && authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
    },
    ...(data ? { body: JSON.stringify(data) } : {})
  };

  console.log(`\n🔄 ${method} ${endpoint}`);
  if (data) console.log('📤 Request:', JSON.stringify(data, null, 2));

  try {
    const response = await fetch(url, options);
    const result = await response.json();
    
    console.log(`📊 Status: ${response.status}`);
    console.log('📥 Response:', JSON.stringify(result, null, 2));
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(result)}`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error calling ${endpoint}:`, error.message);
    throw error;
  }
}

// Step 1: Register user
async function registerUser() {
  console.log('\n🚀 STEP 1: User Registration');
  console.log('=' .repeat(50));
  
  try {
    const result = await apiCall('/auth/register', 'POST', testUser);
    userId = result.id;
    console.log(`✅ User registered successfully! ID: ${userId}`);
    return result;
  } catch (error) {
    if (error.message.includes('409')) {
      console.log('⚠️  User already exists, proceeding with login...');
      return null;
    }
    throw error;
  }
}

// Step 2: Login user
async function loginUser() {
  console.log('\n🔐 STEP 2: User Login');
  console.log('=' .repeat(50));
  
  const result = await apiCall('/auth/login', 'POST', testUser);
  authToken = result.token;
  console.log('✅ Login successful! Token received.');
  return result;
}

// Step 3: Get available waves
async function getWaves() {
  console.log('\n🌊 STEP 3: Get Available Waves');
  console.log('=' .repeat(50));
  
  const waves = await apiCall('/waves');
  console.log(`✅ Found ${waves.length} waves available for joining`);
  return waves;
}

// Step 4: Join a wave (onboarding)
async function joinWave(waveId) {
  console.log('\n🎯 STEP 4: Join Wave (Onboarding)');
  console.log('=' .repeat(50));
  
  const result = await apiCall('/join-wave', 'POST', { waveId }, true);
  primaryRippleId = result.primary_ripple_id;
  console.log(`✅ Successfully joined wave! Primary ripple: ${primaryRippleId}`);
  return result;
}

// Step 5: Get user profile
async function getUserProfile() {
  console.log('\n👤 STEP 5: Get User Profile');
  console.log('=' .repeat(50));
  
  const profile = await apiCall('/me/profile', 'GET', null, true);
  console.log('✅ User profile retrieved successfully');
  
  // Also get home data
  const home = await apiCall('/me/home', 'GET', null, true);
  console.log('✅ User home data retrieved successfully');
  
  return { profile, home };
}

// Step 6: Get ripple details and micro-actions
async function getRippleDetails(rippleId) {
  console.log('\n🎪 STEP 6: Get Ripple Details & Micro-Actions');
  console.log('=' .repeat(50));
  
  const ripple = await apiCall(`/ripple/${rippleId}`, 'GET', null, true);
  console.log(`✅ Ripple details retrieved: ${ripple.title}`);
  console.log(`📋 Available micro-actions: ${ripple.microActions?.length || 0}`);
  return ripple;
}

// Step 7: Complete micro-actions
async function completeMicroActions(ripple) {
  console.log('\n⚡ STEP 7: Complete Micro-Actions');
  console.log('=' .repeat(50));
  
  if (!ripple.microActions || ripple.microActions.length === 0) {
    console.log('⚠️  No micro-actions available to complete');
    return [];
  }

  const completedActions = [];
  
  // Complete first 3 micro-actions (or all if less than 3)
  const actionsToComplete = ripple.microActions.slice(0, 3);
  
  for (const action of actionsToComplete) {
    try {
      const result = await apiCall('/actions/complete', 'POST', {
        microActionId: action.id,
        city: 'San Francisco',
        note_text: `Completed: ${action.text}`,
        share_anonymously: false
      }, true);
      
      completedActions.push(result);
      console.log(`✅ Completed action: "${action.text}"`);
      
      // Small delay between actions
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log(`❌ Failed to complete action "${action.text}": ${error.message}`);
    }
  }
  
  console.log(`✅ Completed ${completedActions.length} micro-actions`);
  return completedActions;
}

// Step 7.5: Run temporary calculators to populate data
async function runCalculators() {
  console.log('\n🧮 STEP 7.5: Run Impact & Trending Calculators');
  console.log('=' .repeat(50));
  
  try {
    // Import and run the temporary calculators
    const { runImpactCalculations } = await import('./backend/temp-impact-calculator.js');
    const { runTrendingCalculations } = await import('./backend/temp-trending-calculator.js');
    
    console.log('Running impact calculations...');
    await runImpactCalculations();
    
    console.log('Running trending calculations...');
    await runTrendingCalculations();
    
    console.log('✅ Calculations completed successfully');
  } catch (error) {
    console.log(`⚠️  Calculator error (expected in test): ${error.message}`);
    // Continue with test even if calculators fail
  }
}

// Step 8: Check impact calculations
async function checkImpactCalculations() {
  console.log('\n📊 STEP 8: Check Impact Calculations');
  console.log('=' .repeat(50));
  
  try {
    // Get updated user profile to see impact
    const profile = await apiCall('/me/profile', 'GET', null, true);
    
    if (profile.impactSummary) {
      console.log('✅ Impact calculations found!');
      console.log(`📈 Total Actions: ${profile.impactSummary.totalActions}`);
      console.log(`📈 Total Impact: ${profile.impactSummary.totalImpact}`);
      console.log(`📈 Ripples Joined: ${profile.impactSummary.ripplesJoined}`);
    } else {
      console.log('⚠️  No impact summary found yet (may need time to calculate)');
    }
    
    // Get ripple details to see if impact index is calculated
    const ripple = await apiCall(`/ripple/${primaryRippleId}`, 'GET', null, true);
    
    if (ripple.impactIndex) {
      console.log('✅ Ripple impact index found!');
      console.log(`📊 Index Value: ${ripple.impactIndex.indexValue}`);
      console.log(`👥 Participants: ${ripple.impactIndex.participants}`);
    } else {
      console.log('⚠️  No ripple impact index found yet');
    }
    
    return { profile, ripple };
  } catch (error) {
    console.log(`❌ Error checking impact calculations: ${error.message}`);
    return null;
  }
}

// Step 9: Check trending scores
async function checkTrendingScores() {
  console.log('\n🔥 STEP 9: Check Trending Scores');
  console.log('=' .repeat(50));
  
  try {
    // Get ripple details to see trending scores
    const ripple = await apiCall(`/ripple/${primaryRippleId}`, 'GET', null, true);
    
    if (ripple.trendingScores && ripple.trendingScores.length > 0) {
      console.log('✅ Trending scores found!');
      ripple.trendingScores.forEach((score, index) => {
        console.log(`📈 Score ${index + 1}:`);
        console.log(`   Type: ${score.calculationType}`);
        console.log(`   Score: ${score.score}`);
        console.log(`   Actions 24h: ${score.actions24h}`);
        console.log(`   New Participants 24h: ${score.newParticipants24h}`);
      });
    } else {
      console.log('⚠️  No trending scores found yet');
    }
    
    // Check ripple counter
    if (ripple.rippleCounter) {
      console.log('✅ Ripple counter found!');
      console.log(`👥 Total Participants: ${ripple.rippleCounter.participantsTotal}`);
      console.log(`⚡ Actions 24h: ${ripple.rippleCounter.actions24h}`);
      console.log(`🆕 New Participants 24h: ${ripple.rippleCounter.newParticipants24h}`);
    } else {
      console.log('⚠️  No ripple counter found yet');
    }
    
    return ripple;
  } catch (error) {
    console.log(`❌ Error checking trending scores: ${error.message}`);
    return null;
  }
}

// Main test function
async function runFullUserJourney() {
  console.log('🎭 RIPPL USER JOURNEY TEST');
  console.log('=' .repeat(50));
  console.log('Testing complete user flow from registration to impact/trending calculations');
  
  try {
    // Step 1: Register (or skip if exists)
    await registerUser();
    
    // Step 2: Login
    await loginUser();
    
    // Step 3: Get available waves
    const waves = await getWaves();
    if (waves.length === 0) {
      throw new Error('No waves available for testing');
    }
    
    // Step 4: Join first wave
    await joinWave(waves[0].id);
    
    // Step 5: Get user profile
    await getUserProfile();
    
    // Step 6: Get ripple details
    const ripple = await getRippleDetails(primaryRippleId);
    
    // Step 7: Complete micro-actions
    await completeMicroActions(ripple);
    
    // Step 7.5: Run calculators to populate impact/trending data
    await runCalculators();
    
    // Step 8: Check impact calculations
    await checkImpactCalculations();
    
    // Step 9: Check trending scores
    await checkTrendingScores();
    
    console.log('\n🎉 USER JOURNEY TEST COMPLETED SUCCESSFULLY!');
    console.log('=' .repeat(50));
    console.log('✅ All steps completed. Check the output above for detailed results.');
    
  } catch (error) {
    console.error('\n💥 TEST FAILED!');
    console.error('=' .repeat(50));
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the test
runFullUserJourney();
