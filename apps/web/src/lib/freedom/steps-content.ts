export type PromptKind = "checklist" | "forgiveness" | "freeform";

export interface ChecklistPrompt {
  id: string;
  kind: "checklist";
  title: string;
  instruction?: string;
  items: string[];
  prayerTemplate?: string;
  allowCustom?: boolean;
}

export interface ForgivenessPrompt {
  id: string;
  kind: "forgiveness";
  title: string;
  instruction: string;
  prayerTemplate: string;
}

export interface FreeformPrompt {
  id: string;
  kind: "freeform";
  title: string;
  instruction: string;
  prayerTemplate?: string;
}

export type StepPrompt = ChecklistPrompt | ForgivenessPrompt | FreeformPrompt;

export interface ReadingBlock {
  title?: string;
  paragraphs: string[];
}

export interface StepsSection {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  sourcePages: string;
  readings: ReadingBlock[];
  openingPrayer?: string;
  prompts: StepPrompt[];
  closingPrayer?: string;
  declarations?: ReadingBlock[];
}

export const sourceNotice =
  "©By Gospel Light. Permission to copy granted ~ Ministering the Steps to Freedom in Christ";

export const lockedSourceRule =
  "This experience follows the Steps without rewriting the prayers, declarations, headings, lists, or sequence. Interaction is limited to places where the participant is asked to check, list, name, confess, renounce, forgive, or fill in a blank.";

export const openingSections: ReadingBlock[] = [
  {
    title: "Steps to Freedom in Christ",
    paragraphs: [
      "By Neil Anderson",
      "It is my deep conviction that the finished work of Jesus Christ and the presence of God in our lives are the only means by which we can resolve our personal and spiritual conflicts. Christ in us is our only hope (Colossians 1:27), and He alone can meet our deepest needs of life: acceptance, identity, security and significance.",
      "The Steps to Freedom in Christ do not set you free. Who sets you free is Christ, and what sets you free is your response to Him in repentance and faith. These steps are just a tool to help you submit to God and resist the devil (James 4:7).",
    ],
  },
  {
    title: "You May Need Help",
    paragraphs: [
      "Ideally, it would be best if everyone had a trusted friend, pastor or counselor who would help them go through this process because it is just applying the wisdom of James 5:16: “Therefore confess your sins to each other and pray for each other so that you may be healed. The prayer of a righteous man is powerful and effective.”",
      "Another person can prayerfully support you by providing objective counsel.",
    ],
  },
  {
    title: "You Must Choose",
    paragraphs: [
      "Your freedom will be the result of what you choose to believe, confess, forgive, renounce and forsake. No one can do that for you.",
      "So we can submit to God inwardly but we need to resist the devil by reading aloud each prayer and by verbally renouncing, forgiving, confessing, etc.",
    ],
  },
];

export const openingPrayer =
  "Dear Heavenly Father, we acknowledge Your presence in this room and in our lives. You are the only all-knowing, all-powerful, and always present God. We are dependent upon you, for apart from You we can do nothing. We stand in the truth that all authority in heaven and on earth has been given to the resurrected Christ, and because we are in Christ, we share that authority in order to make disciples and set captives free. We ask You to guide us with Your Holy Spirit, protect us from deception and lead us into all truth. In Jesus’ name I pray, amen.";

export const openingDeclaration =
  "In the name and authority of the Lord Jesus Christ, I/ we command Satan and all evil spirits to release __________ in order that __________ can be free to know and choose to do the will of God. As children of God seated with Christ in the spirit realm, we agree that every enemy of the Lord Jesus Christ be bound to silence. We say to Satan and all your evil workers that you cannot inflict any pain or in any way prevent God’s will from being accomplished in _____________ life.";

