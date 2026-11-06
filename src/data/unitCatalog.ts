/**
 * Demo unit catalogue. Kisii University does not publish unit lists, so all units are
 * invented (`demo: true`). Each department has a code prefix and a pool of shared topics
 * (3 per year of study, offered to every course in that department). Each course also gets
 * course-specific units generated from its subject.
 */

export interface DeptCatalog {
  prefix: string
  /** Shared topics, in year order: [y1a, y1b, y1c, y2a, y2b, y2c, …]. */
  shared: string[]
}

/** Matched against the department name (first match wins). */
export const DEPT_CATALOG: Array<[RegExp, DeptCatalog]> = [
  [/Computing Science/i, { prefix: 'COMP', shared: [
    'Programming Fundamentals', 'Discrete Mathematics', 'Computer Organization',
    'Data Structures', 'Object-Oriented Programming', 'Database Systems',
    'Operating Systems', 'Computer Networks', 'Design and Analysis of Algorithms',
    'Distributed Systems', 'Computer Security', 'Research Project',
  ] }],
  [/Communication, Media/i, { prefix: 'CMIS', shared: [
    'Introduction to Mass Communication', 'Information Literacy', 'News Writing',
    'Media Law and Ethics', 'Records Management', 'Digital Media Production',
    'Public Relations', 'Knowledge Management', 'Communication Research Methods',
    'Media Management', 'Information Policy', 'Project in Communication',
  ] }],
  [/Accounting and Finance/i, { prefix: 'BACC', shared: [
    'Financial Accounting I', 'Principles of Economics', 'Business Mathematics',
    'Financial Accounting II', 'Cost Accounting', 'Business Statistics',
    'Corporate Finance', 'Taxation', 'Auditing and Assurance',
    'Financial Markets', 'Investment Analysis', 'Research Project',
  ] }],
  [/Business Administration/i, { prefix: 'BADM', shared: [
    'Introduction to Business', 'Principles of Management', 'Business Communication',
    'Organisational Behaviour', 'Principles of Marketing', 'Business Law',
    'Management Information Systems', 'Operations Management', 'Entrepreneurship and Innovation',
    'Strategic Management', 'International Business', 'Research Project',
  ] }],
  [/Management Science/i, { prefix: 'BMGS', shared: [
    'Quantitative Methods', 'Introduction to Supply Chain', 'Business Ethics',
    'Operations Research', 'Procurement Law', 'Project Planning',
    'Logistics Management', 'Monitoring and Evaluation', 'Risk Management',
    'Contract Management', 'Public Procurement', 'Research Project',
  ] }],
  [/Human Resource/i, { prefix: 'BHRM', shared: [
    'Introduction to Human Resource Management', 'Labour Economics', 'Industrial Psychology',
    'Recruitment and Selection', 'Employment Law', 'Compensation Management',
    'Performance Management', 'Training and Development', 'Industrial Relations',
    'Strategic HRM', 'HR Information Systems', 'Research Project',
  ] }],
  [/Tourism and Hospitality/i, { prefix: 'BTHM', shared: [
    'Introduction to Tourism', 'Food Production I', 'Front Office Operations',
    'Tourism Geography of Kenya', 'Food and Beverage Service', 'Housekeeping Management',
    'Tour Operations', 'Hospitality Marketing', 'Event Management',
    'Ecotourism', 'Hospitality Law', 'Research Project',
  ] }],
  [/Mathematics/i, { prefix: 'MATH', shared: [
    'Calculus I', 'Linear Algebra I', 'Probability and Statistics I',
    'Calculus II', 'Real Analysis', 'Probability and Statistics II',
    'Differential Equations', 'Numerical Analysis', 'Mathematical Modelling',
    'Complex Analysis', 'Stochastic Processes', 'Research Project',
  ] }],
  [/Biological Sciences/i, { prefix: 'BIOL', shared: [
    'Cell Biology', 'General Microbiology', 'Introductory Genetics',
    'Biochemistry I', 'Molecular Biology', 'Ecology',
    'Immunology', 'Bioinformatics', 'Plant Physiology',
    'Genetic Engineering', 'Biostatistics', 'Research Project',
  ] }],
  [/Chemistry/i, { prefix: 'CHEM', shared: [
    'General Chemistry I', 'Organic Chemistry I', 'Laboratory Techniques',
    'Physical Chemistry I', 'Inorganic Chemistry I', 'Analytical Chemistry I',
    'Spectroscopy', 'Chemical Thermodynamics', 'Instrumental Analysis',
    'Industrial Chemistry Processes', 'Environmental Chemistry', 'Research Project',
  ] }],
  [/Physics/i, { prefix: 'PHYS', shared: [
    'Mechanics', 'Electricity and Magnetism', 'Physics Practicals I',
    'Waves and Optics', 'Thermal Physics', 'Mathematical Physics',
    'Quantum Mechanics', 'Solid State Physics', 'Electronics',
    'Nuclear Physics', 'Energy Systems', 'Research Project',
  ] }],
  [/Nursing/i, { prefix: 'NURS', shared: [
    'Human Anatomy I', 'Fundamentals of Nursing', 'Medical Physiology I',
    'Medical-Surgical Nursing I', 'Pharmacology for Nurses', 'Community Health Nursing',
    'Midwifery I', 'Paediatric Nursing', 'Mental Health Nursing',
    'Nursing Leadership', 'Critical Care Nursing', 'Research Project',
  ] }],
  [/Clinical Medicine/i, { prefix: 'CLIM', shared: [
    'Human Anatomy', 'Medical Physiology', 'Medical Biochemistry',
    'Pathology', 'Clinical Methods', 'Pharmacology',
    'Internal Medicine', 'Paediatrics', 'Surgery',
    'Reproductive Health', 'Community Health', 'Clinical Rotation',
  ] }],
  [/Public Health/i, { prefix: 'PUBH', shared: [
    'Introduction to Public Health', 'Human Biology', 'Health Promotion',
    'Epidemiology I', 'Environmental Health', 'Biostatistics',
    'Health Systems Management', 'Nutrition in Public Health', 'Disease Control',
    'Health Policy', 'Global Health', 'Research Project',
  ] }],
  [/Medicine/i, { prefix: 'MEDI', shared: [
    'Gross Anatomy', 'Histology', 'Medical Physiology',
    'Medical Biochemistry', 'Neuroanatomy', 'Medical Microbiology',
    'Pathology', 'Pharmacology', 'Clinical Skills',
    'Internal Medicine', 'Obstetrics and Gynaecology', 'Surgery',
    'Paediatrics and Child Health', 'Psychiatry', 'Community Medicine',
  ] }],
  [/Pharmacy/i, { prefix: 'PHAR', shared: [
    'Pharmaceutical Chemistry I', 'Human Anatomy', 'Physiology',
    'Pharmaceutics I', 'Pharmacognosy', 'Pharmacology I',
    'Clinical Pharmacy', 'Pharmaceutical Microbiology', 'Pharmacy Law',
    'Hospital Pharmacy', 'Pharmacotherapy', 'Research Project',
  ] }],
  [/Medical Laboratory/i, { prefix: 'MLSC', shared: [
    'Introduction to Medical Laboratory Science', 'Human Anatomy', 'General Chemistry',
    'Haematology I', 'Clinical Chemistry I', 'Medical Parasitology',
    'Blood Transfusion Science', 'Histopathology', 'Medical Bacteriology',
    'Laboratory Management', 'Molecular Diagnostics', 'Research Project',
  ] }],
  [/Nutrition/i, { prefix: 'FNDT', shared: [
    'Introduction to Nutrition', 'Food Science', 'Human Physiology',
    'Community Nutrition', 'Nutritional Biochemistry', 'Food Microbiology',
    'Clinical Nutrition', 'Diet Therapy', 'Food Service Management',
    'Nutrition Policy', 'Maternal and Child Nutrition', 'Research Project',
  ] }],
  [/Geography/i, { prefix: 'GEOG', shared: [
    'Physical Geography', 'Human Geography', 'Cartography',
    'Geography of Kenya', 'Climatology', 'Remote Sensing and GIS',
    'Urban Geography', 'Population Geography', 'Environmental Management',
    'Regional Planning', 'Biogeography', 'Research Project',
  ] }],
  [/History/i, { prefix: 'HIST', shared: [
    'Introduction to History', 'Pre-Colonial African History', 'Historiography',
    'History of Kenya', 'Colonialism in Africa', 'World History',
    'Heritage Management', 'Economic History', 'History of the Great Lakes',
    'Oral Traditions', 'Contemporary Africa', 'Research Project',
  ] }],
  [/Languages/i, { prefix: 'LANG', shared: [
    'Introduction to Linguistics', 'Introduction to Literature', 'Fasihi ya Kiswahili',
    'Phonetics and Phonology', 'Oral Literature', 'Sarufi ya Kiswahili',
    'Morphology and Syntax', 'African Literature', 'Sociolinguistics',
    'Semantics', 'Literary Criticism', 'Research Project',
  ] }],
  [/Philosophy and Religious/i, { prefix: 'PHRS', shared: [
    'Introduction to Philosophy', 'African Religion', 'Introduction to Religious Studies',
    'Logic', 'Christian Ethics', 'Islam in Africa',
    'Philosophy of Religion', 'Religion and Society', 'Comparative Religion',
    'Ethics and Governance', 'Religion and Conflict', 'Research Project',
  ] }],
  [/Political Science/i, { prefix: 'POLS', shared: [
    'Introduction to Political Science', 'Introduction to Peace Studies', 'Kenyan Government and Politics',
    'Public Administration', 'Conflict Analysis', 'Criminology',
    'Comparative Politics', 'International Relations', 'Security Studies',
    'Public Policy', 'Human Rights', 'Research Project',
  ] }],
  [/Psychology/i, { prefix: 'PSYC', shared: [
    'Introduction to Psychology', 'Developmental Psychology', 'Counselling Theories',
    'Social Psychology', 'Abnormal Psychology', 'Counselling Skills',
    'Psychological Testing', 'Cognitive Psychology', 'Family Therapy',
    'Health Psychology', 'Ethics in Counselling', 'Research Project',
  ] }],
  [/Sociology/i, { prefix: 'SOCI', shared: [
    'Introduction to Sociology', 'Introduction to Development Studies', 'Social Anthropology',
    'Gender and Society', 'Social Research Methods', 'Rural Sociology',
    'Community Development', 'Social Policy', 'Sociology of Health',
    'Project Planning', 'Social Work Practice', 'Research Project',
  ] }],
  [/Curriculum/i, { prefix: 'ECIM', shared: [
    'Introduction to Education', 'Educational Technology', 'Teaching Methods',
    'Curriculum Development', 'Subject Methods', 'Educational Media',
    'Micro-teaching', 'Classroom Management', 'Teaching Practice',
    'Measurement and Evaluation', 'Instructional Design', 'Research Project',
  ] }],
  [/Educational Foundations/i, { prefix: 'EDFA', shared: [
    'Philosophy of Education', 'Educational Psychology', 'History of Education',
    'Sociology of Education', 'Special Needs Education', 'Guidance and Counselling',
    'Educational Administration', 'Economics of Education', 'Educational Planning',
    'Comparative Education', 'Education Law and Policy', 'Research Project',
  ] }],
  [/Agricultural Sciences/i, { prefix: 'AGRI', shared: [
    'Principles of Crop Production', 'Introduction to Soil Science', 'Agricultural Economics I',
    'Animal Production', 'Plant Pathology', 'Farm Management',
    'Agricultural Marketing', 'Crop Protection', 'Horticultural Production',
    'Agribusiness Management', 'Agricultural Policy', 'Research Project',
  ] }],
  [/Agricultural Education/i, { prefix: 'AGED', shared: [
    'Introduction to Agricultural Education', 'Rural Sociology', 'Crop Science',
    'Extension Methods', 'Animal Science', 'Communication in Extension',
    'Programme Planning in Extension', 'Adult Education', 'Agricultural Teaching Methods',
    'Farmer Organisations', 'Extension Practicum', 'Research Project',
  ] }],
  [/Natural Resources/i, { prefix: 'NRMG', shared: [
    'Introduction to Environmental Science', 'Ecology', 'Natural Resource Economics',
    'Forestry', 'Water Resources Management', 'Environmental Impact Assessment',
    'Wildlife Management', 'Climate Change', 'Environmental Law',
    'GIS in Resource Management', 'Conservation Biology', 'Research Project',
  ] }],
  [/Aquatic/i, { prefix: 'AQUA', shared: [
    'Introduction to Aquatic Science', 'Limnology', 'Fish Biology',
    'Aquaculture', 'Fisheries Management', 'Water Quality',
  ] }],
  [/Law/i, { prefix: 'LAWS', shared: [
    'Legal Systems and Methods', 'Law of Contract I', 'Law of Torts I',
    'Constitutional Law', 'Criminal Law', 'Family Law',
    'Law of Evidence', 'Property Law', 'Administrative Law',
    'Commercial Law', 'Jurisprudence', 'Research Paper',
  ] }],
]

