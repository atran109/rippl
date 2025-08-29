import { prisma } from "./src/db.js";
import { redis } from "./src/redis.js";
import { calculateAllTrendingScores, cacheTrendingResults } from "./src/trending.js";
import { calculateRippleImpact, updateRippleSummary } from "./src/impact.js";
import { runAllWorkersOnce } from "./src/workers.js";

async function testTrendingAlgorithm() {
  console.log("🔥 Testing Trending Algorithm...");
  
  try {
    // Get a sample ripple
    const ripple = await prisma.ripple.findFirst();
    if (!ripple) {
      console.log("❌ No ripples found. Run db:seed first.");
      return;
    }
    
    console.log(`📊 Testing with ripple: ${ripple.title}`);
    
    // Simulate some activity
    await redis.hmset(`ripple:${ripple.id}`, {
      participants_total: "15",
      actions_24h: "8",
      actions_1h: "3",
      new_participants_24h: "2",
      boost: "25.5"
    });
    
    // Calculate trending scores
    const scores = await calculateAllTrendingScores();
    console.log(`✅ Calculated trending for ${scores.length} ripples`);
    
    if (scores.length > 0) {
      console.log(`🏆 Top ripple: ${scores[0].rippleId} (score: ${scores[0].score.toFixed(2)})`);
    }
    
  } catch (error) {
    console.error("❌ Trending test failed:", error);
  }
}

async function testImpactCalculation() {
  console.log("📈 Testing Impact Calculation...");
  
  try {
    // Get a ripple with some actions
    const ripple = await prisma.ripple.findFirst({
      include: { wave: true }
    });
    
    if (!ripple) {
      console.log("❌ No ripples found.");
      return;
    }
    
    console.log(`💡 Testing impact for: ${ripple.title} (${ripple.wave.name})`);
    
    // Calculate impact
    const impact = await calculateRippleImpact(ripple.id);
    console.log(`✅ Impact calculated:`);
    console.log(`   - Total actions: ${impact.totalActions}`);
    console.log(`   - Eligible actions: ${impact.eligibleActions}`);
    console.log(`   - Impact value: ${impact.impactValue} ${impact.impactUnit}`);
    
    // Update ripple summary
    await updateRippleSummary(ripple.id);
    console.log(`✅ Ripple summary updated`);
    
  } catch (error) {
    console.error("❌ Impact test failed:", error);
  }
}

async function testWorkers() {
  console.log("⚙️  Testing Background Workers...");
  
  try {
    await runAllWorkersOnce();
    console.log("✅ All workers completed successfully");
  } catch (error) {
    console.error("❌ Worker test failed:", error);
  }
}

async function testRedisConnection() {
  console.log("🔗 Testing Redis Connection...");
  
  try {
    await redis.ping();
    console.log("✅ Redis connection successful");
    
    // Test basic operations
    await redis.set("test:key", "test_value");
    const value = await redis.get("test:key");
    console.log(`✅ Redis read/write test: ${value === "test_value" ? "PASS" : "FAIL"}`);
    
    await redis.del("test:key");
  } catch (error) {
    console.error("❌ Redis test failed:", error);
  }
}

async function testDatabaseSchema() {
  console.log("🗄️  Testing Database Schema...");
  
  try {
    // Test wave buckets
    const waveBuckets = await prisma.waveBucket.count();
    console.log(`✅ WaveBuckets: ${waveBuckets}`);
    
    // Test templates
    const templates = await prisma.template.count();
    console.log(`✅ Templates: ${templates}`);
    
    // Test micro actions with difficulty field
    const microAction = await prisma.microAction.findFirst({
      select: { id: true, text: true, difficulty: true }
    });
    
    if (microAction) {
      console.log(`✅ MicroAction with difficulty: ${microAction.difficulty}`);
    } else {
      console.log("⚠️  No micro actions found");
    }
    
    // Test action logs
    const actionLogs = await prisma.actionLog.count();
    console.log(`✅ ActionLogs: ${actionLogs}`);
    
  } catch (error) {
    console.error("❌ Database schema test failed:", error);
  }
}

async function main() {
  console.log("🚀 Starting Integration Tests...\n");
  
  await testRedisConnection();
  console.log("");
  
  await testDatabaseSchema();
  console.log("");
  
  await testImpactCalculation();
  console.log("");
  
  await testTrendingAlgorithm();
  console.log("");
  
  await testWorkers();
  console.log("");
  
  console.log("🎉 Integration tests completed!");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });