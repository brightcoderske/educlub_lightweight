// The typing tutor curriculum.
//
// Every level teaches one specific thing and only uses keys the learner has
// already met, so a child can finish a level with the fingers they have been
// taught rather than hunting for a letter nobody showed them. Levels start on
// the home row, add two keys at a time, and end on full paragraphs.
//
// The five activities inside a level are deliberately different in kind:
// isolated keys, then those keys among others, then real words, then sentences,
// then a longer mixed passage. They are not one drill under five names.

const HOME_ROW_FINGERS = {
  a: "left little finger",
  s: "left ring finger",
  d: "left middle finger",
  f: "left index finger",
  g: "left index finger, reaching in",
  h: "right index finger, reaching in",
  j: "right index finger",
  k: "right middle finger",
  l: "right ring finger",
  ";": "right little finger",
};

const REACH_FINGERS = {
  q: "left little finger, reaching up",
  w: "left ring finger, reaching up",
  e: "left middle finger, reaching up",
  r: "left index finger, reaching up",
  t: "left index finger, reaching up and in",
  y: "right index finger, reaching up and in",
  u: "right index finger, reaching up",
  i: "right middle finger, reaching up",
  o: "right ring finger, reaching up",
  p: "right little finger, reaching up",
  z: "left little finger, reaching down",
  x: "left ring finger, reaching down",
  c: "left middle finger, reaching down",
  v: "left index finger, reaching down",
  b: "left index finger, reaching down and in",
  n: "right index finger, reaching down and in",
  m: "right index finger, reaching down",
  ",": "right middle finger, reaching down",
  ".": "right ring finger, reaching down",
  "/": "right little finger, reaching down",
};

export function fingerForKey(key) {
  const lower = String(key || "").toLowerCase();
  if (lower === " ") return "either thumb on the space bar";
  if (!lower) return "";
  if (lower !== key)
    return `${
      HOME_ROW_FINGERS[lower] || REACH_FINGERS[lower] || "the nearest finger"
    }, with the opposite Shift`;
  return HOME_ROW_FINGERS[lower] || REACH_FINGERS[lower] || "the nearest comfortable finger";
}

// --- Beginner: the home row, then two new keys at a time. -------------------
const beginnerLevels = [
  {
    newKeys: "f j",
    focus: "Find the two bumps",
    teaches:
      "Your index fingers live on F and J. Both keys have a small bump, so you can find them without looking down.",
    words: [],
    phrases: [],
  },
  {
    newKeys: "d k s l",
    focus: "Fill in the middle fingers",
    teaches:
      "D and K sit beside F and J, then S and L. Every finger goes straight back to its own key after it presses.",
    words: [],
    phrases: [],
  },
  {
    newKeys: "a ;",
    focus: "Complete the home row",
    teaches:
      "Your little fingers reach A and the semicolon. That is the whole home row, so real words start here.",
    words: ["as", "ask", "all", "add", "dad", "sad", "lad", "fall", "lass", "flask", "salad"],
    phrases: ["dad asks a lad", "all lads ask dad", "a sad lass falls"],
  },
  {
    newKeys: "",
    focus: "Home row words",
    teaches:
      "No new keys this level. Build speed on words you can already reach, and keep your eyes on the screen.",
    words: ["ask", "asks", "adds", "falls", "salad", "flask", "alas", "lads", "dads", "salads"],
    phrases: [
      "dad asks a lad; a lass adds salad",
      "all dads ask; all lads fall",
      "a lass adds a salad",
    ],
  },
  {
    newKeys: "g h",
    focus: "Reach in with your index fingers",
    teaches:
      "G and H sit beside F and J. Stretch your index finger sideways, press, then bring it home again.",
    words: ["glad", "half", "hall", "flash", "gala", "sash", "dash", "has", "had", "gas", "glass"],
    phrases: ["dad had a glass", "a glad lass has half a salad", "all lads dash; dad shall ask"],
  },
  {
    newKeys: "e i",
    focus: "Your first vowels above home",
    teaches:
      "E and I sit above D and K. Lift the middle fingers, press, and drop straight back down.",
    words: [
      "idea",
      "field",
      "like",
      "said",
      "hide",
      "life",
      "safe",
      "side",
      "deal",
      "heal",
      "shield",
    ],
    phrases: [
      "he said she likes a safe field",
      "a glad kid deals like his dad",
      "his idea is a safe deal",
    ],
  },
  {
    newKeys: "r u",
    focus: "Index fingers reach up",
    teaches: "R sits above F and U above J. The same fingers as the bumps, just one row higher.",
    words: [
      "girl",
      "ride",
      "rush",
      "hard",
      "guide",
      "sure",
      "rule",
      "hair",
      "fresh",
      "drill",
      "arise",
    ],
    phrases: ["her guide is fair", "a girl rides hard", "she is sure her drills are easier"],
  },
  {
    newKeys: "t y",
    focus: "The long index reach",
    teaches:
      "T and Y are the furthest stretch for your index fingers. Keep your wrists still and let the finger travel.",
    words: [
      "that",
      "they",
      "style",
      "tidy",
      "dirty",
      "truth",
      "try",
      "hat",
      "star",
      "first",
      "artist",
    ],
    phrases: [
      "the tidy artist likes stars",
      "try that first drill",
      "they said the truth is steady",
    ],
  },
  {
    newKeys: "o w",
    focus: "Ring fingers reach up",
    teaches:
      "O sits above L and W above S. Ring fingers do the least work, so give them a slow, clear press.",
    words: [
      "world",
      "would",
      "show",
      "work",
      "glow",
      "follow",
      "water",
      "how",
      "low",
      "older",
      "yellow",
    ],
    phrases: [
      "she works slowly with a good idea",
      "the water shows a low glow",
      "follow the older road",
    ],
  },
  {
    newKeys: "n m",
    focus: "Index fingers reach down",
    teaches:
      "N and M sit below J. Curl your right index finger down, press, and return to the bump.",
    words: [
      "money",
      "name",
      "month",
      "learn",
      "mind",
      "human",
      "moon",
      "main",
      "morning",
      "moment",
    ],
    phrases: [
      "many students learn to write with a smile",
      "we learn the main idea one more time",
      "on a warm morning we learn a new name",
    ],
  },
];

// --- Intermediate: finish the alphabet, then capitals and punctuation. ------
const intermediateLevels = [
  {
    newKeys: "c v",
    focus: "Bottom row, middle fingers",
    teaches: "C sits below D and V below F. Curl down without lifting your hand off the row.",
    words: ["clever", "cover", "voice", "active", "vocal", "service", "recover", "careful"],
    phrases: [
      "a clever voice covers the room",
      "the active service recovers",
      "cover the vocal notes",
    ],
  },
  {
    newKeys: "b",
    focus: "The longest bottom reach",
    teaches: "B is a long stretch for your left index finger. Move the finger, not the arm.",
    words: ["brave", "black", "better", "table", "number", "double", "trouble", "birthday"],
    phrases: [
      "a brave number sits on the black table",
      "better double the trouble",
      "bring a better book",
    ],
  },
  {
    newKeys: "p",
    focus: "Right little finger reaches up",
    teaches: "P sits above the semicolon. Your smallest finger travels furthest, so give it time.",
    words: ["people", "simple", "paper", "happy", "prepare", "purple", "explore", "propose"],
    phrases: [
      "happy people prepare simple paper",
      "purple paper helps people explore",
      "prepare a simple plan",
    ],
  },
  {
    newKeys: "q z",
    focus: "The rare corner keys",
    teaches:
      "Q and Z are the least used letters, both on your left little finger. Meet them once and move on.",
    words: ["quiz", "quick", "zebra", "zone", "quiet", "squeeze", "prize", "amazing", "puzzle"],
    phrases: [
      "a quick zebra wins the quiz prize",
      "squeeze into the quiet zone",
      "an amazing puzzle",
    ],
  },
  {
    newKeys: "x",
    focus: "The whole alphabet",
    teaches: "X completes every letter. From here on, nothing on the keyboard is new to you.",
    words: ["box", "next", "expert", "explain", "exact", "mixed", "relax", "excellent", "example"],
    phrases: [
      "the expert explains the exact example",
      "relax and open the next box",
      "mixed excellent work",
    ],
  },
  {
    newKeys: "Shift",
    focus: "Capital letters",
    teaches:
      "Hold Shift with the little finger on the opposite hand from the letter. Left Shift for right-hand letters, right Shift for left-hand letters.",
    words: ["Nairobi", "Kenya", "Monday", "Africa", "Amina", "Brian", "Grace", "Joseph"],
    phrases: [
      "Amina and Brian live in Nairobi",
      "On Monday Grace visits Lake Victoria",
      "Kenya is in Africa",
    ],
  },
  {
    newKeys: ". ,",
    focus: "Full stops and commas",
    teaches:
      "The full stop is under your right ring finger and the comma under your right middle finger. One space follows each.",
    words: ["yes,", "no,", "first,", "then,", "finally.", "today.", "later,", "school."],
    phrases: [
      "First, we read. Then, we write.",
      "Today, Grace read a book, wrote a page, and drew a map.",
      "We practise, we rest, and we try again.",
    ],
  },
  {
    newKeys: "' ?",
    focus: "Apostrophes and questions",
    teaches:
      "The apostrophe sits beside the semicolon. A question mark is Shift with the slash key under your right little finger.",
    words: ["don't", "it's", "we're", "can't", "what?", "why?", "who's", "where?"],
    phrases: [
      "What's the answer? It's on the next page.",
      "Why don't we try again? We're nearly there.",
      "Who's ready? Grace can't wait.",
    ],
  },
  {
    newKeys: "",
    focus: "Sentences that look real",
    teaches:
      "Real writing mixes capitals, commas, full stops and questions. Read one sentence ahead as you type.",
    words: [],
    phrases: [
      'Grace asked, "Where is the library?" Brian pointed at the tall gate.',
      "We packed books, pens, and a water bottle. Then we walked to school.",
      "It's a long walk, but it's worth it. Don't you think so?",
    ],
  },
  {
    newKeys: "",
    focus: "Your first paragraph",
    teaches:
      "Several sentences in a row, without stopping. Keep a steady rhythm instead of racing and resting.",
    words: [],
    phrases: [
      "Amina walks to school every morning. She carries a blue bag with three books inside. On the way she counts the birds sitting on the fence.",
      "The rain started just after lunch. We moved the chairs inside, closed the windows, and finished our reading by the door.",
    ],
  },
];