/** University-wide common units, offered to every year-1 certificate/diploma/undergraduate course. */
export const COMMON_UNITS = [
  { code: 'UCC 101', name: 'Communication Skills' },
  { code: 'UCC 102', name: 'HIV/AIDS and Health Awareness' },
  { code: 'UCC 103', name: 'Entrepreneurship Skills' },
]

/** Course-specific unit name templates. `S` is the course subject. */
export const COURSE_TEMPLATES = [
  'Foundations of S',
  'Principles of S',
  'S Laboratory',
  'Applied S',
  'Contemporary Issues in S',
  'Research Methods in S',
  'Advanced S',
  'S Field Attachment',
  'S Seminar',
  'S Capstone Project',
]

/** "Bachelor of Science in Software Engineering" → "Software Engineering" */
export function courseSubject(name: string): string {
  const cleaned = name
    // Drop abbreviations like "(LL.B.)" / "(MBChB)", keep words like "(Arts)"
    .replace(/\s*\((.*?)\)/g, (_m, inner: string) =>
      inner.includes('.') || (inner.match(/[A-Z]/g)?.length ?? 0) >= 2 ? '' : ` ${inner}`,
    )
    .replace(
      /^(Bachelor|Master|Diploma|Certificate|Doctor|Postgraduate Diploma)( of)?( Science| Arts| Philosophy)?( in| of)?\s*/i,
      '',
    )
    .replace(/^(Science|Arts) in /i, '')
    .replace(/\s*\b(Direct Entry|Upgrading)\b/gi, '')
    .trim()
  return cleaned || name
}