export const stepsSections: StepsSection[] = [
  {
    id: "preparation",
    eyebrow: "Preparation",
    title: "Preparation",
    subtitle: "Review the events of your life.",
    sourcePages: "Pages 3-4",
    readings: [
      {
        paragraphs: [
          "Before going through the Steps to Freedom, review the events of your life to discern specific areas that might have become pathways for demonic attachment and may need to be addressed.",
        ],
      },
    ],
    prompts: [
      {
        id: "family-history",
        kind: "checklist",
        title: "Family History",
        items: [
          "Religious history of parents and grandparents",
          "Home life from childhood through high school",
          "History physical or emotional illness in the family",
          "Adoption, foster care, guardians",
        ],
        allowCustom: false,
      },
      {
        id: "personal-history",
        kind: "checklist",
        title: "Personal History",
        items: [
          "Eating habits (bulimia, binge eating, purging, anorexia, compulsive eating)",
          "Addictions (drugs and alcohol)",
          "Prescription medications (purpose)",
          "Sleeping patterns and nightmares",
          "Sexual, physical or emotional abuse",
          "Thoughts (obsessive, blasphemous, condemning, distracting, poor concentration",
          "Mental interference during church, prayer or Bible study",
          "Emotions (anger, anxiety, depression, bitterness, fear)",
          "Spiritual (salvation: when, how and level of assurance)",
        ],
        allowCustom: false,
      },
    ],
  },
  {
    id: "step-1",
    eyebrow: "STEP 1",
    title: "Real vs. Counterfeit",
    sourcePages: "Pages 4-7",
    readings: [
      {
        paragraphs: [
          "The first Step to freedom in Christ is to renounce your previous or current involvement with satanically-inspired occult practices and false cults and religions. You need to renounce any activity or group that denies Jesus Christ, offers guidance through any source other than the absolute authority of the written Word of God or requires secret initiations, ceremonies or covenants.",
          "Using the following Non-Christian Spiritual Experience Inventory, carefully check anything in which you have been involved. This list is not exhaustive, but it will guide you in identifying non-Christian spiritual experiences.",
        ],
      },
    ],
    openingPrayer:
      "Dear Heavenly Father, I ask you to guard my heart and my mind and reveal to me any and all involvement I have had, either knowingly or unknowingly, with cults or occult practices, false religions or false teachers. In Jesus’ name, I pray, amen",
    prompts: [
      {
        id: "non-christian-spiritual-experience",
        kind: "checklist",
        title: "Non-Christian Spiritual Experience Inventory",
        instruction: "Please check all that apply",
        items: [
          "Astral-projection",
          "Ouija board",
          "Table or body lifting",
          "Dungeons and Dragons",
          "Speaking in trance",
          "Automatic writing",
          "Magic Eight Ball",
          "Telepathy",
          "Using spells or curses",
          "Seance",
          "Materialization",
          "Clairvoyance",
          "Spirit guides",
          "Fortune-telling",
          "Tarot cards",
          "Palm reading",
          "Astrology",
          "Rod/pendulum (dousing)",
          "Self-hypnosis",
          "Mind swapping",
          "Black and white magic",
          "New Age medicine",
          "Blood pacts",
          "Self Mutilation",
          "Fetishism",
          "Object worship",
          "Crystals, charms",
          "Incubi and succubus",
          "Christian Science",
          "Unity Church",
          "The Way International",
          "Unification Church",
          "Mormonism",
          "Church of the Living Word",
          "Jehovah’s Witnesses",
          "Children Of God",
          "Church of New Jerusalem",
          "Masons",
          "New Age",
          "The Forum (EST)",
          "Spirit worship",
          "Buddhism",
          "Hare Krishna",
          "Bahaism",
          "Rosicrucianism",
          "Science of the Mind",
          "Transcendental Meditation",
          "Hinduism",
          "Yoga",
          "Echkankar",
          "Roy Masters",
          "Silva Mind Control",
          "father Divine",
          "Theosophical Society",
          "Islam",
          "Black Muslim",
          "Religion of martial arts",
        ],
        prayerTemplate:
          "Lord, I confess that I have participated in {{item}}, and I renounce {{item}}. Thank you that in Christ I am forgiven.",
        allowCustom: true,
      },
      {
        id: "step-1-questions",
        kind: "freeform",
        title: "Additional involvement",
        instruction:
          "The Steps ask six additional questions about hypnosis, imaginary friends or spirit guides, voices or repeating thoughts, other unusual spiritual experiences, vows/covenants/pacts, and satanic ritual worship. Add anything the Lord brings to mind.",
        prayerTemplate:
          "Lord, I confess that I have participated in {{item}}, and I renounce {{item}}. Thank you that in Christ I am forgiven.",
      },
    ],
    declarations: [
      {
        title: "Special renunciations",
        paragraphs: [
          "I renounce ever signing my name over to Satan or having had my name signed over to Satan. I announce that my name is now written in the Lamb’s Book of Life.",
          "I renounce any ceremony where I might have been wed to Satan. I announce that I am a child of God and a member and part of the body of Christ",
          "I renounce any and all covenants that I made with Satan. I announce that I am a partaker of the New Covenant with Christ",
          "I renounce all satanic assignments for my life, including duties, marriage and children. I announce and commit myself to know and do only the will of God and accept only His guidance.",
          "I renounce all spirit guides assigned to me. I announce and accept only the leading of the Holy Spirit.",
          "I renounce ever giving of my blood in the service of Satan. I trust only in the shed blood of my Lord Jesus Christ",
          "I renounce ever eating of flesh or drinking of blood for satanic worship. By faith I take Holy Communion which represents the body and the blood of the Lord Jesus Christ",
          "I renounce any and all guardians and Satanist parents who were assigned to me. I announce that God is my Father and the Holy Spirit is my Guardian by which I am sealed.",
          "I renounce any baptism in blood or urine whereby I am identified with Satan. I announce that I have been baptized into Christ Jesus and my identity is now in Christ.",
          "I renounce any and all sacrifices that were made on my behalf by which Satan may claim ownership of me. I announce that only the sacrifice of Christ has any hold on me. I belong to Him. I have been purchased by the blood of the Lamb.",
        ],
      },
    ],
  },
  {
    id: "step-2",
    eyebrow: "STEP 2",
    title: "Deception vs. Truth",
    sourcePages: "Pages 7-9",
    readings: [
      {
        paragraphs: [
          "Truth is the revelation of God’s Word, but we need to acknowledge the truth in the inner self (Psalm 51:6).",
          "How have you deceived or attempted to defend yourself according to the following: Please check any of the following that apply to you:",
        ],
      },
    ],
    openingPrayer:
      "Dear Heavenly Father, I know that You desire truth in the inner self and that facing this truth is the way of liberation (John 8:32). I acknowledge that I have been deceived by the father of lies (John 8:44) and that I have deceived myself (1 John 1:8). I pray in the name of the Lord Jesus Christ that You, Heavenly Father, will rebuke all deceiving spirits by virtue of the shed blood and resurrection of the Lord Jesus Christ. By faith I have received You into my life and I am now seated with Christ in the spirit realm. (Ephesians 2:6). I acknowledge that I have the responsibility and authority to resist the devil, and when I do, he will flee from me. I now ask the Holy Spirit to guide me into all truth (John 16:13). I ask You to “search me, O God, and know my heart; try me and know my anxious thoughts; and see if there be any hurtful way in me, and lead me in the everlasting way” (Psalm 139:23,24). In Jesus’ name, I pray. Amen.",
    prompts: [
      {
        id: "self-deception",
        kind: "checklist",
        title: "Self-Deception",
        items: [
          "Hearing God’s Word but not doing it (James 1:22; 4:17)",
          "Saying you have no sin (1 John 1:8)",
          "Thinking you are something when you aren’t (Galatians 6:3)",
          "Thinking you are wise in your own eyes (1 Corinthians 3:18,19)",
          "Thinking you will not reap what you sow (Galatians 6:7)",
          "Thinking the unrighteous will inherit the kingdom (1Corinthians 6:9)",
          "Thinking you can associate with bad company and not be corrupted (1 Corinthians 15:33)",
        ],
        prayerTemplate:
          "Lord, I agree that I have been deceiving myself in the area of {{item}}. Thank you for forgiving me. I commit myself to know and follow Your truth, amen.",
      },
      {
        id: "self-defense",
        kind: "checklist",
        title: "Self-Defense",
        instruction: "(Defending ourselves instead of trusting in Christ)",
        items: [
          "Denial (conscious or subconscious refusal to face the truth)",
          "Fantasy (escaping from the real world)",
          "Emotions insulation (withdrawing to avoid rejection)",
          "Regression (reverting back to a less threatening time)",
          "Displacement (taking out frustrations on others)",
          "Projection (blaming others)",
          "Rationalization (making excuses for poor behavior",
        ],
        prayerTemplate:
          "Lord, I agree that I have been deceiving myself in the area of {{item}}. Thank you for forgiving me. I commit myself to know and follow Your truth, amen.",
      },
    ],
    declarations: [
      {
        title: "Doctrinal Affirmation",
        paragraphs: [
          "I recognize that there is only one true and living God Exodus 20:2,3) who exists as the Father, Son and Holy Spirit and that He is worthy of all honour, praise and glory as the Creator, Sustainer and Beginning and End of all things. (Rev. 4:11: 5:9, 10; Isaiah 43:1,7,21).",
          "I recognize Jesus Christ as the Messiah, the Word who became flesh and dwelt among us (John 1:1, 14).",
          "I believe that God has proven His love for me because when I was still a sinner, Christ died for me (Romans 5:8). I believe that He delivered me fro the domain of darkness and transferred me to to His kingdom, and in Him I have redemption - the forgiveness of sins (Colossians 1:13,14).",
          "I believe that I am now a child of God (1 John 3:1-3) and that I am seated with Christ in the heavenlies (Ephesians 2:6). I believe that I was saved by the grace of God through faith, that it was a gift, and not the result of any works on my part (Ephesians 2:8,9).",
          "I choose to be strong in the Lord and in the strength of His might (Ephesians 6:10). I put no confidence in the flesh (Philippians 3:3) for the weapons of warfare are not of the flesh (2 Corinthians 10:4). I put on the whole armor of God (Ephesians 6:10-20), and I resolve to stand firm in my faith and resist the evil one.",
          "I believe that apart from Christ I can do nothing (John 15:5), so I declare myself dependent on Him. I choose to abide in Christ in order to bear much fruit and glorify the Lord (John 15:8). I announce to Satan that Jesus is my Lord (1 Corinthians 12:3), and I reject any counterfeit gifts or works of Satan in my life.",
        ],
      },
    ],
  },
  {
    id: "step-3",
    eyebrow: "STEP 3",
    title: "Bitterness vs. Forgiveness",
    sourcePages: "Pages 9-11",
    readings: [
      {
        paragraphs: [
          "We need to forgive others in order to be free from our pasts and to prevent Satan from taking advantage o us (2 Corinthians 2:10, 11).",
          "As names come to mind, list them on a separate sheet of paper. At the end of your list, write “myself”. Forgiving yourself is accepting God’s cleansing and forgiveness. Also, write “thoughts against God.”",
          "Forgiveness is a choice, a crisis of the will. Since God requires us to forgive, it is something we can do.",
          "You are now ready to forgive the people on your list so you can be free in Christ, with those people no longer having any control over you. For each person on your list, pray aloud:",
        ],
      },
    ],
    openingPrayer:
      "Dear heavenly Father, I thank You for the riches of Your kindness, forbearance and patience, knowing that Your kindness has led me to repentance (Romans 2:4). I confess that I have not extended that same patience and kindness toward others who have offended me, but instead I have harboured bitterness and resentment. I pray that during this time of self-examination You would bring to my mind those people whom I need to forgive in order that I may do so (Matthew 18:35). I ask this in the precious name of Jesus. Amen.",
    prompts: [
      {
        id: "forgiveness",
        kind: "forgiveness",
        title: "Forgive the people on your list",
        instruction:
          "Add one person, hurt, pain, or feeling at a time. Include “myself” and “thoughts against God” when appropriate.",
        prayerTemplate:
          "Lord, I forgive {{person}} for {{hurt}}.",
      },
    ],
    closingPrayer:
      "Lord, I release all these people to You, and I release my right to seek revenge. I choose not to hold on to my bitterness and anger, and I ask You to heal my damaged emotions. In Jesus’ name, I pray.",
  },
  {
    id: "step-4",
    eyebrow: "STEP 4",
    title: "Rebellion vs. Submission",
    sourcePages: "Pages 11-12",
    readings: [
      {
        paragraphs: [
          "We live in rebellious times. Many believe it is their right to sit in judgment of those in authority over them.",
          "We have two biblical responsibilities regarding authority figures: Pray for them and submit to them.",
        ],
      },
    ],
    openingPrayer:
      "Dear Lord, You have said that rebellion is like the sin of witchcraft and insubordination is like iniquity and idolatry (1Samuel 15:23). I know that in action and attitude I have sinned against You with a rebellious heart. Thank you for forgiving my rebellion, and I pray that by the shed blood of the Lord Jesus Christ all ground gained by evil spirits because of my rebelliousness will be cancelled. I pray that You will shed light on all my ways that I may know the full extent of my rebelliousness. I now choose to adopt a submissive spirit and a servant’s heart. In the name of Christ Jesus, I pray, Amen.",
    prompts: [
      {
        id: "authority",
        kind: "checklist",
        title: "Lines of authority in Scripture",
        items: [
          "Civil government (Romans 13:1-7; 1 Timothy 2:1-4; 1 Peter 2:13-17)",
          "Parents (Ephesians 6:1-3)",
          "Husbands (1 Peter 3-1-4) or wives (Ephesians 5:21; 1 Peter 3:7)",
          "Employers (1 Peter 3:18-23)",
          "Church leaders (Hebrews 13:17)",
          "God (Daniel 9:5,9)",
        ],
        prayerTemplate:
          "Lord, I agree I have been rebellious toward {{item}}. I choose to be submissive and obedient to your Word. In Jesus’ name, I pray, amen.",
        allowCustom: true,
      },
    ],
  },
  {
    id: "step-5",
    eyebrow: "Step 5",
    title: "Pride vs. Humility",
    sourcePages: "Pages 12-13",
    readings: [
      {
        paragraphs: [
          "Pride is a killer. Pride says, “ I can do it! I can get myself out of this mess without God or anyone else’s help. Oh no, we can’t!",
          "Having made that commitment, now allow God to show you any specific areas of your life where you have been prideful, such as:",
        ],
      },
    ],
    openingPrayer:
      "Dear Heavenly Father, You have said that pride goes before destruction and an arrogant spirit before stumbling (Proverbs 16:18). I confess that I have lived independently and have not denied myself, picked up my cross daily and followed You (Matthew 16:24). In so doing, I have given ground to the enemy in my life. I have believed that I could be successful and live victoriously by my own strength and resources. I now confess that I have sinned against You by placing my will before Yours and by centring my life around myself instead of You. I now renounce the self-life and by so doing cancel all the ground that has been gained in my members by the enemies of the Lord Jesus Christ. I pray that You will guide me so that I will do nothing from selfishness or empty conceit, but with humility of mind I will regard others as more important than myself (Philippians 2:3). Enable me through love to serve others and in honour prefer others (Romans 12:10). I ask this in the name of Christ Jesus, my Lord. Amen.",
    prompts: [
      {
        id: "pride",
        kind: "checklist",
        title: "Areas of pride",
        items: [
          "Having a stronger desire to do my will than God’s will",
          "Being more dependent upon my strengths and resources than God’s",
          "Too often believing that my ideas and opinions are better than others",
          "Being more concerned about controlling others than developing self-control",
          "Sometimes considering myself more important than others",
          "Having a tendency to think that I have no needs",
          "Finding it difficult to admit that I was wrong",
          "Having a tendency to be more of a people-pleaser than a God-pleaser",
          "Being overly concerned about getting the credit I deserve",
          "Being driven to obtain the recognition that comes from degrees, titles and positions",
          "Often thinking I am more humble than others",
        ],
        prayerTemplate:
          "Lord, I agree I have been prideful by {{item}}. I choose to humble myself and place all my confidence in You, amen.",
        allowCustom: true,
      },
    ],
  },
  {
    id: "step-6",
    eyebrow: "Step 6",
    title: "Bondage vs. Freedom",
    sourcePages: "Pages 13-16",
    readings: [
      {
        paragraphs: [
          "The next step to freedom deals with habitual sin.",
          "Confession is not saying “I’m sorry”; it’s saying, “I did it.”",
          "The deeds of the flesh are numerous. Many of the following issues are from Galatians 5:19-21. Check those that apply to you and any others you have struggled with that the Lord has brought to your mind.",
          "Note: Sexual sins, eating disorders, substance abuse, abortion, suicidal tendencies, perfectionism and fear will be dealt with later in this step.",
        ],
      },
    ],
    openingPrayer:
      "Father, You have told us to put on the Lord Jesus Christ and make no provision for the flesh in regard to its lust (Romans 13:14). I acknowledge that I have given in to fleshly lusts which wage war against my soul (1 Peter 2:11). I thank You that in Christ my sins are forgiven, but I have transgressed Your holy law and given the enemy an opportunity to wage war in my physical body (Romans 6:12,13); Ephesians 4:27; James 4:1; 1 Peter 5:8). I come before Your presence to acknowledge these sins and to seek Your cleansing (1 John 1:9), that I may be freed from the bondage of sin. I now ask You to reveal to my mind the ways that I have transgressed Your moral law and grieved the Holy Spirit. In Jesus’ precious name, I pray, amen.",
    prompts: [
      {
        id: "bondage",
        kind: "checklist",
        title: "Deeds of the flesh",
        items: [
          "Stealing",
          "Lying",
          "Fighting",
          "Jealousy",
          "Envying",
          "Outbursts of anger",
          "Complaining",
          "Criticizing",
          "Lusting",
          "Cheating",
          "Gossiping",
          "Controlling",
          "Procrastinating",
          "Swearing",
          "Greediness",
          "Laziness",
          "Divisiveness",
          "Gambling",
        ],
        prayerTemplate:
          "Dear Heavenly Father, I thank You that my sins are forgiven in Christ, but I have walked by the flesh and have sinned by {{item}}. Thank You for cleansing me of all unrighteousness. I ask that You would enable me to walk by the Spirit and not carry out the desires of the flesh. In Jesus’ name, I pray, amen.",
        allowCustom: true,
      },
      {
        id: "sexual-use",
        kind: "freeform",
        title: "Sexual sins or sexual difficulty",
        instruction:
          "As the Lord brings to your mind sexual sins you’ve committed, have been committed against you, i.e. rape, incest or other sexual abuse, or willingly by you, renounce each occasion.",
        prayerTemplate:
          "Lord, I renounce {{item}} and ask You to break the bond Satan has brought into my life through that involvement. I confess my participation. I now present my body to You as a living sacrifice, holy and acceptable to You, and I reserve the sexual use of my body only for marriage. I renounce the lie of Satan that my body is not clean, that it is dirty or in any way unacceptable as result of my past sexual experiences. Lord, I thank You that You have totally cleansed and forgiven me, that You love and accept me unconditionally. Therefore, I can accept myself. And I choose to do so and to accept myself and my body as cleansed. In Jesus name, I pray, amen.",
      },
    ],
    declarations: [
      {
        title: "Prayers for Specific Problems",
        paragraphs: [
          "Homosexuality: Lord, I renounce the lie that You have created me or anyone else to be homosexual, and I affirm that You clearly forbid homosexual behavior. I accept myself as a child of God and declare that You created me in my natural gender to worship you. I renounce any bondage of Satan or attachments of evil spirits that have perverted my relationships with others. I announce that I am free to relate to the opposite sex in the way that You intended. In Jesus’ name, I pray, amen.",
          "Abortion: Lord, I confess that I did not assume stewardship of the life You entrusted to me. I choose to accept your forgiveness, and I now commit that child to You for Your care in eternity. In Jesus’ name, I pray, amen.",
          "Suicidal Tendencies: Lord, I renounce suicidal thoughts and any attempts I have made to take my own life or in any way injure myself. I renounce the lie that life is hopeless and that I can find peace and freedom by taking my own life. Satan is a thief and he comes to steal, kill and destroy. I choose to be a good steward of the physical life that You have entrusted to me. In Jesus’ name I pray, amen.",
          "Addictions: Lord, I confess that I have used other things (alcohol, tobacco, food, prescription or street drugs, shopping, sex, entertainment, jogging, etc.) to escape reality or to cope with difficult situations and replace the joy of Your Holy Spirit. Lord, in doing so, I have become dependent on these other things rather than relying on you to help me through the life problems I’ve encountered and have opened a door for demonic interference and attachment in my life. Lord, I now confess this sin and ask for your cleansing power to restore me to wholeness and rely on You rather than things. I cast my anxiety onto Christ who loves me, and I commit myself to no longer yield to substance abuse, but to the Holy Spirit. By the power of Your death and resurrection I now command all demonic spirits to release their hold and attachment on me and to depart from me by the power of the blood of Christ my saviour. I now yield and commit myself to you, Thank you, Jesus, for the victory I now have in You, amen.",
          "Drivenness and Perfectionism: Lord, I renounce the lie that my self-worth is dependent upon my ability to perform. I announce the truth that my identity and sense of worth are found in who I am as Your child. I renounce seeking the approval and acceptance of other people, and I choose to believe that I am already approved and accepted in Christ because of His death and resurrection for me. I choose to believe the truth that I have been saved, not by deeds done in righteousness, but according to Your mercy. I choose to believe that I am no longer under the curse of the law because Christ became a curse for me. I receive the free gift of life in Christ and choose to abide in Him. I renounce striving for perfection by living under the law. By Your grace, Heavenly Father, I choose from this day forward to walk by faith according to what You have said is true by the power of Your Holy Spirit. In Jesus name, I pray, amen.",
          "Plaguing Fears: Dear Lord, you are my sanctuary. You have not given us a spirit of fear, but of power and love and a sound mind. I confess that I have given in to fear to exercise control over my life instead of trusting You. I now renounce all plaguing fears in my life as lies and announce that I trust You, Lord, in all areas of my life. Your Word tells me that You are in control of my life and that all things work together for good in my life as I am one who loves You and am called according to your purpose. Come Holy Spirit and fill me dispelling all darkness. I stand in your truth, Lord and receive your peace and joy, in the powerful name of Jesus, amen.",
        ],
      },
    ],
    closingPrayer:
      "Dear Lord, as I have now confessed these sins to You, I claim your forgiveness and cleansing through the blood of the Lord Jesus Christ. I cancel all ground that evil spirits have gained through my willful involvement in sin. I ask this in the wonderful name of my Lord and Saviour, Jesus Christ, amen.",
  },
  {
    id: "step-7",
    eyebrow: "Step 7",
    title: "Acquiescence vs. Renunciation",
    sourcePages: "Pages 16-17",
    readings: [
      {
        paragraphs: [
          "Acquiescence is passively giving in or agreeing without consent. The last step to freedom is to renounce the sins of your ancestors and any curses which may have been placed on you.",
          "You are not guilty for the sin of any ancestor, but because of their sin, Satan may have gained access to your family.",
        ],
      },
    ],
    openingPrayer:
      "Dear Lord, I thank You that I am a new creation in Christ. I desire to obey Your command to honour my mother and my father, but I also acknowledge that my physical heritage has not been perfect. I ask you to reveal to my mind the sins of my ancestors in order to confess renounce and forsake them. In Jesus’ name, I pray, amen.",
    prompts: [
      {
        id: "ancestors",
        kind: "freeform",
        title: "Sins and iniquities of my ancestors",
        instruction:
          "Name those that have come to mind. The declaration below keeps the wording of the Steps intact.",
      },
    ],
    declarations: [
      {
        title: "Declaration",
        paragraphs: [
          "I here and now reject and disown all the sins and iniquities of my ancestors, including: (name those that have come to mind). As one who has been delivered from the power of darkness and translated into the kingdom of God’s dear Son, I cancel out all demonic working that has been passed on to me from my ancestors. As one who has been crucified and raised with Jesus Christ and who sits with Him in heavenly places, I renounce all satanic assignments that are directed towards me, my family and my service to God, and I cancel every every curse that Satan and his workers have put on me. I announce to Satan and all his forces that Christ became a curse for me (Galatians 3:13) when He died for my sins on the cross.",
          "I reject any and every way in which Satan may claim ownership of me. I belong to the Lord Jesus Christ who purchased me with His own blood. I reject all other blood sacrifices whereby Satan may claim ownership of me. I declare myself to be eternally and completely signed over and committed to the Lord Jesus Christ. By the authority I have in Jesus Christ, I now command every spiritual enemy of the Lord Jesus Christ to leave my presence. I commit myself to my heavenly Father to do His will from this day forward.",
        ],
      },
    ],
    closingPrayer:
      "Dear Lord, I come to You as Your child purchased by the blood of the Lord Jesus Christ. You are the Lord of the universe and the Lord of my life. I submit my body to You as an instrument of righteousness, a living sacrifice, that I may glorify You in my body. I now ask You to fill me with Your Holy spirit. I commit myself to the renewing of my mind in order to prove that Your will is good, perfect and acceptable for me. All this I do in the name and authority of the Lord Jesus Christ, amen.",
  },
];

