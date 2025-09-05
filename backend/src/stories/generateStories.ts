import { prisma } from '../db.js';
import { getPhrase } from '../../prisma/seedPhrases.js';

interface StoryCandidate {
  rippleId: string;
  waveId: string;
  bucket: string;
  city: string | null;
  userCount: number;
  actionCount: number;
}

export async function generateStories(hoursBack: number = 24) {
  console.log(`🔄 Generating stories for the last ${hoursBack} hours...`);
  
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  
  // Query recent action logs grouped by ripple, wave, bucket, and city
  const aggregatedActions = await prisma.actionLog.groupBy({
    by: ['rippleId', 'waveId', 'bucket', 'city'],
    where: {
      createdAt: {
        gte: cutoff
      }
    },
    _count: {
      userId: true,
      id: true
    }
  });

  const storyCandidates: StoryCandidate[] = aggregatedActions.map(action => ({
    rippleId: action.rippleId,
    waveId: action.waveId,
    bucket: action.bucket,
    city: action.city,
    userCount: action._count.userId,
    actionCount: action._count.id
  }));

  // Filter candidates that meet privacy threshold (minimum 3 people)
  const validStories = storyCandidates.filter(story => story.userCount >= 3);

  console.log(`📊 Found ${storyCandidates.length} candidates, ${validStories.length} meet privacy threshold`);

  let createdCount = 0;

  for (const story of validStories) {
    try {
      // Get the appropriate phrase for this wave/bucket combination
      const phrase = await getPhrase(story.waveId, story.bucket);
      
      // Generate the blurb with user count
      const locationPrefix = story.city ? `${story.city} • ` : '';
      const userCountText = story.userCount === 1 ? '1 person' : `${story.userCount} people`;
      const blurb = `${locationPrefix}${userCountText} ${phrase}`;

      // Check if we already have a recent story for this combination
      const existingStory = await prisma.rippleActivity.findFirst({
        where: {
          rippleId: story.rippleId,
          blurb,
          createdAt: {
            gte: cutoff
          }
        }
      });

      if (!existingStory) {
        await prisma.rippleActivity.create({
          data: {
            rippleId: story.rippleId,
            city: story.city,
            blurb
          }
        });
        createdCount++;
      }
    } catch (error) {
      console.warn(`⚠️  Failed to create story for ripple ${story.rippleId}, bucket ${story.bucket}:`, error);
    }
  }

  console.log(`✅ Created ${createdCount} new stories`);
  
  // Clean up old stories (keep last 7 days)
  const oldCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const deletedCount = await prisma.rippleActivity.deleteMany({
    where: {
      createdAt: {
        lt: oldCutoff
      }
    }
  });

  console.log(`🧹 Cleaned up ${deletedCount.count} old stories`);
  
  return {
    candidatesFound: storyCandidates.length,
    storiesCreated: createdCount,
    storiesDeleted: deletedCount.count
  };
}

// Helper function to run story generation manually
export async function runStoriesJob() {
  try {
    const result = await generateStories(24);
    console.log('Stories job completed:', result);
    return result;
  } catch (error) {
    console.error('Stories job failed:', error);
    throw error;
  }
}