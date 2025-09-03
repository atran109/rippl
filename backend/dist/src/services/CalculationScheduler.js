import { impactCalculationService } from "./impact/ImpactCalculationService.js";
import { trendingCalculationService } from "./trending/TrendingCalculationService.js";
/**
 * Scheduler for running impact and trending calculations
 * This handles the background jobs that keep calculations up to date
 */
export class CalculationScheduler {
    /**
     * Start all scheduled calculation jobs
     */
    start() {
        console.log('🚀 Starting calculation scheduler...');
        // Impact calculations every 30 minutes
        this.impactInterval = setInterval(async () => {
            try {
                console.log('⏰ Running scheduled impact calculations...');
                await impactCalculationService.calculateAllRippleImpacts();
                await impactCalculationService.calculateAllUserImpacts();
            }
            catch (error) {
                console.error('❌ Error in scheduled impact calculations:', error);
            }
        }, 30 * 60 * 1000); // 30 minutes
        // Trending calculations every 10 minutes
        this.trendingInterval = setInterval(async () => {
            try {
                console.log('⏰ Running scheduled trending calculations...');
                await trendingCalculationService.runTrendingCalculationCycle();
            }
            catch (error) {
                console.error('❌ Error in scheduled trending calculations:', error);
            }
        }, 10 * 60 * 1000); // 10 minutes
        // Decay trending counters every hour
        this.decayInterval = setInterval(async () => {
            try {
                console.log('⏰ Running trending decay...');
                await trendingCalculationService.decayTrendingCounters();
            }
            catch (error) {
                console.error('❌ Error in trending decay:', error);
            }
        }, 60 * 60 * 1000); // 1 hour
        console.log('✅ Calculation scheduler started');
        console.log('   - Impact calculations: every 30 minutes');
        console.log('   - Trending calculations: every 10 minutes');
        console.log('   - Trending decay: every hour');
    }
    /**
     * Stop all scheduled jobs
     */
    stop() {
        console.log('🛑 Stopping calculation scheduler...');
        if (this.impactInterval) {
            clearInterval(this.impactInterval);
            this.impactInterval = undefined;
        }
        if (this.trendingInterval) {
            clearInterval(this.trendingInterval);
            this.trendingInterval = undefined;
        }
        if (this.decayInterval) {
            clearInterval(this.decayInterval);
            this.decayInterval = undefined;
        }
        console.log('✅ Calculation scheduler stopped');
    }
    /**
     * Run all calculations immediately (for testing or manual triggers)
     */
    async runAllCalculations() {
        console.log('🚀 Running all calculations immediately...');
        try {
            // Run impact calculations
            await impactCalculationService.calculateAllRippleImpacts();
            await impactCalculationService.calculateAllUserImpacts();
            // Run trending calculations
            await trendingCalculationService.runTrendingCalculationCycle();
            console.log('✅ All calculations completed successfully');
        }
        catch (error) {
            console.error('❌ Error running calculations:', error);
            throw error;
        }
    }
}
// Export singleton instance
export const calculationScheduler = new CalculationScheduler();
