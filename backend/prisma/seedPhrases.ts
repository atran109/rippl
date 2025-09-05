import { PrismaClient } from '@prisma/client';

// Use DIRECT_URL for seeding to avoid PgBouncer/port 6543 issues
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL });

// Initial phrase data to seed the database
const PHRASE_DATA = [
  // Mental Health wave phrases
  {
    waveName: "Mental Health",
    bucket: "conversation_checkin", 
    phrase: "asked {audience} how they're really doing",
    priority: 1
  },
  {
    waveName: "Mental Health",
    bucket: "share_resources",
    phrase: "shared mental health resources",
    priority: 1
  },
  {
    waveName: "Mental Health", 
    bucket: "self_care_moment",
    phrase: "took a mindful break",
    priority: 1
  },
  {
    waveName: "Mental Health",
    bucket: "workplace_advocacy", 
    phrase: "advocated for healthier work norms",
    priority: 1
  },

  // Environment wave phrases
  {
    waveName: "Environment",
    bucket: "pick_up_litter",
    phrase: "picked up litter",
    priority: 1
  },
  {
    waveName: "Environment",
    bucket: "bring_reusable", 
    phrase: "brought a reusable item",
    priority: 1
  },
  {
    waveName: "Environment",
    bucket: "recycle_correctly",
    phrase: "sorted recycling properly", 
    priority: 1
  },
  {
    waveName: "Environment",
    bucket: "conserve_energy_short",
    phrase: "saved energy",
    priority: 1
  },

  // Community & Equity wave phrases  
  {
    waveName: "Community & Equity",
    bucket: "conscious_purchase",
    phrase: "made a conscious purchase",
    priority: 1
  },
  {
    waveName: "Community & Equity", 
    bucket: "donate_small",
    phrase: "made a small donation",
    priority: 1
  },
  {
    waveName: "Community & Equity",
    bucket: "share_opportunity", 
    phrase: "shared an opportunity",
    priority: 1
  },
  {
    waveName: "Community & Equity",
    bucket: "support_bipoc",
    phrase: "supported a local business",
    priority: 1
  },

  // Global fallback phrases (no wave specified)
  {
    waveName: null,
    bucket: "default",
    phrase: "completed an action", 
    priority: 0
  }
];

export async function seedPhrases() {
  console.log('🌱 Seeding phrase mappings...');

  // Get all waves to map names to IDs
  const waves = await prisma.wave.findMany({
    select: { id: true, name: true }
  });
  const waveMap = new Map(waves.map(w => [w.name, w.id]));

  let seedCount = 0;

  for (const phraseData of PHRASE_DATA) {
    const waveId = phraseData.waveName ? waveMap.get(phraseData.waveName) : null;
    
    // Skip if wave name doesn't exist (except for global fallbacks)
    if (phraseData.waveName && !waveId) {
      console.warn(`⚠️  Wave "${phraseData.waveName}" not found, skipping phrase`);
      continue;
    }

    // Upsert the phrase
    await prisma.phraseMap.upsert({
      where: {
        // Use a compound where condition based on wave and bucket
        id: `${waveId || 'global'}-${phraseData.bucket}`
      },
      update: {
        phrase: phraseData.phrase,
        priority: phraseData.priority,
        isActive: true
      },
      create: {
        id: `${waveId || 'global'}-${phraseData.bucket}`,
        waveId,
        bucket: phraseData.bucket,
        phrase: phraseData.phrase,
        priority: phraseData.priority,
        isActive: true
      }
    });

    seedCount++;
  }

  console.log(`✅ Seeded ${seedCount} phrase mappings`);
}

// Helper function to get phrase for a given wave and bucket
export async function getPhrase(waveId: string, bucket: string): Promise<string> {
  // Try wave-specific phrase first (highest priority)
  const wavePhrase = await prisma.phraseMap.findFirst({
    where: {
      waveId,
      bucket,
      isActive: true
    },
    orderBy: {
      priority: 'desc'
    }
  });

  if (wavePhrase) {
    return wavePhrase.phrase;
  }

  // Fallback to global phrase for this bucket
  const globalPhrase = await prisma.phraseMap.findFirst({
    where: {
      waveId: null,
      bucket,
      isActive: true
    },
    orderBy: {
      priority: 'desc'
    }
  });

  if (globalPhrase) {
    return globalPhrase.phrase;
  }

  // Final fallback
  return "completed an action";
}