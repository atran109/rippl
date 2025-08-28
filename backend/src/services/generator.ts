import { prisma } from '../db.js';
//microaction generation


// 70% default bucket; else rotate among others. Avoid 3-day same-bucket streak.
async function chooseBucket(userId: string, rippleId: string, waveId: string, defaultBucket: string) {
  // allowed buckets for this wave
  const waveBuckets = await prisma.waveBucket.findMany({ 
    where: { waveId }, 
    select: { name: true } 
  });
  const allowed = waveBuckets.map(b => b.name);
  const others = allowed.filter(b => b !== defaultBucket);
  if (allowed.length === 0) throw new Error('No allowed buckets for wave');

  //Picks default bucket 70% of the time, otherwise randomly picks another.
  let chosen = (Math.random() < 0.7 || others.length === 0) ? defaultBucket : others[Math.floor(Math.random() * others.length)];

  // avoid same bucket 3 days in a row (look at last 2 logs for this user+ripple)
  const lastTwo = await prisma.actionLog.findMany({
    where: { userId, rippleId },
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: { bucket: true }
  });
  if (lastTwo.length === 2 && lastTwo.every(l => l.bucket === chosen)) {
    const alt = (others.length > 0 ? others : allowed).filter(b => b !== chosen);
    if (alt.length) chosen = alt[Math.floor(Math.random() * alt.length)];
  }
  return chosen;
}

//randomly selects modifier value
function pickModifier(mods: any, key: string): string | undefined {
  const arr = Array.isArray(mods?.[key]) ? mods[key] : undefined;
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

//replaces token in text pattern with actual values or random modifier
function fillPattern(textPattern: string, opts: {
  audience?: string | null,
  context?: string | null,
  modifiersJson?: any
}): string {
  const mods = opts.modifiersJson ?? {};
  // simple {token} replacement
  return textPattern.replace(/\{(\w+)\}/g, (_, token: string) => {
    if (token === 'audience') {
      return (opts.audience || pickModifier(mods, 'audience') || 'someone');
    }
    if (token === 'context') {
      return (opts.context ? ` ${opts.context}` : ''); // optional suffix
    }
    return pickModifier(mods, token) ?? '';
  }).replace(/\s+/g, ' ').trim();
}

// exclude templates user saw for this ripple in last 14 days
async function pickTemplate(waveId: string, bucket: string, userId: string, rippleId: string) {
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const recent = await prisma.actionLog.findMany({
    where: { 
      userId, 
      rippleId, 
      createdAt: { gte: twoWeeksAgo },
      micro: { templateId: { not: null } }
    },
    select: { micro: { select: { templateId: true } } }
  });
  const excludeIds = new Set(recent.map(r => r.micro.templateId).filter(Boolean) as string[]);

  const templates = await prisma.template.findMany({
    where: { waveId, bucket, status: 'active' },
    orderBy: { createdAt: 'asc' }
  });
  const candidates = templates.filter(t => !excludeIds.has(t.id));
  return (candidates.length ? candidates : templates)[Math.floor(Math.random() * (candidates.length ? candidates.length : templates.length))] ?? null;
}

export async function generateMicroActionForPrimary(userId: string) {
  // find primary ripple
  const primary = await prisma.userRipple.findFirst({
    where: { userId, isActive: true, isPrimary: true },
    include: { ripple: true }
  });
  if (!primary?.ripple) return null;

  const ripple = primary.ripple;
  const waveId = ripple.waveId;
  const defaultBucket = ripple.default_bucket || (await prisma.waveBucket.findFirst({ where: { waveId } }))?.name || undefined;
  if (!defaultBucket) throw new Error('No default bucket or wave bucket available');

  // choose bucket
  const bucket = await chooseBucket(userId, ripple.id, waveId, defaultBucket);

  // pick template
  const tmpl = await pickTemplate(waveId, bucket, userId, ripple.id);
  if (!tmpl) {
    // fallback to any existing active microAction text (seeded)
    const fallback = await prisma.microAction.findFirst({ 
      where: { rippleId: ripple.id, bucket, status: 'active' } 
    });
    if (fallback) return { 
      id: fallback.id, 
      text: fallback.text, 
      bucket, 
      rippleId: ripple.id 
    };
    return null;
  }

  // fill text
  const text = fillPattern(tmpl.textPattern, {
    audience: ripple.audience_noun,
    context: ripple.context_label,
    modifiersJson: tmpl.modifiersJson
  });

  // save a generated micro-action row (ties back to wave & template)
  const created = await prisma.microAction.create({
    data: {
      rippleId: ripple.id,
      waveId,
      bucket,
      templateId: tmpl.id,
      text,
      status: 'active',
      createdBy: 'generated'
    }
  });

  return { 
    id: created.id, 
    text: created.text, 
    bucket, 
    rippleId: ripple.id 
  };
}