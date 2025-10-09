export interface Protocol {
  id: string;
  title: string;
  slug: string;
  price: number;
  duration: string;
  productImage: string;
  certificates: string[];
  whatItHelps: string[];
  howItWorks: string;
  peptidesIncluded: string[];
  packageIncludes: string[];
  dosing: string;
  timing: string;
  reconstitution: string;
  testimonials?: string;
}

export const protocols: Protocol[] = [
  {
    id: 'anxiety-depression',
    title: 'Anxiety & Depression Protocol',
    slug: 'anxiety-depression',
    price: 825,
    duration: '12 Weeks',
    productImage: '/images/cellular-peptide-products/anxiety-depression.png',
    certificates: [
      '/images/cellular-peptide-products/Selank_CofA.png',
      '/images/cellular-peptide-products/Semax_CofA.jpg'
    ],
    peptidesIncluded: ['Selank 10mg', 'Semax 30mg'],
    whatItHelps: [
      'Cognitive Function Enhancement',
      'Anxiety & Stress Reduction',
      'ADHD & PTSD Support',
      'Mood Disorders',
      'Parkinson\'s & Dementia Support'
    ],
    howItWorks: 'The Anxiety & Depression Protocol Package utilizes a combination of the peptides Semax and Selank. When Semax is injected, it is delivered to the pituitary gland to increase the production of the happy hormones, serotonin and dopamine. It also increases BDNF (Brain Derived Neurotrophic Factor) to aid in learning and memory and GABA (Gamma-aminobutyric Acid) to calm the brain. Selank stimulates GABA receptors, promoting relaxation and calmness while reducing tension and restlessness. It has been shown to enhance cognitive function, reduce anxiety and stress, improve mood and sleep, and boost the immune response. Additionally, it helps regulate cortisol levels in the body. As a result, users can experience improved mental clarity and focus, improved mood and sleep, less stress and anxiety, while feeling more relaxed overall.',
    packageIncludes: ['1 vial of Selank 10mg', '1 vial of Semax 30mg', 'Syringes', 'Alcohol wipes', '2 vials bacteriostatic water'],
    dosing: '500 mcg (5 units) of Selank daily (alternating 7 days on/7 days off) & 500 mcg (5 units) of Semax daily first thing in the morning, for 12 weeks',
    timing: 'All doses should be taken on an empty stomach, 2 hours prior to and/or after eating',
    reconstitution: 'Store in freezer for up to 2 years',
    testimonials: '"The mental health peptide protocol was a lifesaver during a tough period. It eased my anxiety, sharpened my focus, and boosted my energy significantly" - M. Grant, Arizona\n\n"I slept very well! Also my long term memory and memory in general started to improve around week 2; things I had forgotten were suddenly readily remembered. Since having covid I had been experiencing brain fog...this has all but disappeared" - C. Stockwell, HP from Idaho\n\n"I have struggled with frequent periods of depression since my teen years. My life has significantly improved since taking the Anxiety/Depression peptide protocol having no further episodes of depression and I experience more stable moods" - J. Crane'
  },
  {
    id: 'blood-sugar-support',
    title: 'Blood Sugar Support & Weight Reduction',
    slug: 'blood-sugar-support',
    price: 1080,
    duration: '16 Weeks',
    productImage: '/images/cellular-peptide-products/semaglutide.png',
    certificates: ['/images/cellular-peptide-products/Semaglutide_CofA.webp'],
    peptidesIncluded: ['Semaglutide 10mg'],
    whatItHelps: [
      'Type 2 Diabetes',
      'Slowing/Prevention of Alzheimer\'s & Parkinson\'s',
      'Obesity',
      'Cardiovascular Risk',
      'Non-Alcoholic Fatty Liver Disease',
      'Chronic Kidney Disease',
      'Metabolic Syndrome',
      'Reduce Unhealthy Cravings'
    ],
    howItWorks: 'When Semaglutide is injected, it acts as an agonist to GLP-1 receptors in the body, which helps to stimulate insulin production, reduce glucagon secretion, and delay gastric emptying. This can help to reduce blood glucose levels and further improve glycemic control. As a result, users can experience reduced appetite which often leads to weight loss. Other known benefits are improved heart, liver, and lung function and the slowing/prevention of Alzheimer\'s disease. Improved mood, better sleep quality, and reduced fatigue have also been reported. Semaglutide should not be used as a quick fix or "miracle" weight loss regimen, but can be a helpful aid to establishing healthy eating habits.',
    packageIncludes: ['Semaglutide vials', 'Syringes', 'Alcohol wipes', 'Bacteriostatic water'],
    dosing: 'Dosage differs per individual. If under 150lbs, begin with 250mcg (2.5 units) weekly. If over 150lbs, begin with 500mcg (5 units) weekly. Increase gradually as tolerated.',
    timing: 'All doses should be taken on an empty stomach, 2 hours prior to and/or after eating',
    reconstitution: 'Store in freezer for up to 2 years',
    testimonials: '"The semaglutide is very effective to cut cravings. Helped to eat healthy portions and reduce weight. I am very pleased with the results as the weight is still continuing to be trimmed off as I am into week 13 of the 16 week program." - G. Kier, HP from Colorado\n\n"I have been on Semaglutide for 2.5 months and lost 17lbs so far. I\'ve had better digestion, limited cravings, and lost weight - excited! I steadily lost about 1-2 lbs per week. I feel like it is resetting my metabolic system." - Krystal Taylor\n\n"I have battled weight loss for years. By utilizing a complete holistic program of healthy eating habits and whole food nutrients to minimize semaglutide side effects, I have reduced body fat, retained shapely muscle and have a lifestyle I can follow for life." - Anonymous Patient'
  },
  {
    id: 'body-recomposition',
    title: 'Body Recomposition & Metabolic Health',
    slug: 'body-recomposition',
    price: 1470,
    duration: '10 Weeks',
    productImage: '/images/cellular-peptide-products/body-recomposition.png',
    certificates: [
      '/images/cellular-peptide-products/Retatrutide_CofA.png',
      '/images/cellular-peptide-products/Retatrutide_CofA_2.png'
    ],
    peptidesIncluded: ['Retatrutide 10mg'],
    whatItHelps: [
      'Type 2 Diabetes',
      'Obesity',
      'High Blood Pressure',
      'High Cholesterol',
      'Metabolic Syndrome'
    ],
    howItWorks: 'Retatrutide is a triple-agonist peptide that activates GLP-1, GIP, and glucagon receptors simultaneously. This unique mechanism provides superior metabolic benefits including enhanced insulin sensitivity, improved glucose control, increased energy expenditure, and significant fat loss while preserving lean muscle mass.',
    packageIncludes: ['Retatrutide vials', 'Syringes', 'Alcohol wipes', 'Bacteriostatic water'],
    dosing: 'Dosage differs per individual. Follow provided tiered dosage protocol, taking 1 injection per week. Once desired appetite/craving reduction is accomplished, stop increasing dose.',
    timing: 'All doses should be taken on an empty stomach, 2 hours prior to and/or after eating',
    reconstitution: 'Store in freezer for up to 2 years'
  },
  {
    id: 'growth-hormone',
    title: 'Growth Hormone & Anti-Aging Protocol',
    slug: 'growth-hormone',
    price: 1300,
    duration: '16 Weeks',
    productImage: '/images/cellular-peptide-products/growth-hormone.png',
    certificates: ['/images/cellular-peptide-products/CJC-1295_Ipamorelin_CofA.webp'],
    peptidesIncluded: ['CJC-1295 + Ipamorelin 5mg/5mg Combination'],
    whatItHelps: [
      'Extreme Inflammatory Conditions',
      'Aging',
      'Obesity',
      'Muscle-Wasting Conditions',
      'Fatigue'
    ],
    howItWorks: 'CJC-1295 has been shown to increase human growth hormone (HGH) levels in the body, resulting in increased muscle mass, reduced fat, and improved energy levels. It also has anti-aging effects as it can increase collagen production, reduce wrinkles, and improve skin elasticity. Ipamorelin has also been shown to increase muscle mass (including in individuals with muscle-wasting conditions), improve cognitive function, and reduce inflammation. This effective combination promotes the increase of growth hormone by increasing the pulse of growth hormone release within the body and the number of cells that secrete growth hormone. As a result, users can expect to lose body fat, gain muscle, reduce inflammation, and have increased energy levels.',
    packageIncludes: ['CJC-1295 + Ipamorelin combination vials', 'Syringes', 'Alcohol wipes', 'Bacteriostatic water'],
    dosing: '1000mcg (10 units) daily, right before bed',
    timing: 'All doses should be taken on an empty stomach, 2 hours prior to and/or after eating',
    reconstitution: 'Store in freezer for up to 2 years',
    testimonials: '"Body transformation! Took time, be patient. I have increased muscle mass, muscle tone, lost inches and my skin looks younger. And my sleep has been even better than it was. Truly wake rejuvenated!" - L. Beam, HP from California\n\n"After 4 weeks, client struggling with losing weight and hormonal imbalance said they felt the best they had ever felt and she started dropping weight, while also putting on muscle. After 4 months, she is in the best shape of her life and the happiest she\'s ever been." - D. Grant, HP from Arizona'
  },
  {
    id: 'hair-growth',
    title: 'Hair Growth & Skin Health Protocol',
    slug: 'hair-growth',
    price: 510,
    duration: '8 Weeks',
    productImage: '/images/cellular-peptide-products/hair-growth.png',
    certificates: [],
    peptidesIncluded: ['GHK-Cu 100mg'],
    whatItHelps: [
      'Hair Growth & Restoration',
      'Overall Skin Health & Smoothing',
      'Tissue Remodeling & Anti-aging'
    ],
    howItWorks: 'GHK-Cu (Copper peptide) is a natural peptide found in blood plasma that provides substantial benefits for skin health by stimulating collagen production and fibroblasts. It promotes hair growth by accelerating the hair follicle growth cycle, improves skin elasticity while tightening and firming, reduces sun damage and hyperpigmentation, and diminishes fine lines and wrinkles.',
    packageIncludes: ['1 vial GHK-Cu 100mg', 'Syringes', 'Alcohol wipes', 'Bacteriostatic water'],
    dosing: 'Inject 500 mcg (5 units) once daily',
    timing: 'All doses should be taken on an empty stomach, 2 hours prior to and/or after eating',
    reconstitution: 'Store in freezer for up to 2 years'
  },
  {
    id: 'hormone-balancing',
    title: 'Hormone Balancing Protocol',
    slug: 'hormone-balancing',
    price: 540,
    duration: '10 Weeks',
    productImage: '/images/cellular-peptide-products/hormone-balancing.png',
    certificates: ['/images/cellular-peptide-products/Kisspeptin_CofA.webp'],
    peptidesIncluded: ['Kisspeptin 10mg'],
    whatItHelps: [
      'Unbalanced Reproductive Hormones',
      'Menstrual Cycles & Menopausal Symptoms',
      'PCOS',
      'Hypogonadism',
      'Infertility'
    ],
    howItWorks: 'When Kisspeptin is injected, it stimulates GnRH (Gonadotropin-Releasing Hormone) and regulates the hypothalamic-pituitary-gonadal axis, influencing the reproductive health and hormones in both men and women. Kisspeptin can also increase LH and FSH levels, testosterone levels, and sex drive. Additionally, it is involved in budding research in reproductive studies, benefitting individuals with fertility issues. As a result, users can experience improved reproductive hormones and sex drive, improved mood, regulated menstrual cycles, improved weight management, and improved overall health.',
    packageIncludes: ['Kisspeptin vials', 'Syringes', 'Alcohol wipes', 'Bacteriostatic water'],
    dosing: '300mcg (3 units), 3 times per week, upon waking',
    timing: 'All doses should be taken on an empty stomach, 2 hours prior to and/or after eating',
    reconstitution: 'Store in freezer for up to 2 years',
    testimonials: '"Client tried everything to balance hormones for years to no avail. Kisspeptin fixed everything and she has been balanced, loving it, for many months." - D. Grant, HP from Arizona'
  },
  {
    id: 'joint-wound-healing',
    title: 'Joint & Wound Healing Protocol',
    slug: 'joint-wound-healing',
    price: 1050,
    duration: '6 Weeks',
    productImage: '/images/cellular-peptide-products/bpc-tb500.png',
    certificates: ['/images/cellular-peptide-products/BPC157TB500_CofA.png'],
    peptidesIncluded: ['BPC-157 + TB-500 5mg/5mg Combination'],
    whatItHelps: [
      'Muscle & Tendon Injuries',
      'Joint Pain & Inflammation',
      'GI Disorders',
      'Wound Healing',
      'Cardiovascular Health'
    ],
    howItWorks: 'The "Wolverine Protocol" combines BPC-157 and TB-500 for exceptional healing properties. BPC-157 accelerates healing of muscles, tendons, and ligaments while protecting and healing the GI tract. TB-500 promotes new blood vessel formation, reduces inflammation, and enhances tissue repair. Together they provide comprehensive regenerative support.',
    packageIncludes: ['BPC-157 + TB-500 combination vials', 'Syringes', 'Alcohol wipes', 'Bacteriostatic water'],
    dosing: '1000mcg (10 units) twice daily for 6 weeks',
    timing: 'All doses should be taken on an empty stomach, 2 hours prior to and/or after eating',
    reconstitution: 'Store in freezer for up to 2 years',
    testimonials: '"I had pretty severe arthritis in both hands, tendonitis in my thumb, a shoulder sprain, and was considering hip replacement. Within 4 days I noticed 50% improvement in all my aches and pains. In 6 weeks I experienced 90-95% improvement. My hip pain is not even on the radar. I am not considering a hip replacement and I am looking forward to a full winter of skiing." - T. Lankering, HP from Colorado\n\n"Doctor told me I would probably need knee surgery. After 7 weeks on the wolverine protocol with BPC-157 and TB-500, my knee pain was completely gone. Saved me 10s of thousands of dollars and a lot of pain." - B. Schooner\n\n"I had a shoulder injury for over 2 years and followed nutrient, nutrition and rehab perfectly to no avail... I started the BPC-157 / TB-500 protocol and by the 2nd month I was pain free and lifting like I did years previously." - Doug Grant'
  },
  {
    id: 'natural-energy',
    title: 'Natural Energy Reset Protocol',
    slug: 'natural-energy',
    price: 975,
    duration: '12 Weeks',
    productImage: '/images/cellular-peptide-products/natural-energy.png',
    certificates: [
      '/images/cellular-peptide-products/DSIP_CofA.png',
      '/images/cellular-peptide-products/NAD_CofA.png'
    ],
    peptidesIncluded: ['DSIP 2mg', 'NAD+ 500mg'],
    whatItHelps: [
      'Insomnia & Sleep Disorders',
      'Stress Management',
      'Chronic Fatigue',
      'DNA Repair',
      'Mitochondrial Function'
    ],
    howItWorks: 'This protocol combines DSIP (Delta Sleep-Inducing Peptide) and NAD+ for comprehensive energy and sleep optimization. DSIP promotes deep, restorative sleep by modulating sleep-wake cycles. NAD+ supports cellular energy production, DNA repair, and mitochondrial health. Together they restore natural circadian rhythms and boost cellular vitality.',
    packageIncludes: ['DSIP vials', 'NAD+ vials', 'Syringes', 'Alcohol wipes', 'Bacteriostatic water'],
    dosing: 'DSIP: 10 units (200 mcg) once daily before bed. NAD+: 10 units (10 mg) once daily upon waking',
    timing: 'All doses should be injected on an empty stomach, at least 2 hours prior to/after eating',
    reconstitution: 'Store in freezer for up to 2 years'
  },
  {
    id: 'oral-bpc-157',
    title: 'Oral BPC-157',
    slug: 'oral-bpc-157',
    price: 225,
    duration: '4 Weeks',
    productImage: '/images/cellular-peptide-products/oral-bpc-157.png',
    certificates: ['/images/cellular-peptide-products/Oral_BPC-157_CofA.png'],
    peptidesIncluded: ['Oral BPC-157'],
    whatItHelps: [
      'Serotonin Production',
      'Expedites Healing of Gastrointestinal Issues',
      'Inflammation-Induced Conditions',
      'Stomach & Gut Related Conditions'
    ],
    howItWorks: 'Oral BPC-157 employs a patented, natural delivery approach that enables oral administration by conjugating lactoferrin to the BPC-157 peptide, allowing secure absorption to the epithelial cell surface within the oral cavity and lower intestines. A liposome is utilized to safeguard the chelated BPC-157 from being broken down in the stomach. The BPC-157 peptide speeds up the body\'s anti-inflammatory and recovery properties throughout the body. As a result, users can experience a reduction of inflammation, improved gut health, improved mood, and reduction of stomach/gut pain. In addition, individuals may also feel some relief to aches and pains from chronic injuries, but this result cannot be guaranteed.',
    packageIncludes: ['Oral BPC-157 sachets'],
    dosing: 'Follow package instructions',
    timing: 'Take on empty stomach',
    reconstitution: 'Ready to use - no reconstitution needed',
    testimonials: '"Patient with Crohn\'s disease has had significant decrease in stomach pains since starting BPC-157 orally." - D. Sillito, HP from Washington'
  },
  {
    id: 'organ-health',
    title: 'Organ Health & Anti-Aging Protocol',
    slug: 'organ-health',
    price: 540,
    duration: '30 Days',
    productImage: '/images/cellular-peptide-products/organ-health.png',
    certificates: [
      '/images/cellular-peptide-products/Epitalon_CofA.webp',
      '/images/cellular-peptide-products/Kisspeptin_CofA.webp'
    ],
    peptidesIncluded: ['Epitalon 20mg', 'Kisspeptin 10mg'],
    whatItHelps: [
      'Telomere Extension',
      'Hormonal Balance',
      'Pineal Gland Regulation',
      'Immune System Regulation',
      'Aging'
    ],
    howItWorks: 'This powerful peptide combination triggers the natural production of telomerase by working on the pineal gland in the brain. Increased telomerase levels protect telomeres from degradation and shortening, thereby aiding in the growth of new cells and rejuvenation of old ones, effectively slowing the aging process. Epitalon has been shown to improve organ health and to be effective in reversing the signs of aging, such as wrinkles and age spots, by stimulating the production of collagen and elastin. Kisspeptin helps to balance and optimize reproductive hormones, reduce inflammation, and improve overall vitality. As a result, users will experience improved overall health and vitality, healthier skin, and a reduction of inflammation throughout the body.',
    packageIncludes: ['Epitalon vials', 'Kisspeptin vials', 'Syringes', 'Alcohol wipes', 'Bacteriostatic water'],
    dosing: '500 mcg (5 units) of Epitalon and 100 mcg (1 unit) of Kisspeptin daily',
    timing: 'All doses should be taken on an empty stomach, 2 hours prior to and/or after eating',
    reconstitution: 'Store in freezer for up to 2 years',
    testimonials: '"Before Kisspeptin and Epitalon, client struggled with brain fog, low libido, low energy, and anxiety. After 3 weeks on the protocol, every symptom has improved. Energy is consistent throughout the day. Libido has improved and anxiety has faded." - D. Grant, HP from Arizona'
  },
  {
    id: 'prostate-support',
    title: 'Prostate Support Protocol',
    slug: 'prostate-support',
    price: 1185,
    duration: '12 Weeks',
    productImage: '/images/cellular-peptide-products/prostate-support.png',
    certificates: [],
    peptidesIncluded: ['Prostamax 20mg'],
    whatItHelps: [
      'Prostate Swelling',
      'Vascular Congestion',
      'Tissue Scarring',
      'Tissue Remodeling'
    ],
    howItWorks: 'Prostamax is specifically formulated to support prostate health by reducing inflammation and swelling, improving blood flow, breaking down scar tissue, and promoting healthy tissue remodeling. This targeted approach helps maintain optimal prostate function and comfort.',
    packageIncludes: ['Prostamax vials', 'Syringes', 'Alcohol wipes', 'Bacteriostatic water'],
    dosing: 'Inject 1500 mcg (15 units) once daily',
    timing: 'All doses should be taken on an empty stomach, 2 hours prior to and/or after eating',
    reconstitution: 'Store in freezer for up to 2 years'
  },
  {
    id: 'sexual-enhancement',
    title: 'Sexual Enhancement Protocol',
    slug: 'sexual-enhancement',
    price: 630,
    duration: '30 Doses',
    productImage: '/images/cellular-peptide-products/sexual-enhancement.png',
    certificates: ['/images/cellular-peptide-products/PT141_CofA.webp'],
    peptidesIncluded: ['PT-141 10mg'],
    whatItHelps: [
      'Hypoactive Sexual Desire Disorder',
      'Erectile Dysfunction',
      'Female Sexual Arousal Disorder',
      'Postmenopausal Sexual Dysfunction',
      'Peyronies Disease'
    ],
    howItWorks: 'PT-141, also known as bremelanotide, improves sexual function in both men and women by stimulating the melanocortin receptors in the brain. This induces a heightened sense of arousal and sexual desire. PT-141 also increases blood flow to the penis or vagina and clitoris, improving intimate experiences. As a result, users will experience increased libido and sexual desire, improved sexual function, improved female sexual arousal disorder (FSAD), and increased lubrication, orgasms, and satisfaction.',
    packageIncludes: ['PT-141 vials', 'Syringes', 'Alcohol wipes', 'Bacteriostatic water'],
    dosing: '500mcg (5 units) 1 hour prior to intimacy and another 500mcg (5 units) 30 minutes prior to intimacy',
    timing: 'All doses should be taken on an empty stomach, 2 hours prior to and/or after eating',
    reconstitution: 'Store in freezer for up to 2 years',
    testimonials: '"My wife didn\'t have the same level of desire as I did and I thought it was me. After she took PT-141, we realized it was just chemical. We\'re on the same page (and sheets) now." - Client of D. Grant, HP from Arizona'
  },
  {
    id: 'tanning-sexual',
    title: 'Tanning & Sexual Benefits Protocol',
    slug: 'tanning-sexual',
    price: 510,
    duration: '8 Weeks',
    productImage: '/images/cellular-peptide-products/tanning-sexual.png',
    certificates: ['/images/cellular-peptide-products/Melanotan_II_CofA.webp'],
    peptidesIncluded: ['MT-2 (Melanotan II) 10mg'],
    whatItHelps: [
      'UV Protection',
      'Sexual Dysfunction',
      'Tanning of Skin',
      'Weight Control',
      'Traumatic Brain Injury'
    ],
    howItWorks: 'The MT-2 peptide has a wide range of benefits including appetite suppression, skin pigmentation, help combatting certain skin cancers, and to aid with erectile dysfunction and testosterone production. The two most prominent effects that have been conclusively proven in studies are producing erections and arousal and the tanning of skin. MT-2 is derived from alpha-melanocyte-stimulating hormone (a-MSH) which is responsible for the production of melanin in the skin. It works by stimulating the production of melanin, thereby resulting in a tan without the need for exposure to UV rays. MT-2 has also been shown to have neuroprotective effects with reduced neuronal damage and improved cognitive function when used as a treatment for traumatic brain injury. As a result, users will experience the tanning of skin (including freckles and moles), reduced appetite, increased erections and sexual arousal, and improved brain function.',
    packageIncludes: ['MT-2 vials', 'Syringes', 'Alcohol wipes', 'Bacteriostatic water'],
    dosing: 'First 4 weeks: 100mcg (1 unit) twice daily. Following 4 weeks: 100mcg (1 unit) 3 times per week to maintain tan',
    timing: 'All doses should be taken on an empty stomach, 2 hours prior to and/or after eating',
    reconstitution: 'Store in freezer for up to 2 years',
    testimonials: '"The tanning protocol was eerily fun. After just a week, I noticed freckles and then a soft golden tan beginning to manifest. I accelerated the process by mowing and running without a shirt. It was so even that a woman from the Caribbean asked I was \'mixed race\'." - C. Stockwell'
  }
];
