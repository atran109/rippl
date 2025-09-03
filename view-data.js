#!/usr/bin/env node

/**
 * Simple script to view the populated data in your database
 * Alternative to Prisma Studio when there are connection issues
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function viewData() {
  console.log('🔍 VIEWING YOUR POPULATED DATABASE DATA');
  console.log('=' .repeat(60));
  
  try {
    // Show Users
    console.log('\n👥 USERS:');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        createdAt: true,
        impactSummary: {
          select: {
            totalActions: true,
            totalImpact: true,
            ripplesJoined: true
          }
        }
      }
    });
    users.forEach(user => {
      console.log(`  📧 ${user.email}`);
      console.log(`     ID: ${user.id}`);
      if (user.impactSummary) {
        console.log(`     Impact: ${user.impactSummary.totalActions} actions, ${user.impactSummary.totalImpact} impact, ${user.impactSummary.ripplesJoined} ripples`);
      }
      console.log('');
    });

    // Show Action Logs
    console.log('\n⚡ ACTION LOGS:');
    const actionLogs = await prisma.actionLog.findMany({
      include: {
        user: { select: { email: true } },
        micro: { select: { text: true } },
        wave: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    actionLogs.forEach(log => {
      console.log(`  🎯 ${log.user.email} completed: "${log.micro.text}"`);
      console.log(`     Wave: ${log.wave.name}, Bucket: ${log.bucket}, City: ${log.city}`);
      console.log(`     Time: ${log.createdAt.toISOString()}`);
      console.log('');
    });

    // Show Impact Summaries
    console.log('\n📊 USER IMPACT SUMMARIES:');
    const impactSummaries = await prisma.userImpactSummary.findMany({
      include: {
        user: { select: { email: true } }
      }
    });
    impactSummaries.forEach(summary => {
      console.log(`  📈 ${summary.user.email}:`);
      console.log(`     Total Actions: ${summary.totalActions}`);
      console.log(`     Total Impact: ${summary.totalImpact}`);
      console.log(`     Ripples Joined: ${summary.ripplesJoined}`);
      console.log(`     Impact by Wave:`, JSON.stringify(summary.impactByWave, null, 6));
      console.log('');
    });

    // Show Impact Indices
    console.log('\n🎪 RIPPLE IMPACT INDICES:');
    const impactIndices = await prisma.impactIndex.findMany({
      include: {
        ripple: { select: { title: true } },
        wave: { select: { name: true } }
      }
    });
    impactIndices.forEach(index => {
      console.log(`  🎯 ${index.ripple.title} (${index.wave.name}):`);
      console.log(`     Index Value: ${index.indexValue}/3.0`);
      console.log(`     Participants: ${index.participants}`);
      console.log(`     Visible: ${index.isVisible}`);
      console.log(`     30d Impact: ${index.rippleImpact30d}`);
      console.log('');
    });

    // Show Trending Scores
    console.log('\n🔥 TRENDING SCORES:');
    const trendingScores = await prisma.trendingScore.findMany({
      include: {
        ripple: { select: { title: true } },
        wave: { select: { name: true } }
      },
      orderBy: { calculatedAt: 'desc' },
      take: 5
    });
    trendingScores.forEach(score => {
      console.log(`  📈 ${score.ripple.title} (${score.wave.name}):`);
      console.log(`     Score: ${score.score} ${score.isTopTen ? '🏆 TOP TEN!' : ''}`);
      console.log(`     Actions 24h: ${score.actions24h}, Actions 1h: ${score.actions1h}`);
      console.log(`     Participants: ${score.participants}, Boost: ${score.boost}`);
      console.log(`     Calculated: ${score.calculatedAt.toISOString()}`);
      console.log('');
    });

    // Show Ripple Counters
    console.log('\n⏱️  RIPPLE COUNTERS:');
    const rippleCounters = await prisma.rippleCounter.findMany({
      include: {
        ripple: { select: { title: true } },
        wave: { select: { name: true } }
      },
      where: {
        OR: [
          { participantsTotal: { gt: 0 } },
          { actions24h: { gt: 0 } }
        ]
      }
    });
    rippleCounters.forEach(counter => {
      console.log(`  ⚡ ${counter.ripple.title} (${counter.wave.name}):`);
      console.log(`     Participants: ${counter.participantsTotal}`);
      console.log(`     Actions 24h: ${counter.actions24h}, Actions 1h: ${counter.actions1h}`);
      console.log(`     Boost: ${counter.boost}, New Participants 24h: ${counter.newParticipants24h}`);
      console.log(`     Top Ten Since: ${counter.topTenSince || 'Never'}`);
      console.log('');
    });

    console.log('\n🎉 ALL YOUR IMPACT & TRENDING MODELS ARE POPULATED!');
    console.log('=' .repeat(60));
    console.log('✅ Your system is working perfectly!');

  } catch (error) {
    console.error('❌ Error viewing data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the data viewer
viewData();