// --- Advanced: numbers, symbols and real paragraphs. ------------------------
const advancedLevels = [
  {
    newKeys: "1 2 3 4 5",
    focus: "The left number row",
    teaches:
      "Numbers sit above the letters, one finger per column. Reach up from the home row and come straight back.",
    words: ["12", "34", "45", "2025", "15", "31", "24", "53"],
    phrases: ["We counted 12 desks, 34 chairs and 5 doors.", "Term 2 begins on 15 May 2025."],
  },
  {
    newKeys: "6 7 8 9 0",
    focus: "The right number row",
    teaches: "The right hand covers 6 to 0. Keep your index fingers anchored so you do not drift.",
    words: ["67", "89", "90", "78", "100", "2000", "60", "1998"],
    phrases: ["The school opened in 1998 and now has 890 learners.", "Add 67 and 89 to get 156."],
  },
  {
    newKeys: "- = +",
    focus: "Everyday symbols",
    teaches:
      "Dashes, equals and slashes appear in dates, sums and web addresses. Keep the little fingers relaxed.",
    words: ["3+4=7", "10-2=8", "24/7", "half-way", "well-known", "5+5=10"],
    phrases: ["If 3+4=7, then 7-4=3.", "The shop is open 24/7 and is well-known."],
  },
  {
    newKeys: "( ) :",
    focus: "Brackets and colons",
    teaches:
      "Brackets and colons need Shift. Press Shift first, hold it, then the key, then release both.",
    words: ["(yes)", "(no)", "note:", "list:", "(2025)", "time:"],
    phrases: [
      "Bring the following: a pen, a ruler (30 cm) and your notebook.",
      "Note: the trip is on Friday (14 June).",
    ],
  },
  {
    newKeys: "@ # & !",
    focus: "Symbols you will actually use",
    teaches: "Email and web addresses need these. Shift plus a number key gives you each one.",
    words: ["grace@school.ke", "#1", "Stop!", "Well done!", "#top"],
    phrases: [
      "Send it to grace@school.ke before Friday!",
      "We bought milk & bread and came #1 in the race.",
    ],
  },
  {
    newKeys: "",
    focus: "Sustained typing",
    teaches:
      "Longer passages test rhythm, not bursts. Breathe normally and keep your eyes one line ahead of your fingers.",
    words: [],
    phrases: [
      "A good typist is not the fastest person in the room. A good typist is the one who holds the same steady rhythm from the first word to the last, making very few mistakes along the way.",
    ],
  },
  {
    newKeys: "",
    focus: "Mixed case and punctuation",
    teaches:
      "Capitals, commas and full stops now arrive without warning. Let your little fingers do the Shift work.",
    words: [],
    phrases: [
      "On Tuesday, Mrs Otieno asked the class a simple question: what makes a story worth reading? Brian said it was the ending. Amina said it was the people. Both answers were right.",
    ],
  },
  {
    newKeys: "",
    focus: "Numbers inside sentences",
    teaches:
      "Moving between letters and numbers is the hardest switch. Anchor on F and J after every number.",
    words: [],
    phrases: [
      "The library holds 4,200 books across 12 shelves. In 2024 the learners borrowed 3,150 of them, which is about 75 books every week of the school year.",
    ],
  },
  {
    newKeys: "",
    focus: "Endurance",
    teaches:
      "This passage is long on purpose. Finishing it steadily matters more than finishing it quickly.",
    words: [],
    phrases: [
      "Learning to type well is a quiet kind of progress. For the first few weeks nothing seems to change, and every word feels slower than writing by hand. Then one afternoon you notice that your fingers have found a key without being told, and that you have typed a whole sentence while looking only at the screen.",
    ],
  },
  {
    newKeys: "",
    focus: "Everything together",
    teaches:
      "Letters, capitals, numbers and punctuation in one passage. This is what real typing looks like.",
    words: [],
    phrases: [
      'In 2019, a small school in Kisumu bought 15 second-hand computers. By 2023, every one of its 240 learners could type at least 25 words per minute. The head teacher, Mr Wanjala, said the change came from 20 quiet minutes of practice each day: "We never rushed. We simply never skipped a day."',
    ],
  },
];