export const aftercareSections: ReadingBlock[] = [
  {
    title: "Aftercare",
    paragraphs: [
      "Freedom must be maintained. You have won a very important battle in an ongoing war. Freedom is yours as long as you keep choosing truth and standing firm in the strength of the Lord.",
      "Seek legitimate Christian fellowship where you can walk in the light and speak the truth in love.",
      "Study your Bible daily. Memorize key verses.",
      "Take every thought captive to the obedience of Christ. Assume responsibility of your thought life, reject the lie, choose the truth and stand firm in your position in Christ.",
      "Share your struggles openly with a trusted friend. You need at least one friend who will stand with you.",
      "Continue to seek your identity and self-worth in Christ.",
    ],
  },
  {
    title: "Daily Prayer",
    paragraphs: [
      "Heavenly Father, I honour You as my sovereign Lord. I acknowledge that You are always present with me. You are the only all-powerful and wise God. Your are kind and loving in all Your ways. I love You and thank You that I am united with Christ and spiritually alive in Him. I choose not to love the world, and I crucify the flesh and all its passions. Thank You for the life that I now have in Christ, and I ask You to fill me with Your Holy Spirit, that I may live my life free from sin. I declare my dependence up you, and I take my stand that I may live my life free form sin. I declare my dependence up on You, and I take my stand against Satan and all his lying ways. I choose to believe the truth and I refuse to be discouraged. You are the God of all hope, and I am confident that You will meet my needs as I seek to live a responsible life through Christ who strengthens me.",
    ],
  },
  {
    title: "In Christ I Am Accepted",
    paragraphs: [
      "John 1:12 - I am a child of God",
      "John 15:15 - I am Christ’s friend",
      "Romans 5:1 - I have been justified in Christ",
      "1 Corinthians 6:17 - I am united with the Lord, and I am one in spirit with Him",
      "1 Corinthians 6:20 - I have been bought with a price and belong to God",
      "Ephesians 1:1 - I am a saint",
      "Ephesians 1:5 - I have been adopted as God’s child",
      "Ephesians 2:18 - I have direct access to God through the Holy Spirit",
      "Colossians 1:14 - I have been redeemed and forgiven of all my sins",
      "Colossians 2:10 - I am complete in Christ",
    ],
  },
  {
    title: "In Christ I Am Secure",
    paragraphs: [
      "Romans 8:1,2 - I am free from condemnation",
      "Romans 8:28 - I am assured that all things work together for good",
      "Romans 8:31-34 - I am free from any condemning charges against me",
      "Romans 8:35-39 - I cannot be separated from the love of God",
      "2 Corinthians 1:21,22 - I have been established, anointed and sealed by God",
      "Colossians 3;3 - I am hidden with Christ in God",
      "Philippians 1:6 - I am confident that the good work God has begun in me will be perfected",
      "Philippians 3:20 - I am a citizen of heaven",
      "2 Timothy 1:7 - I have not been given a spirit of fear, but of power, love and a sound mind",
      "Hebrews 4:16 - I can find grace and mercy to help in time of need",
      "1 John 5:18 - I am born of God and the evil one cannot touch me",
    ],
  },
  {
    title: "In Christ I Am Significant",
    paragraphs: [
      "Matthew 5:13,14 - I am the salt and light of the earth",
      "John 15: 1,5 - I am a branch of the true vine, a channel of His life",
      "John 15:16 - I have been chosen and appointed to bear fruit",
      "Acts 1:8 - I am a personal witness of Christ",
      "1 Corinthians 3:16 - I am part of God’s temple",
      "2 Corinthians 5:17-21 - I am a minister of reconciliation for God",
      "2 Corinthians 6:1 - I am God’s coworker (1Corinthians 3:9)",
      "Ephesians 2:6 - I am seated with Christ in the heavenly realm",
      "Ephesians 2:10 - I am God’s workmanship",
      "Ephesians 3:12 - I may approach God with freedom and confidence",
      "Philippians 4:13 - I can do all things through Christ who strengthens me",
    ],
  },
];
