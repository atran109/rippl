import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const waves = [
    {
        name: "Mental Health",
        description: "Reduce stigma and normalize healthy conversations.",
        icon: "🧠",
        impactCoef: -0.006, // example: -0.006 stigma index per eligible action
        impactUnit: "stigma index points",
        impactSource: "WHO 2024",
        allowedBuckets: [
            "conversation_checkin",
            "share_resources",
            "self_care_moment",
            "workplace_advocacy",
        ],
        impactWhatWeCount: "Conversations and actions that normalize mental health discussions",
        impactFormula: "Total eligible actions × -0.006 stigma points",
        impactSourcesAndCaveats: "Based on WHO 2024 stigma reduction studies. Conservative estimate.",
        bucketWeights: [
            { bucket: "conversation_checkin", weight: 1.0 },
            { bucket: "share_resources", weight: 0.8 },
            { bucket: "self_care_moment", weight: 0.5 },
            { bucket: "workplace_advocacy", weight: 2.0 }, // Higher impact for advocacy
        ],
        ripples: [
            {
                title: "Normalize therapy talk at work",
                description: "Make mental health chats as normal as weather talk.",
                audience_noun: "coworkers",
                context_label: "at work",
                default_bucket: "conversation_checkin",
                isStarter: true, // This is the default starter ripple for Mental Health
                microTemplates: [
                    {
                        bucket: "conversation_checkin",
                        texts: [
                            "Ask a coworker how they're really doing",
                            "Invite a 5-minute walk-and-talk",
                            "Say \"How's your stress level today?\"",
                            "Share one thing that helped your mood recently",
                            "Check in with a teammate after a tough meeting",
                        ],
                    },
                    {
                        bucket: "share_resources",
                        texts: [
                            "Post counseling hotline in Slack",
                            "Share a therapy-facts link in team chat",
                            "Pin HR mental-health resources in channel",
                            "DM a mindfulness app link to a teammate",
                            "Share EAP program details with your squad",
                        ],
                    },
                    {
                        bucket: "self_care_moment",
                        texts: [
                            "Do 2-minute box breathing",
                            "Stand, stretch for 60 seconds",
                            "Write down one worry then shelve it",
                            "Step outside for 1 minute of sun",
                            "Drink a glass of water mindfully",
                        ],
                    },
                    {
                        bucket: "workplace_advocacy",
                        texts: [
                            "Add a \"wellbeing\" check to next agenda",
                            "Suggest a mental-health day policy",
                            "Ask manager for a no-meeting hour",
                            "Encourage camera-off option this call",
                            "Propose a quiet room for breaks",
                        ],
                    },
                ],
            },
            {
                title: "Mindful breaks at work",
                description: "Short resets that keep the team sane.",
                audience_noun: "coworkers",
                context_label: "during the day",
                default_bucket: "self_care_moment",
                microTemplates: [
                    {
                        bucket: "self_care_moment",
                        texts: [
                            "Close your eyes for 3 deep breaths",
                            "Walk one lap around the floor",
                            "Unclench jaw + drop shoulders",
                            "Write a 1-line gratitude",
                            "Mute notifications for 60 seconds",
                        ],
                    },
                    {
                        bucket: "share_resources",
                        texts: [
                            "Share a 2-min meditation clip",
                            "Post a stretch GIF to team chat",
                            "Recommend a focus playlist",
                            "Share a breathing technique image",
                            "Link a micro-break science article",
                        ],
                    },
                ],
            },
        ],
    },
    {
        name: "Environment",
        description: "Small actions, cleaner planet.",
        icon: "🌍",
        impactCoef: 0.09, // 0.09 kg per eligible action (example)
        impactUnit: "kg litter removed",
        impactSource: "EPA 2023 (conservative avg item weight)",
        allowedBuckets: [
            "pick_up_litter",
            "bring_reusable",
            "recycle_correctly",
            "conserve_energy_short",
        ],
        impactWhatWeCount: "Physical litter removed and waste reduction actions",
        impactFormula: "Eligible actions × 0.09 kg average item weight",
        impactSourcesAndCaveats: "EPA 2023 average litter weight data. Conservative estimate, actual impact may be higher.",
        bucketWeights: [
            { bucket: "pick_up_litter", weight: 1.0 },
            { bucket: "bring_reusable", weight: 0.7 },
            { bucket: "recycle_correctly", weight: 0.8 },
            { bucket: "conserve_energy_short", weight: 0.6 },
        ],
        ripples: [
            {
                title: "Zero-Litter Walks",
                description: "Pick up one item on your walk.",
                audience_noun: "neighbors",
                context_label: "on daily walks",
                default_bucket: "pick_up_litter",
                isStarter: true, // Starter ripple for Environment
                microTemplates: [
                    {
                        bucket: "pick_up_litter",
                        texts: [
                            "Pick up one plastic bottle",
                            "Grab 3 small litter items",
                            "Bin one piece of packaging",
                            "Pick up one can you see",
                            "Carry a pocket bag for trash",
                        ],
                    },
                    {
                        bucket: "bring_reusable",
                        texts: [
                            "Carry your refillable bottle",
                            "Pack a reusable shopping bag",
                            "Bring a reusable coffee cup",
                            "Refuse a plastic straw",
                            "Use a lunchbox instead of wrap",
                        ],
                    },
                    {
                        bucket: "recycle_correctly",
                        texts: [
                            "Check local recycling guide",
                            "Set aside one e-waste device",
                            "Rinse a container before binning",
                            "Separate paper from plastic",
                            "Remove caps if your city requires",
                        ],
                    },
                ],
            },
            {
                title: "Plastic-Free Week",
                description: "Reduce single-use plastic in small steps.",
                audience_noun: "shoppers",
                context_label: "on grocery runs",
                default_bucket: "bring_reusable",
                microTemplates: [
                    {
                        bucket: "bring_reusable",
                        texts: [
                            "Bring a reusable bag",
                            "Bring a mesh produce bag",
                            "Carry cutlery for takeout",
                            "Refill your water before leaving",
                            "Keep a bag in your backpack",
                        ],
                    },
                    {
                        bucket: "conserve_energy_short",
                        texts: [
                            "Turn off a light you're not using",
                            "Unplug a dormant charger",
                            "Lower thermostat 1° for an hour",
                            "Air-dry an item instead of dryer",
                            "Shorten shower by 1 minute",
                        ],
                    },
                ],
            },
        ],
    },
    {
        name: "Community & Equity",
        description: "Small local steps that add up.",
        icon: "🤝",
        impactCoef: 1, // placeholder; later switch to verified local $ directed
        impactUnit: "eligible actions",
        impactSource: "MVP beta",
        allowedBuckets: [
            "conscious_purchase",
            "donate_small",
            "share_opportunity",
            "support_bipoc",
        ],
        impactWhatWeCount: "Local economic support and community building actions",
        impactFormula: "Eligible actions (placeholder for economic impact calculation)",
        impactSourcesAndCaveats: "Beta metric. Will be updated with local economic impact data.",
        bucketWeights: [
            { bucket: "conscious_purchase", weight: 1.5 },
            { bucket: "donate_small", weight: 1.2 },
            { bucket: "share_opportunity", weight: 0.8 },
            { bucket: "support_bipoc", weight: 2.0 }, // Higher weight for direct support
        ],
        ripples: [
            {
                title: "Shop BIPOC Near Me",
                description: "Direct a small spend locally.",
                audience_noun: "neighbors",
                context_label: "around town",
                default_bucket: "conscious_purchase",
                isStarter: true, // Starter ripple for Community
                microTemplates: [
                    {
                        bucket: "conscious_purchase",
                        texts: [
                            "Buy from a Rippl-Certified café",
                            "Leave a $1 extra tip today",
                            "Try one new local vendor",
                            "Leave a positive review",
                            "Tell a friend about a local spot",
                        ],
                    },
                    {
                        bucket: "share_opportunity",
                        texts: [
                            "Forward one job listing",
                            "Share a local training link",
                            "Post a community event",
                            "Invite a friend to a fair",
                            "Share a scholarship link",
                        ],
                    },
                    {
                        bucket: "donate_small",
                        texts: [
                            "Pledge $2 to the pantry",
                            "Add one canned item to donate",
                            "Set aside $1 for Friday drive",
                            "Share a food bank link",
                            "Bring a spare item to a drop box",
                        ],
                    },
                ],
            },
        ],
    },
];
async function main() {
    console.log("Seeding…");
    // Clear existing (dev-only convenience)
    await prisma.actionLog.deleteMany();
    await prisma.microAction.deleteMany();
    await prisma.template.deleteMany();
    await prisma.waveBucket.deleteMany();
    await prisma.ripple.deleteMany();
    await prisma.wave.deleteMany();
    for (const w of waves) {
        const wave = await prisma.wave.create({
            data: {
                name: w.name,
                description: w.description,
                icon: w.icon,
                impactCoef: w.impactCoef,
                impactUnit: w.impactUnit,
                impactSource: w.impactSource,
                allowedBuckets: w.allowedBuckets, // Now stored as JSON array
                impactWhatWeCount: w.impactWhatWeCount,
                impactFormula: w.impactFormula,
                impactSourcesAndCaveats: w.impactSourcesAndCaveats,
            },
        });
        // Create WaveBucket entries for this wave (with weights if provided)
        const weightsMap = new Map();
        if (w.bucketWeights) {
            for (const bw of w.bucketWeights) {
                weightsMap.set(bw.bucket, bw.weight);
            }
        }
        for (const bucket of w.allowedBuckets) {
            await prisma.waveBucket.create({
                data: {
                    waveId: wave.id,
                    name: bucket,
                    weight: weightsMap.get(bucket) ?? 1.0,
                    isActive: true,
                },
            });
        }
        for (const r of w.ripples) {
            const ripple = await prisma.ripple.create({
                data: {
                    waveId: wave.id,
                    title: r.title,
                    description: r.description,
                    audience_noun: r.audience_noun ?? null,
                    context_label: r.context_label ?? null,
                    blurb_template: r.blurb_template ?? null,
                    default_bucket: r.default_bucket ?? null,
                    isStarter: r.isStarter ?? false,
                },
            });
            // Initialize RippleCounter for trending system
            await prisma.rippleCounter.create({
                data: {
                    rippleId: ripple.id,
                    waveId: wave.id,
                    participants: 0,
                    actions24h: 0,
                    actions1h: 0,
                    newParticipants24h: 0,
                    version: 0,
                },
            });
            // Build 20–50 micro-actions per ripple by expanding the templates
            const microActions = [];
            for (const group of r.microTemplates) {
                for (const t of group.texts) {
                    microActions.push({ text: t, bucket: group.bucket });
                }
                // Duplicate (lightly varied) to hit 20–50 if needed
                while (microActions.length < 24) {
                    microActions.push({
                        text: `${group.texts[Math.floor(Math.random() * group.texts.length)]} (variant)`,
                        bucket: group.bucket,
                    });
                }
            }
            // Bulk insert
            await prisma.microAction.createMany({
                data: microActions.map((m) => ({
                    rippleId: ripple.id,
                    waveId: wave.id,
                    text: m.text,
                    bucket: m.bucket,
                    status: "active",
                    createdBy: "seed",
                })),
            });
        }
    }
    // Create some sample Templates
    const templateData = [
        // Mental Health templates
        {
            waveId: (await prisma.wave.findFirst({ where: { name: "Mental Health" } }))?.id,
            bucket: "conversation_checkin",
            textPattern: "Ask a {audience} how they're really doing {time}.",
            modifiersJson: {
                time: ["today", "before lunch", "after standup", "this afternoon"],
                audience: ["coworker", "friend", "classmate", "roommate"]
            }
        },
        {
            waveId: (await prisma.wave.findFirst({ where: { name: "Mental Health" } }))?.id,
            bucket: "share_resources",
            textPattern: "Share one mental-health resource in a {channel}.",
            modifiersJson: {
                channel: ["Slack", "group chat", "email", "DM"]
            }
        },
        // Environment templates
        {
            waveId: (await prisma.wave.findFirst({ where: { name: "Environment" } }))?.id,
            bucket: "pick_up_litter",
            textPattern: "Pick up {count} plastic {item} on your walk.",
            modifiersJson: {
                count: ["1", "2", "3"],
                item: ["bottle", "cup", "wrapper", "bag"]
            }
        },
        {
            waveId: (await prisma.wave.findFirst({ where: { name: "Environment" } }))?.id,
            bucket: "bring_reusable",
            textPattern: "Bring a reusable {item} {context}.",
            modifiersJson: {
                item: ["bag", "bottle", "cup", "container"],
                context: ["to the store", "to work", "on your walk", "for lunch"]
            }
        },
        // Community templates
        {
            waveId: (await prisma.wave.findFirst({ where: { name: "Community & Equity" } }))?.id,
            bucket: "conscious_purchase",
            textPattern: "Buy {item} from a {type} business today.",
            modifiersJson: {
                item: ["coffee", "lunch", "groceries", "supplies"],
                type: ["local", "BIPOC-owned", "woman-owned", "family"]
            }
        }
    ];
    for (const template of templateData) {
        if (template.waveId) {
            await prisma.template.create({
                data: {
                    waveId: template.waveId,
                    bucket: template.bucket,
                    textPattern: template.textPattern,
                    modifiersJson: template.modifiersJson,
                    status: "active"
                }
            });
        }
    }
    console.log("Seed complete.");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