// --- Speed builder: familiar words, pushed faster. --------------------------
const speedLevels = [
  {
    newKeys: "",
    focus: "The commonest words",
    teaches:
      "These words make up a quarter of everything you will ever type. Learn them as shapes, not letters.",
    words: [
      "the",
      "and",
      "for",
      "you",
      "that",
      "with",
      "this",
      "have",
      "from",
      "they",
      "what",
      "when",
    ],
    phrases: [],
  },
  {
    newKeys: "",
    focus: "Two-word pairs",
    teaches: "Type common pairs as one movement rather than two separate words.",
    words: ["of the", "in the", "to be", "we can", "you are", "it is", "at home", "on time"],
    phrases: [],
  },
  {
    newKeys: "",
    focus: "Short sentences at pace",
    teaches: "Short sentences let you push speed without losing the thread.",
    words: [],
    phrases: [
      "We can do this today.",
      "It is time to go home.",
      "They are ready for the test.",
      "You have done very well.",
    ],
  },
  {
    newKeys: "",
    focus: "Common word endings",
    teaches:
      "Endings like -ing and -tion repeat constantly. Drill them until they feel like one key.",
    words: ["running", "reading", "writing", "action", "station", "question", "quickly", "slowly"],
    phrases: [],
  },
  {
    newKeys: "",
    focus: "Sentences without pausing",
    teaches:
      "Do not stop between sentences. The full stop, the space and the next capital are one movement.",
    words: [],
    phrases: ["The bus was late. We waited by the gate. Nobody minded very much."],
  },
  {
    newKeys: "",
    focus: "Everyday writing",
    teaches: "Messages and notes are what you will type most. Practise them at speed.",
    words: [],
    phrases: [
      "Please bring your notebook to class tomorrow. We will finish the story we started last week.",
    ],
  },
  {
    newKeys: "",
    focus: "Longer bursts",
    teaches: "Three sentences in one run. Keep the same pace on the third as on the first.",
    words: [],
    phrases: [
      "The match starts at four. Bring water and a hat. We will meet by the far goalpost and walk over together.",
    ],
  },
  {
    newKeys: "",
    focus: "Speed with capitals",
    teaches: "Capitals slow most typists down. Keep the Shift finger moving with the rest.",
    words: [],
    phrases: [
      "On Friday, Amina and Joseph will present their science project to Mrs Otieno and the whole of Grade Six.",
    ],
  },
  {
    newKeys: "",
    focus: "Paragraph pace",
    teaches:
      "A full paragraph at speed. Read ahead so your fingers are never waiting for your eyes.",
    words: [],
    phrases: [
      "Every skill worth having starts out feeling clumsy. The trick is to keep going long enough for the clumsy part to end, because it always does, usually sooner than you expect.",
    ],
  },
  {
    newKeys: "",
    focus: "Full speed run",
    teaches:
      "Your final speed test. Everything you have learned, at the fastest pace you can hold cleanly.",
    words: [],
    phrases: [
      "Typing is one of the few skills that pays you back every single day. Whether you are writing a message to a friend, an answer in an exam, or the first line of a program, the words arrive faster than you can second-guess them, and that changes how you think.",
    ],
  },
];

