import { prisma } from "../../db.js";
import { redis } from "../../redis.js";
export class TrendingCalculationService {
    /**
     * Sync Redis counters to database RippleCounter
     * This ensures database has the latest real-time data
     */
    async syncRedisToDatabase() {
        console.log('🔄 Syncing Redis counters to database...');
        // Get all ripple counters from database
        const rippleCounters = await prisma.rippleCounter.findMany();
        for (const counter of rippleCounters) {
            const redisKey = `ripple:${counter.rippleId}`;
            try {
                // Get values from Redis (these are updated in real-time by actions)
                const redisData = await redis.hmget(redisKey, 'actions_24h', 'actions_1h', 'boost');
                const actions24h = parseInt(redisData[0] || '0');
                const actions1h = parseInt(redisData[1] || '0');
                const boost = parseFloat(redisData[2] || '0');
                // Get current participant count from database
                const participantsTotal = await prisma.userRipple.count({
                    where: { rippleId: counter.rippleId, isActive: true }
                });
                // Calculate new participants in last 24h
                const newParticipants24h = await prisma.userRipple.count({
                    where: {
                        rippleId: counter.rippleId,
                        isActive: true,
                        joinedAt: {
                            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                        }
                    }
                });
                // Update database counter with optimistic locking
                await prisma.rippleCounter.update({
                    where: {
                        id: counter.id,
                        version: counter.version // Optimistic locking
                    },
                    data: {
                        actions24h,
                        actions1h,
                        participants: participantsTotal,
                        newParticipants24h,
                        version: { increment: 1 },
                        updatedAt: new Date(),
                    },
                });
                console.log(`   Updated counter for ripple ${counter.rippleId}: ${actions24h} actions (24h), ${actions1h} actions (1h), ${boost} boost`);
            }
            catch (error) {
                if (error instanceof Error && 'code' in error && error.code === 'P2025') {
                    // Version conflict - counter was updated by another process, skip
                    console.log(`   ⚠️  Version conflict for ripple ${counter.rippleId}, skipping`);
                }
                else {
                    console.error(`   ❌ Error syncing counter for ripple ${counter.rippleId}:`, error);
                }
            }
        }
        console.log('✅ Redis sync completed');
    }
    /**
     * Calculate trending scores for all ripples
     * Logic: Score = (actions_24h × 2) + (actions_1h × 5) + (participants × 0.5) + boost
     */
    async calculateTrendingScores(calculationType = 'DAILY') {
        console.log('📈 Calculating trending scores...');
        // Get all ripple counters with their ripple and wave info
        const rippleCounters = await prisma.rippleCounter.findMany({
            include: {
                ripple: {
                    include: {
                        wave: true
                    }
                }
            }
        });
        const results = [];
        const scores = [];
        // First pass: calculate all scores
        for (const counter of rippleCounters) {
            // Trending score algorithm
            const score = (counter.actions24h * 2) +
                (counter.actions1h * 5) +
                (counter.participants * 0.5) +
                0;
            scores.push(score);
            results.push({
                rippleId: counter.rippleId,
                score,
                participants: counter.participants,
                actions24h: counter.actions24h,
                actions1h: counter.actions1h,
                newParticipants24h: counter.newParticipants24h,
                boost: 0,
                isTopTen: false, // Will be calculated in second pass
                topTenDays: 0,
            });
        }
        // Calculate top ten threshold (90th percentile or minimum score of 50)
        scores.sort((a, b) => b - a);
        const topTenThreshold = Math.max(scores[Math.min(9, scores.length - 1)] || 0, 50);
        // Second pass: determine top ten status and save scores
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const counter = rippleCounters[i];
            const isTopTen = result.score >= topTenThreshold;
            // Calculate topTenDays (simplified - could be more sophisticated)
            let topTenDays = 0;
            if (isTopTen) {
                // For now, just use a simple calculation based on current score
                topTenDays = Math.min(Math.floor(result.score / 20), 30); // Max 30 days
            }
            result.isTopTen = isTopTen;
            result.topTenDays = topTenDays;
            // Create trending score record
            await prisma.trendingScore.create({
                data: {
                    rippleId: result.rippleId,
                    waveId: counter.waveId,
                    calculationType,
                    score: result.score,
                    participants: result.participants,
                    actions24h: result.actions24h,
                    actions1h: result.actions1h,
                    newParticipants24h: result.newParticipants24h,
                    boost: result.boost,
                    isTopTen,
                    topTenDays,
                }
            });
            // Update ripple counter with version increment
            await prisma.rippleCounter.update({
                where: { id: counter.id },
                data: {
                    version: { increment: 1 }
                }
            });
            console.log(`   Ripple ${counter.ripple.title}: Score ${result.score.toFixed(2)}, ${result.participants} participants, Top Ten: ${isTopTen}`);
        }
        console.log('✅ Trending scores calculated');
        return results;
    }
    /**
     * Update Redis counters when an action is completed
     * This is called from the actions route
     */
    async onActionCompleted(rippleId) {
        const redisKey = `ripple:${rippleId}`;
        try {
            // Increment counters in Redis (real-time updates)
            await redis.hincrby(redisKey, "actions_24h", 1);
            await redis.hincrby(redisKey, "actions_1h", 1);
            await redis.hincrbyfloat(redisKey, "boost", 10); // 10 boost points per action
            // Set expiration for the hash if it's new (24 hours + buffer)
            const exists = await redis.exists(redisKey);
            if (!exists) {
                await redis.expire(redisKey, 25 * 60 * 60); // 25 hours
            }
            console.log(`📊 Updated trending counters for ripple ${rippleId}`);
        }
        catch (error) {
            console.error(`❌ Error updating trending counters for ripple ${rippleId}:`, error);
            // Don't throw - we don't want to break the action completion
        }
    }
    /**
     * Decay trending counters (should be run periodically)
     * This prevents old popular ripples from staying trending forever
     */
    async decayTrendingCounters() {
        console.log('⏰ Decaying trending counters...');
        const rippleCounters = await prisma.rippleCounter.findMany();
        for (const counter of rippleCounters) {
            const redisKey = `ripple:${counter.rippleId}`;
            try {
                // Decay boost by 5% per hour (adjust as needed)
                const currentBoost = parseFloat(await redis.hget(redisKey, 'boost') || '0');
                const newBoost = Math.max(currentBoost * 0.95, 0);
                await redis.hset(redisKey, 'boost', newBoost.toString());
                // Reset hourly counters (this should be called every hour)
                await redis.hset(redisKey, 'actions_1h', '0');
                // Update last decay timestamp
                await prisma.rippleCounter.update({
                    where: { id: counter.id },
                    data: { updatedAt: new Date() }
                });
            }
            catch (error) {
                console.error(`❌ Error decaying counters for ripple ${counter.rippleId}:`, error);
            }
        }
        console.log('✅ Trending counters decayed');
    }
    /**
     * Get current trending ripples for a wave
     */
    async getTrendingRipples(waveId, limit = 10) {
        const whereClause = waveId ? { waveId } : {};
        const latestScores = await prisma.trendingScore.findMany({
            where: {
                ...whereClause,
                calculatedAt: {
                    gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
                }
            },
            orderBy: [
                { score: 'desc' },
                { calculatedAt: 'desc' }
            ],
            take: limit,
            include: {
                ripple: {
                    include: {
                        wave: true
                    }
                }
            }
        });
        return latestScores.map(score => ({
            rippleId: score.rippleId,
            score: score.score,
            participants: score.participants,
            actions24h: score.actions24h,
            actions1h: score.actions1h,
            newParticipants24h: score.newParticipants24h,
            boost: score.boost,
            isTopTen: score.isTopTen,
            topTenDays: score.topTenDays,
        }));
    }
    /**
     * Run complete trending calculation cycle
     * This should be called by a scheduled job (every hour)
     */
    async runTrendingCalculationCycle() {
        console.log('🚀 Running trending calculation cycle...');
        try {
            // Step 1: Sync Redis to database
            await this.syncRedisToDatabase();
            // Step 2: Calculate trending scores
            await this.calculateTrendingScores('HOURLY');
            // Step 3: Decay counters (optional, depending on frequency)
            // await this.decayTrendingCounters();
            console.log('✅ Trending calculation cycle completed');
        }
        catch (error) {
            console.error('❌ Error in trending calculation cycle:', error);
            throw error;
        }
    }
    /**
     * Initialize trending counters for a new ripple
     */
    async initializeRippleCounter(rippleId, waveId) {
        console.log(`🆕 Initializing trending counter for ripple ${rippleId}`);
        // Create database counter
        await prisma.rippleCounter.create({
            data: {
                rippleId,
                waveId,
                participants: 0,
                actions24h: 0,
                actions1h: 0,
                newParticipants24h: 0,
            }
        });
        // Initialize Redis counters
        const redisKey = `ripple:${rippleId}`;
        await redis.hmset(redisKey, {
            'actions_24h': '0',
            'actions_1h': '0',
            'boost': '0'
        });
        await redis.expire(redisKey, 25 * 60 * 60); // 25 hours
        console.log(`✅ Trending counter initialized for ripple ${rippleId}`);
    }
}
// Export singleton instance
export const trendingCalculationService = new TrendingCalculationService();
