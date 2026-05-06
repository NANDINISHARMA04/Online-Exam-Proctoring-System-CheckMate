// static/js/questions.js  ── v2.0 (Multi-field Question Bank)
// ══════════════════════════════════════════════════════════════════
//  QUESTION BANK — 70 questions across 7 fields
//  Auto-shuffled and sampled per exam session.
//  Fields: Computer Science · Mathematics · General Knowledge ·
//          Science · English · Logical Reasoning · Current Affairs
// ══════════════════════════════════════════════════════════════════

const QUESTION_BANK = {

  // ── 1. Computer Science ────────────────────────────────────────
  "Computer Science": [
    { id:"cs1",  text: "What does CPU stand for?",
      options: ["Central Processing Unit","Central Program Utility","Computer Processing Unit","Core Processor Unit"], correct: 0 },
    { id:"cs2",  text: "Which data structure operates on a LIFO (Last In, First Out) principle?",
      options: ["Queue","Stack","Linked List","Binary Tree"], correct: 1 },
    { id:"cs3",  text: "What is the time complexity of binary search on a sorted array?",
      options: ["O(n)","O(n²)","O(log n)","O(1)"], correct: 2 },
    { id:"cs4",  text: "Which protocol is used to transfer web pages over the internet?",
      options: ["FTP","SMTP","HTTP","SSH"], correct: 2 },
    { id:"cs5",  text: "In OOP, what is 'encapsulation'?",
      options: ["Inheriting from a parent class","Bundling data and methods within a class","Overloading methods","Type casting"], correct: 1 },
    { id:"cs6",  text: "What is the base of the binary number system?",
      options: ["8","10","16","2"], correct: 3 },
    { id:"cs7",  text: "Which sorting algorithm has O(n log n) average-case complexity?",
      options: ["Bubble Sort","Selection Sort","Merge Sort","Insertion Sort"], correct: 2 },
    { id:"cs8",  text: "What does RAM stand for?",
      options: ["Read Access Memory","Random Access Memory","Rapid Application Memory","Read and Modify Memory"], correct: 1 },
    { id:"cs9",  text: "Which OSI layer handles routing between networks?",
      options: ["Data Link","Transport","Network","Session"], correct: 2 },
    { id:"cs10", text: "What does SQL stand for?",
      options: ["Structured Query Language","Standard Query Language","System Query Logic","Sequential Query Language"], correct: 0 },
    { id:"cs11", text: "Which symbol is used for single-line comments in Python?",
      options: ["//","/*","#","--"], correct: 2 },
    { id:"cs12", text: "What is the default port for HTTPS?",
      options: ["80","21","443","8080"], correct: 2 },
    { id:"cs13", text: "Which of the following is NOT an object-oriented language?",
      options: ["Java","C++","C","Python"], correct: 2 },
    { id:"cs14", text: "What does an IP address identify?",
      options: ["A file","A network device","A user account","A protocol"], correct: 1 },
    { id:"cs15", text: "Which data structure uses key-value pairs?",
      options: ["Array","Stack","Hash Map","Queue"], correct: 2 },
  ],

  // ── 2. Mathematics ─────────────────────────────────────────────
  "Mathematics": [
    { id:"ma1",  text: "What is the value of π (pi) to two decimal places?",
      options: ["3.12","3.14","3.16","3.18"], correct: 1 },
    { id:"ma2",  text: "What is the derivative of sin(x)?",
      options: ["-cos(x)","cos(x)","-sin(x)","tan(x)"], correct: 1 },
    { id:"ma3",  text: "If 2x + 3 = 11, what is x?",
      options: ["3","4","5","6"], correct: 1 },
    { id:"ma4",  text: "What is the sum of angles in a triangle?",
      options: ["90°","180°","270°","360°"], correct: 1 },
    { id:"ma5",  text: "What is the square root of 144?",
      options: ["11","12","13","14"], correct: 1 },
    { id:"ma6",  text: "What is 7! (7 factorial)?",
      options: ["2520","5040","720","40320"], correct: 1 },
    { id:"ma7",  text: "A circle's circumference is 2πr. If r = 5, what is the circumference?",
      options: ["10π","5π","25π","π"], correct: 0 },
    { id:"ma8",  text: "What is the logarithm of 1000 to the base 10?",
      options: ["1","2","3","4"], correct: 2 },
    { id:"ma9",  text: "Which of the following is a prime number?",
      options: ["9","15","21","29"], correct: 3 },
    { id:"ma10", text: "What is 15% of 200?",
      options: ["20","25","30","35"], correct: 2 },
  ],

  // ── 3. General Knowledge ───────────────────────────────────────
  "General Knowledge": [
    { id:"gk1",  text: "Which planet is known as the Red Planet?",
      options: ["Venus","Saturn","Mars","Jupiter"], correct: 2 },
    { id:"gk2",  text: "Who wrote 'Romeo and Juliet'?",
      options: ["Charles Dickens","William Shakespeare","Jane Austen","Leo Tolstoy"], correct: 1 },
    { id:"gk3",  text: "What is the capital of Australia?",
      options: ["Sydney","Melbourne","Brisbane","Canberra"], correct: 3 },
    { id:"gk4",  text: "How many continents are there on Earth?",
      options: ["5","6","7","8"], correct: 2 },
    { id:"gk5",  text: "Which ocean is the largest?",
      options: ["Atlantic","Indian","Arctic","Pacific"], correct: 3 },
    { id:"gk6",  text: "What is the chemical symbol for gold?",
      options: ["Go","Gd","Au","Ag"], correct: 2 },
    { id:"gk7",  text: "In which year did World War II end?",
      options: ["1943","1944","1945","1946"], correct: 2 },
    { id:"gk8",  text: "Which country is the largest by area?",
      options: ["China","USA","Canada","Russia"], correct: 3 },
    { id:"gk9",  text: "What is the hardest natural substance on Earth?",
      options: ["Gold","Iron","Diamond","Quartz"], correct: 2 },
    { id:"gk10", text: "Which instrument has 88 keys?",
      options: ["Violin","Guitar","Piano","Harp"], correct: 2 },
  ],

  // ── 4. Science ─────────────────────────────────────────────────
  "Science": [
    { id:"sc1",  text: "What is the chemical formula for water?",
      options: ["CO₂","H₂O","NaCl","O₂"], correct: 1 },
    { id:"sc2",  text: "Which gas do plants absorb during photosynthesis?",
      options: ["Oxygen","Nitrogen","Carbon Dioxide","Hydrogen"], correct: 2 },
    { id:"sc3",  text: "What force keeps planets in orbit around the Sun?",
      options: ["Magnetism","Gravity","Friction","Electrostatics"], correct: 1 },
    { id:"sc4",  text: "What is the powerhouse of the cell?",
      options: ["Nucleus","Ribosome","Mitochondria","Golgi Body"], correct: 2 },
    { id:"sc5",  text: "What is the speed of light (approximate)?",
      options: ["3×10⁵ km/s","3×10⁸ m/s","3×10⁶ m/s","3×10⁴ km/s"], correct: 1 },
    { id:"sc6",  text: "Which element has atomic number 1?",
      options: ["Helium","Carbon","Oxygen","Hydrogen"], correct: 3 },
    { id:"sc7",  text: "Newton's second law relates force to:",
      options: ["Mass × Velocity","Mass × Acceleration","Mass × Distance","Velocity × Time"], correct: 1 },
    { id:"sc8",  text: "What type of bond shares electrons between atoms?",
      options: ["Ionic","Covalent","Metallic","Hydrogen"], correct: 1 },
    { id:"sc9",  text: "Which vitamin is produced when skin is exposed to sunlight?",
      options: ["Vitamin A","Vitamin B12","Vitamin C","Vitamin D"], correct: 3 },
    { id:"sc10", text: "What is the SI unit of electric current?",
      options: ["Volt","Watt","Ampere","Ohm"], correct: 2 },
  ],

  // ── 5. English ─────────────────────────────────────────────────
  "English": [
    { id:"en1",  text: "Which of the following is a synonym for 'verbose'?",
      options: ["Concise","Wordy","Brief","Silent"], correct: 1 },
    { id:"en2",  text: "Identify the correct sentence:",
      options: ["She don't know","She doesn't knows","She doesn't know","She not know"], correct: 2 },
    { id:"en3",  text: "What is the antonym of 'benevolent'?",
      options: ["Kind","Generous","Malevolent","Helpful"], correct: 2 },
    { id:"en4",  text: "Which is a conjunction?",
      options: ["Quickly","However","And","The"], correct: 2 },
    { id:"en5",  text: "'The wind howled like a lonely wolf.' This is an example of:",
      options: ["Metaphor","Simile","Hyperbole","Alliteration"], correct: 1 },
    { id:"en6",  text: "What is the plural of 'criterion'?",
      options: ["Criterions","Criterias","Criteria","Criterium"], correct: 2 },
    { id:"en7",  text: "Which tense is used in: 'She had finished the report before noon'?",
      options: ["Simple Past","Past Continuous","Past Perfect","Present Perfect"], correct: 2 },
    { id:"en8",  text: "The word 'ubiquitous' means:",
      options: ["Rare","Present everywhere","Invisible","Slow"], correct: 1 },
    { id:"en9",  text: "Choose the correctly punctuated sentence:",
      options: ["Its a beautiful day.","It's a beautiful day.","Its' a beautiful day.","It is, a beautiful day."], correct: 1 },
    { id:"en10", text: "Which literary device involves giving human traits to non-human things?",
      options: ["Onomatopoeia","Irony","Personification","Allusion"], correct: 2 },
  ],

  // ── 6. Logical Reasoning ───────────────────────────────────────
  "Logical Reasoning": [
    { id:"lr1",  text: "If all Bloops are Razzles and all Razzles are Lazzles, then all Bloops are:",
      options: ["Razzles only","Lazzles","Neither","Cannot determine"], correct: 1 },
    { id:"lr2",  text: "What comes next in the series? 2, 4, 8, 16, __",
      options: ["24","28","32","36"], correct: 2 },
    { id:"lr3",  text: "A is taller than B. B is taller than C. Who is the shortest?",
      options: ["A","B","C","Cannot determine"], correct: 2 },
    { id:"lr4",  text: "If MANGO is coded as OCPIQ, how is APPLE coded?",
      options: ["CRRNG","CRRNM","BQQMF","CQQNG"], correct: 0 },
    { id:"lr5",  text: "Find the odd one out: 3, 5, 7, 9, 11",
      options: ["3","5","9","11"], correct: 2 },
    { id:"lr6",  text: "A train travels 60 km in 1 hour. How far does it travel in 90 minutes?",
      options: ["80 km","90 km","100 km","120 km"], correct: 1 },
    { id:"lr7",  text: "Which number is missing? 1, 4, 9, 16, __, 36",
      options: ["20","24","25","28"], correct: 2 },
    { id:"lr8",  text: "If today is Wednesday, what day is 100 days from now?",
      options: ["Monday","Tuesday","Wednesday","Friday"], correct: 3 },
    { id:"lr9",  text: "Four friends sit in a row. A is to the left of B, C is to the right of B, D is to the left of A. Who is leftmost?",
      options: ["A","B","C","D"], correct: 3 },
    { id:"lr10", text: "Complete the analogy — Book : Library :: Painting : ?",
      options: ["Museum","Artist","Canvas","School"], correct: 0 },
  ],

  // ── 7. Current Affairs (General) ───────────────────────────────
  "Current Affairs": [
    { id:"ca1",  text: "Which organisation maintains the World Wide Web standards?",
      options: ["UNESCO","W3C","ISO","IEEE"], correct: 1 },
    { id:"ca2",  text: "What does 'AI' stand for in technology?",
      options: ["Automated Interface","Artificial Intelligence","Automated Integration","Analytical Interface"], correct: 1 },
    { id:"ca3",  text: "Which company developed the ChatGPT model?",
      options: ["Google","Meta","OpenAI","Microsoft"], correct: 2 },
    { id:"ca4",  text: "What does 'URL' stand for?",
      options: ["Uniform Resource Locator","Universal Reference Link","Unified Resource Label","Uniform Routing Link"], correct: 0 },
    { id:"ca5",  text: "Which country launched the first satellite, Sputnik?",
      options: ["USA","China","Germany","Soviet Union"], correct: 3 },
    { id:"ca6",  text: "What does 'GDP' stand for?",
      options: ["Gross Domestic Product","General Domestic Production","Global Development Plan","Gross Development Product"], correct: 0 },
    { id:"ca7",  text: "Which international body awards the Nobel Prize?",
      options: ["United Nations","UNESCO","Nobel Committee, Sweden","World Economic Forum"], correct: 2 },
    { id:"ca8",  text: "What does 'IoT' stand for?",
      options: ["Internet of Technology","Internet of Things","Interface of Technology","Integration of Things"], correct: 1 },
    { id:"ca9",  text: "Which programming paradigm does React.js follow?",
      options: ["Procedural","Object-Oriented","Component-Based / Declarative","Functional only"], correct: 2 },
    { id:"ca10", text: "What is the full form of 'PDF'?",
      options: ["Portable Document Format","Printable Document File","Personal Data Format","Published Document Format"], correct: 0 },
  ],
};