// --- Accuracy master: slow down, get it exactly right. ----------------------
const accuracyLevels = [
  {
    newKeys: "",
    focus: "Letters that swap",
    teaches:
      "B and D, P and Q look alike and feel alike. Say each one in your head as you press it.",
    words: ["bad", "dab", "pad", "bap", "quid", "bead", "dead", "deep", "beep"],
    phrases: [],
  },
  {
    newKeys: "",
    focus: "Double letters",
    teaches: "Double letters need two clean presses, not one long one.",
    words: ["letter", "coffee", "little", "happy", "rubbish", "success", "address", "committee"],
    phrases: [],
  },
  {
    newKeys: "",
    focus: "Words people mistype",
    teaches: "These are the words that trip up almost everyone. Type them slowly and correctly.",
    words: [
      "because",
      "necessary",
      "separate",
      "definitely",
      "receive",
      "believe",
      "beautiful",
      "government",
    ],
    phrases: [],
  },
  {
    newKeys: "",
    focus: "Numbers and letters together",
    teaches: "Switching rows is where errors hide. Anchor on F and J between every switch.",
    words: ["A1", "B2", "room 14", "page 207", "Grade 6", "2025A", "flight KQ102"],
    phrases: [],
  },
  {
    newKeys: "",
    focus: "Punctuation density",
    teaches:
      "A line with a lot of punctuation. Every mark counts as a character, so none may be skipped.",
    words: [],
    phrases: ['"Wait," she said, "isn\'t that Joseph\'s bag?" And it was.'],
  },
  {
    newKeys: "",
    focus: "Careful sentences",
    teaches:
      "Speed is not being measured here. Aim for a clean run from the first key to the last.",
    words: [],
    phrases: [
      "The committee definitely believes it is necessary to separate the two addresses before Friday.",
    ],
  },
  {
    newKeys: "",
    focus: "Quotations",
    teaches: "Opening and closing quotation marks must match. Check each pair as you close it.",
    words: [],
    phrases: ['Mrs Otieno said, "Read the question twice." Brian replied, "I already have."'],
  },
  {
    newKeys: "",
    focus: "Lists and colons",
    teaches: "Lists punish careless spacing. One space after each comma, none before.",
    words: [],
    phrases: ["Bring the following: a pencil, a ruler, two exercise books, and a bottle of water."],
  },
  {
    newKeys: "",
    focus: "A precise paragraph",
    teaches: "One long paragraph, zero tolerance. Slow down wherever you feel yourself guessing.",
    words: [],
    phrases: [
      "It is necessary to separate the two departments, because the committee believes the receipt was definitely received at the beautiful old building on Jomo Kenyatta Avenue.",
    ],
  },
  {
    newKeys: "",
    focus: "The final check",
    teaches:
      "Your last accuracy test. Every capital, comma and full stop must land exactly where it belongs.",
    words: [],
    phrases: [
      'On 14 March 2024, the committee agreed: "We will separate the two departments, review every address, and report back before the end of Term 2." Nobody disagreed, and the meeting finished early for once.',
    ],
  },
];

