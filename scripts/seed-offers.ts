/**
 * Seed script for Offers table
 * Run with: npx ts-node scripts/seed-offers.ts
 *
 * This creates the 4-tier pricing structure:
 * 1. All Protocols + AI Coaching (TARGET - highlighted)
 * 2. Done-With-You (UPSELL)
 * 3. Concierge (ANCHOR)
 * 4. Something Else (CUSTOM)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const offers = [
    {
        slug: 'guided',
        name: 'All Protocols + AI Coaching',
        tagline: 'Everything plus personalized guidance',
        trialPrice: '$1',
        monthlyPrice: '$29/mo',
        features: [
            'All training modules unlocked',
            'AI-powered coaching chat',
            'Individualized protocol plan',
            'Beginner Partnership peptide discounts',
            'Weekly progress insights',
            'Breath & workout tracking',
            'Nutrition logging',
            'Full dashboard access'
        ],
        highlighted: true,
        displayOrder: 1,
        color: 'teal',
        ctaText: 'Start $1 Trial',
        ctaUrl: null,
        isActive: true
    },
    {
        slug: 'done-with-you',
        name: 'Done-With-You',
        tagline: 'Personal guidance every step of the way',
        trialPrice: '$99',
        monthlyPrice: '$149/mo',
        features: [
            'Everything in All Protocols',
            '1-on-1 planning session',
            'Email support within 24hrs',
            'Monthly video check-ins',
            'Custom protocol adjustments',
            'Full Partnership peptide discounts',
            'Priority support'
        ],
        highlighted: false,
        displayOrder: 2,
        color: 'purple',
        ctaText: 'Start $99 Trial',
        ctaUrl: null,
        isActive: true
    },
    {
        slug: 'concierge',
        name: 'Concierge',
        tagline: 'Complete white-glove service',
        trialPrice: 'Book a call',
        monthlyPrice: '$5,000+/mo',
        features: [
            'Everything above',
            'Weekly 1-on-1 calls',
            'Direct access messaging',
            'Fully managed protocols',
            'Quarterly in-person options',
            'Complete accountability system',
            'VIP priority everything'
        ],
        highlighted: false,
        displayOrder: 3,
        color: 'gold',
        ctaText: 'Book a Call',
        ctaUrl: 'https://calendly.com/resetbiology/concierge',
        isActive: true
    },
    {
        slug: 'other',
        name: 'Something Else?',
        tagline: "Let's figure it out together",
        trialPrice: 'Talk to us',
        monthlyPrice: 'Custom',
        features: [
            'Custom package negotiation',
            'Special circumstances',
            'Corporate/group rates',
            'Partnership inquiries'
        ],
        highlighted: false,
        displayOrder: 4,
        color: 'gray',
        ctaText: 'Contact Us',
        ctaUrl: '/contact',
        isActive: true
    }
];

async function main() {
    console.log('🌱 Seeding offers...\n');

    for (const offer of offers) {
        const result = await prisma.offer.upsert({
            where: { slug: offer.slug },
            update: offer,
            create: offer
        });
        console.log(`✅ ${result.name} (${result.slug})`);
    }

    console.log('\n✨ Offers seeded successfully!');
    console.log('\nPricing structure:');
    console.log('  1. All Protocols + AI Coaching: $1 trial → $29/mo (TARGET)');
    console.log('  2. Done-With-You: $99 trial → $149/mo (UPSELL)');
    console.log('  3. Concierge: Book call → $5,000+/mo (ANCHOR)');
    console.log('  4. Something Else: Custom (EDGE CASES)');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