// ══════════════════════════════════════════════════════════════════
//  QUESTION SELECTOR
//  Call buildExamQuestions(subject, count) to get a shuffled set.
//  subject = "Computer Science" | "Mathematics" | "General Knowledge"
//           | "Science" | "English" | "Logical Reasoning"
//           | "Current Affairs" | "Mixed"
//  count   = how many questions (default 10)
// ══════════════════════════════════════════════════════════════════

function _shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildExamQuestions(subject = "Mixed", count = 10) {
  let pool = [];

  if (subject === "Mixed" || !QUESTION_BANK[subject]) {
    // Take a balanced spread from all fields
    const fields = Object.keys(QUESTION_BANK);
    const perField = Math.ceil(count / fields.length);
    fields.forEach(field => {
      pool.push(..._shuffle(QUESTION_BANK[field]).slice(0, perField));
    });
  } else {
    pool = [...QUESTION_BANK[subject]];
  }

  // Shuffle combined pool and pick exactly `count` questions
  pool = _shuffle(pool).slice(0, count);

  // Re-number IDs sequentially so exam.js index logic still works
  return pool.map((q, i) => ({ ...q, id: i + 1 }));
}

// ══════════════════════════════════════════════════════════════════
//  QUESTIONS — built at page load; re-built on each new exam
//  exam.js reads this global before startExam() and can rebuild it.
// ══════════════════════════════════════════════════════════════════
let QUESTIONS = buildExamQuestions("Mixed", 10);

// Available subject options for the UI dropdown
const EXAM_SUBJECTS = ["Mixed", ...Object.keys(QUESTION_BANK)];