const trackDefinitions = [
  {
    key: "beginner",
    title: "Beginner",
    description:
      "Start on the home row and add two keys at a time until you can type without looking.",
    baseGoalWpm: 8,
    levels: beginnerLevels,
    showKeyboard: true,
  },
  {
    key: "intermediate",
    title: "Intermediate",
    description: "Finish the alphabet, then learn capitals and punctuation.",
    baseGoalWpm: 16,
    levels: intermediateLevels,
    showKeyboard: true,
  },
  {
    key: "advanced",
    title: "Advanced",
    description: "Numbers, symbols and real paragraphs typed the way you will actually use them.",
    baseGoalWpm: 24,
    levels: advancedLevels,
    showKeyboard: false,
  },
  {
    key: "speed-builder",
    title: "Speed Builder",
    description: "Familiar words and sentences, pushed faster until the pace feels normal.",
    baseGoalWpm: 30,
    levels: speedLevels,
    showKeyboard: false,
  },
  {
    key: "accuracy-master",
    title: "Accuracy Master",
    description:
      "Slow down just enough to remove every error, then hold that standard on long passages.",
    baseGoalWpm: 22,
    levels: accuracyLevels,
    showKeyboard: false,
  },
];

// The five activity kinds. The keys are unchanged from the first release so that
// learner progress already recorded against them is still recognised.
const activityKinds = [
  {
    key: "finger-map",
    title: "Finger Map",
    seconds: 45,
    accuracyGoal: 85,
    kind: "keys",
    teaches: "Meet the new keys on their own, in a steady rhythm.",
  },
  {
    key: "key-hunt",
    title: "Key Hunt",
    seconds: 45,
    accuracyGoal: 88,
    kind: "mixed_keys",
    teaches: "Find the new keys among the ones you already know.",
  },
  {
    key: "glow-key",
    title: "Word Builder",
    seconds: 50,
    accuracyGoal: 90,
    kind: "words",
    teaches: "Turn the keys into whole words without stopping between letters.",
  },
  {
    key: "word-sprint",
    title: "Sentence Flow",
    seconds: 60,
    accuracyGoal: 92,
    kind: "sentences",
    teaches: "Join words into sentences and hold one rhythm throughout.",
  },
  {
    key: "level-boss",
    title: "Level Boss",
    seconds: 75,
    accuracyGoal: 94,
    kind: "boss",
    teaches: "This level and the one before it, mixed together in a longer run.",
  },
];

function fitToLength(pieces, targetLength) {
  if (!pieces.length) return "";
  const parts = [];
  let length = 0;
  let index = 0;
  while (length < targetLength) {
    const piece = pieces[index % pieces.length];
    parts.push(piece);
    length += piece.length + 1;
    index += 1;
  }
  return parts.join(" ").trim();
}

// A drill line for keys on their own. `shape` varies the rhythm so that the five
// activities in a keys-only level are five different exercises rather than the
// same line printed at five lengths.
function buildKeyDrill(keys, targetLength, shape = 0) {
  const letters = keys.filter((key) => key.length === 1);
  if (!letters.length) return fitToLength(keys, targetLength);

  const pairs = [];
  for (let index = 0; index < letters.length; index += 1) {
    const next = letters[(index + 1) % letters.length];
    if (next !== letters[index]) pairs.push([letters[index], next]);
  }

  const patterns = [];
  if (shape === 0) {
    // Single presses, then doubles: meet each key on its own.
    letters.forEach((letter) => patterns.push(letter, letter.repeat(2)));
  } else if (shape === 1) {
    // Alternate between the two keys, which usually means the two hands.
    pairs.forEach(([left, right]) => patterns.push(`${left}${right}`, `${right}${left}`));
  } else if (shape === 2) {
    // Sandwiches: reach for the second key, then return to the first.
    pairs.forEach(([left, right]) =>
      patterns.push(`${left}${right}${left}`, `${right}${left}${right}`)
    );
  } else if (shape === 3) {
    // Four-letter blocks, the length of a short word.
    pairs.forEach(([left, right]) =>
      patterns.push(`${left}${left}${right}${right}`, `${left}${right}${left}${right}`)
    );
  } else {
    // Everything mixed, finishing with the whole set in order.
    letters.forEach((letter) => patterns.push(letter.repeat(3)));
    pairs.forEach(([left, right]) => patterns.push(`${left}${right}${right}${left}`));
    patterns.push(letters.join(""));
  }

  if (!patterns.length) patterns.push(letters.join(""));
  return fitToLength(patterns, targetLength);
}

