import { PrismaClient } from '@prisma/client';

// Use DIRECT_URL for seeding to avoid PgBouncer/port 6543 issues
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL });

// Impact weights based on your plan examples
const IMPACT_WEIGHTS = [
  // Mental Health wave buckets
  { waveName: "Mental Health", bucket: "conversation_checkin", weight: 1.0 },
  { waveName: "Mental Health", bucket: "share_resources", weight: 0.35 },
  { waveName: "Mental Health", bucket: "self_care_moment", weight: 0.0 }, // No impact for self-care
  { waveName: "Mental Health", bucket: "workplace_advocacy", weight: 0.8 }, // Medium impact

  // Environment wave buckets  
  { waveName: "Environment", bucket: "pick_up_litter", weight: 1.0 }, // Full impact - measurable
  { waveName: "Environment", bucket: "bring_reusable", weight: 0.0 }, // Start with 0 until defensible sources
  { waveName: "Environment", bucket: "recycle_correctly", weight: 0.0 }, // Start with 0
  { waveName: "Environment", bucket: "conserve_energy_short", weight: 0.0 }, // Start with 0
  
  // Community & Equity wave buckets
  { waveName: "Community & Equity", bucket: "conscious_purchase", weight: 0.5 }, // Medium impact
  { waveName: "Community & Equity", bucket: "donate_small", weight: 0.8 }, // Higher impact
  { waveName: "Community & Equity", bucket: "share_opportunity", weight: 0.3 }, // Lower impact
  { waveName: "Community & Equity", bucket: "support_bipoc", weight: 1.0 }, // Full impact - direct support
];

export async function seedImpactWeights(): Promise<void> {
  console.log('🌱 Seeding impact weights...');
  
  try {
    let updatedCount = 0;
    
    for (const weightData of IMPACT_WEIGHTS) {
      // Find the wave first
      const wave = await prisma.wave.findUnique({
        where: { name: weightData.waveName }
      });
      
      if (!wave) {
        console.warn(`⚠️  Wave not found: ${weightData.waveName}`);
        continue;
      }
      
      // Check if WaveBucket exists, create if not
      const existingBucket = await prisma.waveBucket.findUnique({
        where: {
          waveId_name: {
            waveId: wave.id,
            name: weightData.bucket
          }
        }
      });
      
      if (existingBucket) {
        // Update weight if different
        if (existingBucket.weight !== weightData.weight) {
          await prisma.waveBucket.update({
            where: {
              waveId_name: {
                waveId: wave.id,
                name: weightData.bucket
              }
            },
            data: { weight: weightData.weight }
          });
          
          console.log(`  ✅ Updated ${weightData.waveName}:${weightData.bucket} weight to ${weightData.weight}`);
          updatedCount++;
        }
      } else {
        // Create new bucket
        await prisma.waveBucket.create({
          data: {
            waveId: wave.id,
            name: weightData.bucket,
            weight: weightData.weight
          }
        });
        
        console.log(`  ✅ Created ${weightData.waveName}:${weightData.bucket} with weight ${weightData.weight}`);
        updatedCount++;
      }
    }
    
    console.log(`✅ Impact weight seeding complete. Updated ${updatedCount} buckets.`);
    
  } catch (error) {
    console.error('❌ Impact weight seeding failed:', error);
    throw error;
  }
}

// Helper function to display current weights
export async function displayCurrentWeights(): Promise<void> {
  console.log('\n📊 Current Impact Weights:');
  
  const waves = await prisma.wave.findMany({
    include: {
      waveBuckets: {
        orderBy: { name: 'asc' }
      }
    },
    orderBy: { name: 'asc' }
  });
  
  for (const wave of waves) {
    console.log(`\n🌊 ${wave.name} (coef: ${wave.impactCoef}, unit: ${wave.impactUnit}):`);
    
    if (wave.waveBuckets.length === 0) {
      console.log('  (no buckets configured)');
    } else {
      wave.waveBuckets.forEach(bucket => {
        const status = bucket.weight === 0 ? '❌' : bucket.weight === 1.0 ? '✅' : '🔸';
        console.log(`  ${status} ${bucket.name}: ${bucket.weight}`);
      });
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedImpactWeights()
    .then(() => displayCurrentWeights())
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}