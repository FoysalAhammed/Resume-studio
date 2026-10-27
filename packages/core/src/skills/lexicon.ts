import type { SkillCategory } from '../types';

export interface LexiconSkill {
  id: string;
  name: string;
  category: SkillCategory;
  /** Lower-cased alternative spellings matched during extraction. */
  aliases?: string[];
  /** Hours for a motivated beginner to reach a productive level. */
  learnHours: number;
  /** Curated cross-discipline links used by the partial-match logic. */
  related?: { id: string; weight: number }[];
  resources?: { label: string; url: string }[];
}

const MDN = { label: 'MDN Web Docs', url: 'https://developer.mozilla.org' };
const REACT_DOCS = { label: 'React documentation', url: 'https://react.dev/learn' };
const TS_DOCS = { label: 'TypeScript handbook', url: 'https://www.typescriptlang.org/docs/handbook/intro.html' };
const NODE_DOCS = { label: 'Node.js documentation', url: 'https://nodejs.org/docs/latest/api/' };
const PY_DOCS = { label: 'Python documentation', url: 'https://docs.python.org/3/tutorial/' };
const DOCKER_DOCS = { label: 'Docker documentation', url: 'https://docs.docker.com/get-started/' };
const K8S_DOCS = { label: 'Kubernetes documentation', url: 'https://kubernetes.io/docs/home/' };
const PG_DOCS = { label: 'PostgreSQL documentation', url: 'https://www.postgresql.org/docs/current/tutorial.html' };
const PRISMA_DOCS = { label: 'Prisma documentation', url: 'https://www.prisma.io/docs' };
const TAILWIND_DOCS = { label: 'Tailwind CSS documentation', url: 'https://tailwindcss.com/docs' };
const VITEST_DOCS = { label: 'Vitest documentation', url: 'https://vitest.dev/guide/' };
const PW_DOCS = { label: 'Playwright documentation', url: 'https://playwright.dev/docs/intro' };
const AWS_DOCS = { label: 'AWS documentation', url: 'https://docs.aws.amazon.com/index.html' };
const GIT_DOCS = { label: 'Git reference', url: 'https://git-scm.com/docs' };
const OWASP = { label: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' };

/**
 * Curated technology lexicon. Extraction, relation mapping and learning-effort
 * estimation all read from this table, so adding a new technology in one place
 * makes it available across the platform.
 */
export const LEXICON: LexiconSkill[] = [
  // Programming languages
  { id: 'javascript', name: 'JavaScript', category: 'Programming Languages', aliases: ['js', 'es6', 'modern javascript', 'vanilla js'], learnHours: 60, related: [{ id: 'typescript', weight: 0.7 }, { id: 'react', weight: 0.6 }], resources: [MDN] },
  { id: 'typescript', name: 'TypeScript', category: 'Programming Languages', aliases: ['ts'], learnHours: 40, related: [{ id: 'javascript', weight: 0.8 }], resources: [TS_DOCS] },
  { id: 'python', name: 'Python', category: 'Programming Languages', aliases: ['py'], learnHours: 60, related: [{ id: 'pandas', weight: 0.5 }, { id: 'django', weight: 0.5 }], resources: [PY_DOCS] },
  { id: 'java', name: 'Java', category: 'Programming Languages', learnHours: 80, related: [{ id: 'spring-boot', weight: 0.6 }] },
  { id: 'csharp', name: 'C#', category: 'Programming Languages', aliases: ['c sharp', 'dotnet c#'], learnHours: 80, related: [{ id: 'dotnet', weight: 0.7 }] },
  { id: 'cpp', name: 'C++', category: 'Programming Languages', aliases: ['c plus plus'], learnHours: 100 },
  { id: 'go', name: 'Go', category: 'Programming Languages', aliases: ['golang'], learnHours: 60 },
  { id: 'rust', name: 'Rust', category: 'Programming Languages', learnHours: 90 },
  { id: 'php', name: 'PHP', category: 'Programming Languages', learnHours: 60, related: [{ id: 'laravel', weight: 0.6 }] },
  { id: 'ruby', name: 'Ruby', category: 'Programming Languages', learnHours: 60 },
  { id: 'kotlin', name: 'Kotlin', category: 'Programming Languages', learnHours: 70, related: [{ id: 'android', weight: 0.6 }] },
  { id: 'swift', name: 'Swift', category: 'Programming Languages', learnHours: 70, related: [{ id: 'ios', weight: 0.6 }] },
  { id: 'sql', name: 'SQL', category: 'Programming Languages', aliases: ['structured query language', 'sql queries'], learnHours: 40, related: [{ id: 'postgresql', weight: 0.5 }, { id: 'database-design', weight: 0.5 }], resources: [{ label: 'SQLBolt interactive tutorial', url: 'https://sqlbolt.com/' }] },
  { id: 'html', name: 'HTML', category: 'Frontend', aliases: ['html5', 'semantic html'], learnHours: 20, resources: [MDN] },
  { id: 'css', name: 'CSS', category: 'Frontend', aliases: ['css3', 'styling'], learnHours: 30, related: [{ id: 'tailwind-css', weight: 0.5 }, { id: 'responsive-design', weight: 0.6 }], resources: [MDN] },
  { id: 'bash', name: 'Bash / Shell scripting', category: 'Tools & Workflow', aliases: ['shell scripting', 'bash scripting', 'command line'], learnHours: 25 },
  { id: 'r', name: 'R', category: 'Data & Analytics', learnHours: 50, related: [{ id: 'statistics', weight: 0.6 }] },

  // Frontend
  { id: 'react', name: 'React', category: 'Frontend', aliases: ['react.js', 'reactjs'], learnHours: 60, related: [{ id: 'javascript', weight: 0.7 }, { id: 'redux', weight: 0.4 }, { id: 'nextjs', weight: 0.5 }], resources: [REACT_DOCS] },
  { id: 'nextjs', name: 'Next.js', category: 'Frontend', aliases: ['next js', 'nextjs'], learnHours: 40, related: [{ id: 'react', weight: 0.8 }], resources: [{ label: 'Next.js documentation', url: 'https://nextjs.org/docs' }] },
  { id: 'vue', name: 'Vue.js', category: 'Frontend', aliases: ['vue', 'vuejs'], learnHours: 50, related: [{ id: 'javascript', weight: 0.7 }] },
  { id: 'angular', name: 'Angular', category: 'Frontend', learnHours: 70, related: [{ id: 'typescript', weight: 0.6 }] },
  { id: 'svelte', name: 'Svelte', category: 'Frontend', aliases: ['sveltekit'], learnHours: 45, related: [{ id: 'javascript', weight: 0.6 }] },
  { id: 'tailwind-css', name: 'Tailwind CSS', category: 'Frontend', aliases: ['tailwind', 'tailwindcss'], learnHours: 20, related: [{ id: 'css', weight: 0.7 }], resources: [TAILWIND_DOCS] },
  { id: 'redux', name: 'Redux / state management', category: 'Frontend', aliases: ['redux', 'zustand', 'state management'], learnHours: 25, related: [{ id: 'react', weight: 0.7 }] },
  { id: 'vite', name: 'Vite', category: 'Tools & Workflow', learnHours: 12, related: [{ id: 'javascript', weight: 0.4 }] },
  { id: 'webpack', name: 'Webpack / bundlers', category: 'Tools & Workflow', aliases: ['webpack', 'bundler', 'rollup'], learnHours: 25 },
  { id: 'responsive-design', name: 'Responsive web design', category: 'Frontend', aliases: ['responsive design', 'mobile first', 'cross browser'], learnHours: 25, related: [{ id: 'css', weight: 0.8 }] },
  { id: 'accessibility', name: 'Web accessibility (a11y)', category: 'Frontend', aliases: ['a11y', 'accessibility', 'wcag'], learnHours: 25, related: [{ id: 'html', weight: 0.7 }] },
  { id: 'web-performance', name: 'Web performance optimisation', category: 'Frontend', aliases: ['performance optimisation', 'core web vitals', 'lighthouse'], learnHours: 30, related: [{ id: 'javascript', weight: 0.5 }] },

  // Backend
  { id: 'nodejs', name: 'Node.js', category: 'Backend', aliases: ['node', 'nodejs'], learnHours: 50, related: [{ id: 'javascript', weight: 0.8 }, { id: 'express', weight: 0.6 }], resources: [NODE_DOCS] },
  { id: 'express', name: 'Express.js', category: 'Backend', aliases: ['express', 'expressjs'], learnHours: 20, related: [{ id: 'nodejs', weight: 0.8 }, { id: 'rest-api', weight: 0.7 }] },
  { id: 'nestjs', name: 'NestJS', category: 'Backend', aliases: ['nest js'], learnHours: 40, related: [{ id: 'nodejs', weight: 0.7 }, { id: 'typescript', weight: 0.6 }] },
  { id: 'django', name: 'Django', category: 'Backend', learnHours: 45, related: [{ id: 'python', weight: 0.8 }] },
  { id: 'flask', name: 'Flask', category: 'Backend', learnHours: 25, related: [{ id: 'python', weight: 0.8 }] },
  { id: 'fastapi', name: 'FastAPI', category: 'Backend', learnHours: 30, related: [{ id: 'python', weight: 0.8 }] },
  { id: 'spring-boot', name: 'Spring Boot', category: 'Backend', learnHours: 60, related: [{ id: 'java', weight: 0.8 }] },
  { id: 'dotnet', name: '.NET', category: 'Backend', aliases: ['asp.net', 'dotnet', '.net core'], learnHours: 60, related: [{ id: 'csharp', weight: 0.8 }] },
  { id: 'laravel', name: 'Laravel', category: 'Backend', learnHours: 40, related: [{ id: 'php', weight: 0.8 }] },
  { id: 'rest-api', name: 'REST API design', category: 'Backend', aliases: ['rest', 'restful api', 'rest apis', 'api design'], learnHours: 30, related: [{ id: 'http', weight: 0.6 }] },
  { id: 'graphql', name: 'GraphQL', category: 'Backend', learnHours: 30, related: [{ id: 'rest-api', weight: 0.5 }] },
  { id: 'http', name: 'HTTP & networking basics', category: 'Backend', aliases: ['http', 'networking fundamentals'], learnHours: 20 },
  { id: 'websockets', name: 'WebSockets / real-time', category: 'Backend', aliases: ['websocket', 'socket.io', 'real time'], learnHours: 20 },
  { id: 'microservices', name: 'Microservices architecture', category: 'Backend', learnHours: 45, related: [{ id: 'docker', weight: 0.5 }] },
  { id: 'auth', name: 'Authentication & authorisation', category: 'Security', aliases: ['auth', 'oauth', 'jwt', 'authorisation', 'authorization'], learnHours: 30, related: [{ id: 'secure-coding', weight: 0.6 }, { id: 'rest-api', weight: 0.4 }] },

  // Databases
  { id: 'postgresql', name: 'PostgreSQL', category: 'Databases', aliases: ['postgres', 'psql'], learnHours: 35, related: [{ id: 'sql', weight: 0.8 }], resources: [PG_DOCS] },
  { id: 'mysql', name: 'MySQL', category: 'Databases', aliases: ['mariadb'], learnHours: 30, related: [{ id: 'sql', weight: 0.8 }] },
  { id: 'mongodb', name: 'MongoDB', category: 'Databases', aliases: ['mongo', 'nosql'], learnHours: 25, related: [{ id: 'database-design', weight: 0.5 }] },
  { id: 'redis', name: 'Redis / caching', category: 'Databases', aliases: ['redis', 'caching'], learnHours: 18 },
  { id: 'sqlite', name: 'SQLite', category: 'Databases', learnHours: 10, related: [{ id: 'sql', weight: 0.8 }] },
  { id: 'prisma', name: 'Prisma ORM', category: 'Databases', aliases: ['prisma orm', 'orm'], learnHours: 15, related: [{ id: 'postgresql', weight: 0.6 }, { id: 'typescript', weight: 0.5 }], resources: [PRISMA_DOCS] },
  { id: 'database-design', name: 'Database design & modelling', category: 'Databases', aliases: ['data modelling', 'data modeling', 'schema design', 'normalisation'], learnHours: 30, related: [{ id: 'sql', weight: 0.7 }] },
  { id: 'elasticsearch', name: 'Elasticsearch / search', category: 'Databases', aliases: ['elasticsearch', 'full text search'], learnHours: 30 },

  // Cloud & DevOps
  { id: 'aws', name: 'AWS', category: 'Cloud & DevOps', aliases: ['amazon web services'], learnHours: 60, related: [{ id: 'cloud-fundamentals', weight: 0.6 }], resources: [AWS_DOCS] },
  { id: 'azure', name: 'Microsoft Azure', category: 'Cloud & DevOps', aliases: ['azure'], learnHours: 60, related: [{ id: 'cloud-fundamentals', weight: 0.6 }] },
  { id: 'gcp', name: 'Google Cloud Platform', category: 'Cloud & DevOps', aliases: ['gcp', 'google cloud'], learnHours: 60, related: [{ id: 'cloud-fundamentals', weight: 0.6 }] },
  { id: 'cloud-fundamentals', name: 'Cloud fundamentals', category: 'Cloud & DevOps', aliases: ['cloud computing', 'cloud services', 'iaas', 'paas'], learnHours: 30 },
  { id: 'docker', name: 'Docker & containers', category: 'Cloud & DevOps', aliases: ['docker', 'containerisation', 'containerization', 'containers'], learnHours: 30, related: [{ id: 'linux', weight: 0.5 }, { id: 'kubernetes', weight: 0.5 }], resources: [DOCKER_DOCS] },
  { id: 'kubernetes', name: 'Kubernetes', category: 'Cloud & DevOps', aliases: ['k8s'], learnHours: 60, related: [{ id: 'docker', weight: 0.8 }], resources: [K8S_DOCS] },
  { id: 'cicd', name: 'CI/CD pipelines', category: 'Cloud & DevOps', aliases: ['ci/cd', 'continuous integration', 'continuous deployment', 'ci cd'], learnHours: 25, related: [{ id: 'github-actions', weight: 0.6 }] },
  { id: 'github-actions', name: 'GitHub Actions', category: 'Cloud & DevOps', aliases: ['github actions'], learnHours: 15, related: [{ id: 'cicd', weight: 0.8 }] },
  { id: 'terraform', name: 'Terraform / IaC', category: 'Cloud & DevOps', aliases: ['terraform', 'infrastructure as code', 'iac'], learnHours: 40, related: [{ id: 'cloud-fundamentals', weight: 0.5 }] },
  { id: 'linux', name: 'Linux', category: 'Cloud & DevOps', aliases: ['linux administration', 'ubuntu', 'unix'], learnHours: 40 },
  { id: 'nginx', name: 'Nginx / reverse proxy', category: 'Cloud & DevOps', aliases: ['nginx', 'reverse proxy'], learnHours: 18 },
  { id: 'serverless', name: 'Serverless / lambda', category: 'Cloud & DevOps', aliases: ['serverless', 'aws lambda', 'cloud functions'], learnHours: 30 },
  { id: 'observability', name: 'Monitoring & observability', category: 'Cloud & DevOps', aliases: ['monitoring', 'logging', 'observability', 'grafana', 'prometheus', 'datadog'], learnHours: 25 },

  // Data & analytics
  { id: 'pandas', name: 'Pandas', category: 'Data & Analytics', learnHours: 30, related: [{ id: 'python', weight: 0.8 }] },
  { id: 'numpy', name: 'NumPy', category: 'Data & Analytics', learnHours: 20, related: [{ id: 'python', weight: 0.8 }] },
  { id: 'data-analysis', name: 'Data analysis', category: 'Data & Analytics', aliases: ['analytics', 'data analytics', 'exploratory data analysis', 'eda'], learnHours: 40, related: [{ id: 'statistics', weight: 0.6 }] },
  { id: 'data-visualisation', name: 'Data visualisation', category: 'Data & Analytics', aliases: ['data visualization', 'dataviz', 'dashboarding', 'charts'], learnHours: 25, related: [{ id: 'data-analysis', weight: 0.6 }] },
  { id: 'power-bi', name: 'Power BI', category: 'Data & Analytics', aliases: ['powerbi'], learnHours: 25 },
  { id: 'tableau', name: 'Tableau', category: 'Data & Analytics', learnHours: 25 },
  { id: 'excel', name: 'Excel / spreadsheets', category: 'Data & Analytics', aliases: ['excel', 'spreadsheets', 'google sheets'], learnHours: 20 },
  { id: 'etl', name: 'ETL & data pipelines', category: 'Data & Analytics', aliases: ['etl', 'data pipeline', 'data pipelines', 'data engineering'], learnHours: 45, related: [{ id: 'sql', weight: 0.6 }] },
  { id: 'airflow', name: 'Apache Airflow', category: 'Data & Analytics', learnHours: 30, related: [{ id: 'etl', weight: 0.7 }, { id: 'python', weight: 0.5 }] },
  { id: 'spark', name: 'Apache Spark', category: 'Data & Analytics', aliases: ['spark', 'pyspark'], learnHours: 45, related: [{ id: 'etl', weight: 0.6 }] },
  { id: 'statistics', name: 'Statistics & probability', category: 'Data & Analytics', aliases: ['statistics', 'statistical analysis', 'probability'], learnHours: 40 },

  // AI & ML
  { id: 'machine-learning', name: 'Machine learning', category: 'AI & Machine Learning', aliases: ['ml', 'machine learning fundamentals', 'supervised learning'], learnHours: 80, related: [{ id: 'statistics', weight: 0.6 }, { id: 'python', weight: 0.5 }] },
  { id: 'deep-learning', name: 'Deep learning', category: 'AI & Machine Learning', aliases: ['neural networks', 'deep learning'], learnHours: 90, related: [{ id: 'machine-learning', weight: 0.8 }] },
  { id: 'tensorflow', name: 'TensorFlow', category: 'AI & Machine Learning', aliases: ['keras'], learnHours: 45, related: [{ id: 'deep-learning', weight: 0.7 }] },
  { id: 'pytorch', name: 'PyTorch', category: 'AI & Machine Learning', learnHours: 45, related: [{ id: 'deep-learning', weight: 0.7 }] },
  { id: 'scikit-learn', name: 'scikit-learn', category: 'AI & Machine Learning', aliases: ['sklearn'], learnHours: 30, related: [{ id: 'machine-learning', weight: 0.8 }, { id: 'python', weight: 0.6 }] },
  { id: 'nlp', name: 'Natural language processing', category: 'AI & Machine Learning', aliases: ['nlp', 'text mining'], learnHours: 60, related: [{ id: 'machine-learning', weight: 0.6 }] },
  { id: 'llm-engineering', name: 'LLM & prompt engineering', category: 'AI & Machine Learning', aliases: ['llm', 'large language models', 'prompt engineering', 'generative ai', 'openai api'], learnHours: 40, related: [{ id: 'nlp', weight: 0.5 }] },
  { id: 'computer-vision', name: 'Computer vision', category: 'AI & Machine Learning', aliases: ['computer vision', 'opencv', 'image recognition'], learnHours: 60, related: [{ id: 'deep-learning', weight: 0.6 }] },
  { id: 'mlops', name: 'MLOps', category: 'AI & Machine Learning', aliases: ['ml ops', 'model deployment'], learnHours: 50, related: [{ id: 'machine-learning', weight: 0.5 }, { id: 'cicd', weight: 0.4 }] },

  // Mobile
  { id: 'react-native', name: 'React Native', category: 'Mobile', learnHours: 45, related: [{ id: 'react', weight: 0.8 }] },
  { id: 'flutter', name: 'Flutter', category: 'Mobile', aliases: ['dart'], learnHours: 50 },
  { id: 'android', name: 'Android development', category: 'Mobile', aliases: ['android', 'jetpack compose'], learnHours: 70, related: [{ id: 'kotlin', weight: 0.7 }] },
  { id: 'ios', name: 'iOS development', category: 'Mobile', aliases: ['ios', 'swiftui', 'uikit'], learnHours: 70, related: [{ id: 'swift', weight: 0.7 }] },

  // Testing & quality
  { id: 'unit-testing', name: 'Unit testing', category: 'Testing & Quality', aliases: ['unit tests', 'test coverage', 'automated testing'], learnHours: 25, resources: [VITEST_DOCS] },
  { id: 'jest', name: 'Jest', category: 'Testing & Quality', learnHours: 15, related: [{ id: 'unit-testing', weight: 0.8 }] },
  { id: 'vitest', name: 'Vitest', category: 'Testing & Quality', learnHours: 12, related: [{ id: 'unit-testing', weight: 0.8 }] },
  { id: 'playwright', name: 'Playwright', category: 'Testing & Quality', learnHours: 25, related: [{ id: 'e2e-testing', weight: 0.8 }], resources: [PW_DOCS] },
  { id: 'cypress', name: 'Cypress', category: 'Testing & Quality', learnHours: 20, related: [{ id: 'e2e-testing', weight: 0.8 }] },
  { id: 'e2e-testing', name: 'End-to-end testing', category: 'Testing & Quality', aliases: ['e2e testing', 'integration testing', 'browser testing'], learnHours: 30 },
  { id: 'tdd', name: 'Test driven development', category: 'Testing & Quality', aliases: ['tdd', 'test first'], learnHours: 25, related: [{ id: 'unit-testing', weight: 0.7 }] },
  { id: 'debugging', name: 'Debugging & troubleshooting', category: 'Testing & Quality', aliases: ['debugging', 'troubleshooting', 'root cause analysis'], learnHours: 20 },

  // Security
  { id: 'secure-coding', name: 'Secure coding practices', category: 'Security', aliases: ['secure coding', 'owasp', 'input validation'], learnHours: 30, resources: [OWASP] },
  { id: 'application-security', name: 'Application security', category: 'Security', aliases: ['appsec', 'web security', 'vulnerability assessment'], learnHours: 45, related: [{ id: 'secure-coding', weight: 0.8 }] },
  { id: 'penetration-testing', name: 'Penetration testing', category: 'Security', aliases: ['pentesting', 'ethical hacking', 'pen testing'], learnHours: 70, related: [{ id: 'application-security', weight: 0.7 }] },
  { id: 'cryptography', name: 'Cryptography fundamentals', category: 'Security', aliases: ['cryptography', 'encryption'], learnHours: 35 },

  // Design & UX
  { id: 'figma', name: 'Figma', category: 'Design & UX', learnHours: 20 },
  { id: 'ui-design', name: 'UI design', category: 'Design & UX', aliases: ['visual design', 'interface design', 'ui'], learnHours: 45, related: [{ id: 'figma', weight: 0.6 }, { id: 'design-systems', weight: 0.6 }] },
  { id: 'ux-design', name: 'UX design', category: 'Design & UX', aliases: ['user experience', 'ux', 'interaction design'], learnHours: 50, related: [{ id: 'user-research', weight: 0.6 }] },
  { id: 'user-research', name: 'User research', category: 'Design & UX', aliases: ['user research', 'usability testing', 'user interviews'], learnHours: 30 },
  { id: 'design-systems', name: 'Design systems', category: 'Design & UX', aliases: ['design system', 'component library', 'design tokens'], learnHours: 30, related: [{ id: 'ui-design', weight: 0.7 }] },
  { id: 'prototyping', name: 'Prototyping', category: 'Design & UX', aliases: ['wireframing', 'prototypes', 'mockups'], learnHours: 25 },
  { id: 'graphic-design', name: 'Graphic design', category: 'Design & UX', aliases: ['branding design', 'visual identity', 'photoshop', 'illustrator'], learnHours: 50 },

  // Product & business
  { id: 'product-management', name: 'Product management', category: 'Product & Business', aliases: ['product owner', 'product strategy', 'product management'], learnHours: 60 },
  { id: 'agile', name: 'Agile & Scrum', category: 'Product & Business', aliases: ['agile', 'scrum', 'kanban', 'sprint planning'], learnHours: 20 },
  { id: 'jira', name: 'Jira / issue tracking', category: 'Product & Business', aliases: ['jira', 'issue tracking', 'trello', 'linear'], learnHours: 10 },
  { id: 'requirements', name: 'Requirements gathering', category: 'Product & Business', aliases: ['requirements gathering', 'business analysis', 'user stories', 'acceptance criteria'], learnHours: 30 },
  { id: 'stakeholder-management', name: 'Stakeholder management', category: 'Product & Business', aliases: ['stakeholder management', 'client communication'], learnHours: 25 },
  { id: 'project-management', name: 'Project management', category: 'Product & Business', aliases: ['project management', 'planning', 'roadmapping'], learnHours: 40 },
  { id: 'technical-writing', name: 'Technical writing', category: 'Product & Business', aliases: ['technical writing', 'documentation writing', 'documentation'], learnHours: 25, related: [{ id: 'communication', weight: 0.5 }] },

  // Marketing & growth
  { id: 'seo', name: 'SEO', category: 'Marketing & Growth', aliases: ['search engine optimisation', 'search engine optimization', 'keyword research'], learnHours: 35 },
  { id: 'content-marketing', name: 'Content marketing', category: 'Marketing & Growth', aliases: ['content marketing', 'blogging', 'content strategy'], learnHours: 35 },
  { id: 'google-analytics', name: 'Web analytics', category: 'Marketing & Growth', aliases: ['google analytics', 'ga4', 'analytics tools', 'mixpanel'], learnHours: 20 },
  { id: 'email-marketing', name: 'Email marketing', category: 'Marketing & Growth', aliases: ['email marketing', 'mailchimp', 'newsletters'], learnHours: 20 },
  { id: 'social-media', name: 'Social media marketing', category: 'Marketing & Growth', aliases: ['social media', 'social media marketing', 'community management'], learnHours: 25 },
  { id: 'copywriting', name: 'Copywriting', category: 'Marketing & Growth', aliases: ['copywriting', 'copy', 'ad copy'], learnHours: 30 },
  { id: 'paid-ads', name: 'Paid advertising', category: 'Marketing & Growth', aliases: ['paid ads', 'google ads', 'meta ads', 'ppc'], learnHours: 30 },
  { id: 'canva', name: 'Canva', category: 'Marketing & Growth', learnHours: 8 },
  { id: 'market-research', name: 'Market research', category: 'Marketing & Growth', aliases: ['market research', 'competitor analysis'], learnHours: 30 },

  // Soft skills
  { id: 'communication', name: 'Communication', category: 'Soft Skills', aliases: ['communication skills', 'written communication', 'verbal communication'], learnHours: 20 },
  { id: 'teamwork', name: 'Teamwork & collaboration', category: 'Soft Skills', aliases: ['teamwork', 'collaboration', 'cross functional', 'pair programming'], learnHours: 15 },
  { id: 'problem-solving', name: 'Problem solving', category: 'Soft Skills', aliases: ['problem solving', 'analytical thinking', 'critical thinking'], learnHours: 20 },
  { id: 'time-management', name: 'Time management', category: 'Soft Skills', aliases: ['time management', 'prioritisation', 'prioritization'], learnHours: 12 },
  { id: 'leadership', name: 'Leadership', category: 'Soft Skills', aliases: ['leadership', 'mentoring', 'line management'], learnHours: 30 },
  { id: 'presentation', name: 'Presentation skills', category: 'Soft Skills', aliases: ['presentation', 'public speaking', 'demoing'], learnHours: 20 },
  { id: 'adaptability', name: 'Adaptability & learning agility', category: 'Soft Skills', aliases: ['adaptability', 'fast learner', 'self motivated', 'proactive'], learnHours: 10 },
  { id: 'attention-to-detail', name: 'Attention to detail', category: 'Soft Skills', aliases: ['attention to detail', 'detail oriented'], learnHours: 10 },

  // Tools
  { id: 'git', name: 'Git', category: 'Tools & Workflow', aliases: ['git', 'version control', 'branching'], learnHours: 18, resources: [GIT_DOCS] },
  { id: 'github', name: 'GitHub / collaboration', category: 'Tools & Workflow', aliases: ['github', 'gitlab', 'bitbucket', 'pull requests', 'code review'], learnHours: 12, related: [{ id: 'git', weight: 0.8 }] },
  { id: 'postman', name: 'Postman / API testing', category: 'Tools & Workflow', aliases: ['postman', 'insomnia', 'api testing'], learnHours: 10, related: [{ id: 'rest-api', weight: 0.6 }] },
];

export const LEXICON_BY_ID = new Map(LEXICON.map((skill) => [skill.id, skill]));

export function getLexiconSkill(id: string): LexiconSkill | undefined {
  return LEXICON_BY_ID.get(id);
}