// The new keys interleaved with keys from earlier levels.
function buildMixedDrill(newKeys, knownKeys, targetLength, shape = 0) {
  const fresh = newKeys.filter((key) => key.length === 1);
  const known = knownKeys.filter((key) => key.length === 1 && !fresh.includes(key));
  if (!fresh.length) return buildKeyDrill(knownKeys, targetLength, shape);
  if (!known.length) return buildKeyDrill(fresh, targetLength, shape);

  // Both the partner keys and the cluster shape change per activity, so a level
  // with only two known keys to draw on still gives five different exercises.
  const clusters = [];
  fresh.forEach((letter, index) => {
    const left = known[(index + shape) % known.length];
    const right = known[(index + shape + 1) % known.length];
    if (shape % 3 === 0) {
      clusters.push(`${left}${letter}${left}`, `${letter}${right}${letter}`);
    } else if (shape % 3 === 1) {
      clusters.push(`${left}${letter}${right}`, `${right}${letter}${left}`);
    } else {
      clusters.push(`${letter}${left}${right}${letter}`, `${left}${letter}${letter}${right}`);
    }
  });
  return fitToLength(clusters, targetLength);
}

function levelKeyLetters(levels, levelIndex) {
  const letters = [];
  for (let index = 0; index <= levelIndex; index += 1) {
    (levels[index].newKeys || "")
      .split(/\s+/)
      .filter((key) => key.length === 1)
      .forEach((key) => {
        if (!letters.includes(key)) letters.push(key);
      });
  }
  return letters;
}

// The distinct words of a passage, in order of first appearance. Typing the
// vocabulary of a paragraph before the paragraph itself is what makes a long
// passage feel possible rather than daunting.
function uniqueWords(phrases) {
  const seen = new Set();
  const output = [];
  phrases.forEach((phrase) => {
    String(phrase)
      .split(/\s+/)
      .filter(Boolean)
      .forEach((word) => {
        const token = word.toLowerCase();
        if (seen.has(token)) return;
        seen.add(token);
        output.push(word);
      });
  });
  return output;
}

// Sentences and clauses, so a learner meets a long passage in short pieces.
function splitIntoClauses(phrases) {
  return phrases
    .flatMap((phrase) => String(phrase).split(/(?<=[.?!,:])\s+/))
    .map((clause) => clause.trim())
    .filter(Boolean);
}

// Rotating the start point gives each activity a different order of the same
// material, so nobody passes a level by memorising a sequence.
function rotate(items, by) {
  if (!items.length) return items;
  const offset = ((by % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

// The words most likely to slow a learner down. Warming up on these rather than
// on the whole passage is what makes a long paragraph feel approachable, and it
// keeps the warm-up visibly different from the passage itself.
function hardestWords(phrases, count) {
  return uniqueWords(phrases)
    .filter((word) => word.length > 3)
    .sort((left, right) => right.length - left.length)
    .slice(0, count);
}

// Every level follows the same five-step arc: warm up on the smallest pieces,
// work up to the whole thing, then repeat it with the previous level mixed in.
//
// How each step is built depends on what the level actually teaches. A level
// that introduces keys drills those keys; a level that introduces no keys works
// on its own words and sentences. The distinction matters, because without it a
// paragraph level five levels after the number row would drill digits instead
// of the paragraph it is actually about.
function buildActivityText(activityIndex, context) {
  const { level, previousLevel, newKeys, knownKeys, targetLength } = context;
  const words = level.words || [];
  const phrases = level.phrases || [];
  const shape = activityIndex;
  const fit = (pieces) => fitToLength(pieces.filter(Boolean), targetLength);
  const drill = () => buildMixedDrill(newKeys, knownKeys, targetLength, shape);

  // Step 5, the Level Boss, is the same idea everywhere: the previous level
  // first, then this one. Leading with the review means the boss opens
  // differently from Sentence Flow instead of restating it.
  if (activityIndex === 4) {
    const review = [...(previousLevel?.phrases || []), ...(previousLevel?.words || []).slice(0, 6)];
    if (review.length) return fit([...review, ...phrases, ...words.slice(0, 6)]);

    // The first level of a track has nothing to review. Start partway through
    // the word bank and then run the sentences, so the boss opens on different
    // text from both Word Builder and Sentence Flow rather than repeating one.
    if (words.length) {
      return fit([...rotate(words, Math.max(1, Math.floor(words.length / 3))), ...phrases]);
    }
    if (phrases.length) return fit(rotate(splitIntoClauses(phrases), 1));
    return drill();
  }

  // A level that introduces keys: the keys alone, then among known keys, then
  // words, then sentences. Early levels have no vocabulary yet, so they stay on
  // drills rather than pretending letter soup is words.
  if (newKeys.length) {
    if (activityIndex === 0) return buildKeyDrill(newKeys, targetLength, shape);
    if (activityIndex === 2 && words.length) return fit(words);
    if (activityIndex === 3 && phrases.length) return fit(phrases);
    return drill();
  }

  // A level with a word bank: each word twice, reversed, in order, then the
  // level's sentences if it has any.
  if (words.length) {
    if (activityIndex === 0) return fit(words.flatMap((word) => [word, word]));
    if (activityIndex === 1) return fit([...words].reverse());
    if (activityIndex === 2) return fit(words);
    return phrases.length ? fit(phrases) : fit(rotate(words, Math.ceil(words.length / 2)));
  }

  // A level that is one passage: its hardest words doubled, that vocabulary
  // reversed, its clauses starting from the middle, then the passage itself.
  // Each step opens on different text, so none of them reads as a rehearsal of
  // the one before.
  if (phrases.length) {
    if (activityIndex === 0) return fit(hardestWords(phrases, 12).flatMap((word) => [word, word]));
    if (activityIndex === 1) return fit([...uniqueWords(phrases)].reverse());
    if (activityIndex === 2) {
      const clauses = splitIntoClauses(phrases);
      // A single unpunctuated sentence has nothing to split, and returning it
      // whole here would just be Sentence Flow one step early. Run the
      // vocabulary from the middle instead.
      if (clauses.length < 2) {
        const vocabulary = uniqueWords(phrases);
        return fit(rotate(vocabulary, Math.floor(vocabulary.length / 2)));
      }
      return fit(rotate(clauses, Math.floor(clauses.length / 2)));
    }
    return fit(phrases);
  }

  return drill();
}

export function buildTypingPracticePath() {
  return trackDefinitions.map((track, trackIndex) => ({
    key: track.key,
    title: track.title,
    description: track.description,
    baseGoalWpm: track.baseGoalWpm,
    showKeyboard: track.showKeyboard,
    levels: track.levels.map((level, levelIndex) => {
      const levelNumber = levelIndex + 1;
      const newKeys = (level.newKeys || "").split(/\s+/).filter((key) => key.length === 1);
      const knownKeys = levelKeyLetters(track.levels, levelIndex);
      const previousLevel = track.levels[levelIndex - 1] || null;

      return {
        number: levelNumber,
        title: `Level ${levelNumber}`,
        focus: level.focus,
        teaches: level.teaches,
        newKeys: level.newKeys || "",
        goalWpm: track.baseGoalWpm + levelIndex * 2,
        activities: activityKinds.map((template, activityIndex) => {
          // Passages lengthen with the track, the level and the activity, so the
          // final Level Boss is a full paragraph rather than a repeated phrase.
          const text = buildActivityText(activityIndex, {
            level,
            previousLevel,
            newKeys,
            knownKeys,
            targetLength: 48 + trackIndex * 26 + levelIndex * 16 + activityIndex * 22,
          });
          const goalWpm = track.baseGoalWpm + levelIndex * 2 + activityIndex;

          // The timer is derived from the passage rather than fixed, so a learner
          // typing at exactly the goal speed always has time to finish, with about
          // a third again in hand. A fixed timer left the longest passages
          // impossible to complete at their own stated goal.
          const secondsToFinishAtGoal = (text.length / 5 / goalWpm) * 60;
          const seconds = Math.max(
            template.seconds,
            Math.ceil((secondsToFinishAtGoal * 1.35) / 5) * 5
          );

          return {
            key: template.key,
            title: template.title,
            seconds,
            accuracyGoal: template.accuracyGoal,
            id: `${track.key}-l${levelNumber}-${template.key}`,
            trackKey: track.key,
            levelNumber,
            order: activityIndex + 1,
            goalWpm,
            teaches: template.teaches,
            instruction: `${level.focus}. ${template.teaches}`,
            text,
          };
        }),
      };
    }),
  }));
}

export function progressKey(trackKey, levelNumber, activityKey) {
  return `${trackKey}:${levelNumber}:${activityKey}`;
}
