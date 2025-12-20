import architecturalImage1 from '@assets/stock_images/modern_minimal_archi_57055080.jpg';
import architecturalImage2 from '@assets/stock_images/modern_minimal_archi_a62f2ad7.jpg';
import techImage1 from '@assets/stock_images/abstract_technology__444bd4e8.jpg';
import techImage2 from '@assets/stock_images/abstract_technology__271dd1f7.jpg';
import coffeeImage from '@assets/stock_images/coffee_cup_on_desk_a_47c194cd.jpg';

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  source: string;
  author: string;
  date: string;
  imageUrl?: string;
  relevancyScore: number;
  readTime: number;
  tags: string[];
  isStarred?: boolean;
  isRead?: boolean;
}

export const MOCK_ARTICLES: Article[] = [
  {
    id: "1",
    title: "The Future of AI Agents in Modern Software Development",
    excerpt: "As large language models evolve, we're seeing a shift from chat-based interfaces to autonomous agents that can execute complex workflows.",
    content: `
      <p>The landscape of software development is undergoing a seismic shift. We are moving beyond the era of simple code completion and into the age of autonomous agents.</p>
      
      <h3>The Rise of Agentic Workflows</h3>
      <p>Traditional development tools have always been passive. IDEs wait for keystrokes. CI/CD pipelines wait for commits. But AI agents are proactive. They can reason about the state of a codebase, identify potential issues before they become bugs, and even propose architectural refactors.</p>
      
      <p>Imagine a system that doesn't just autocomplete your for loop, but understands that you're trying to implement a retry mechanism and suggests a robust exponential backoff strategy instead.</p>

      <h3>Implications for Developers</h3>
      <p>This doesn't mean the end of the human developer. Rather, it elevates the developer's role from "writer of syntax" to "architect of intent." We will spend less time wrestling with semicolons and more time defining the high-level goals of our systems.</p>
      
      <p>The most successful engineers of the next decade will be those who can effectively orchestrate these agents, guiding them to build software that is reliable, scalable, and maintainable.</p>
    `,
    source: "TechCrunch",
    author: "Sarah Connor",
    date: "2025-12-19T08:30:00Z",
    imageUrl: techImage1,
    relevancyScore: 95,
    readTime: 8,
    tags: ["AI", "Development", "Future"],
    isStarred: true,
  },
  {
    id: "2",
    title: "Minimalism in UI Design: A Return to Essentials",
    excerpt: "Why the best interfaces are often the ones that disappear completely, leaving only the content and the user's intent.",
    content: `
      <p>Minimalism is not just about white space; it's about clarity of thought. In a world screaming for attention, the quietest designs often speak the loudest.</p>
      <p>When we strip away the non-essential, we are forced to confront the core value of our product. Does this button need to exist? Is this line of copy adding value? Every element must fight for its right to be on the screen.</p>
    `,
    source: "Verge",
    author: "Dieter Rams II",
    date: "2025-12-18T14:15:00Z",
    imageUrl: architecturalImage1,
    relevancyScore: 88,
    readTime: 5,
    tags: ["Design", "UI/UX"],
  },
  {
    id: "3",
    title: "Global Markets React to New Energy Policies",
    excerpt: "Markets saw a slight dip this morning as new regulations on renewable energy credits were announced in the EU.",
    content: "Full analysis of the market reaction...",
    source: "Bloomberg",
    author: "Markets Desk",
    date: "2025-12-19T09:00:00Z",
    relevancyScore: 65,
    readTime: 3,
    tags: ["Finance", "Economy"],
  },
  {
    id: "4",
    title: "Rust v1.85 Released: What's New?",
    excerpt: "The latest release of Rust brings async improvements and a new borrow checker optimization.",
    content: "Detailed changelog analysis...",
    source: "Ars Technica",
    author: "Rust Evangelist",
    date: "2025-12-17T11:20:00Z",
    imageUrl: techImage2,
    relevancyScore: 72,
    readTime: 6,
    tags: ["Programming", "Rust"],
  },
  {
    id: "5",
    title: "The Art of Coffee Brewing",
    excerpt: "Exploring the subtle differences between pour-over, french press, and espresso extraction methods.",
    content: "A deep dive into brewing methods...",
    source: "Lifestyle Weekly",
    author: "James Hoffmann",
    date: "2025-12-16T08:00:00Z",
    imageUrl: coffeeImage,
    relevancyScore: 45,
    readTime: 4,
    tags: ["Lifestyle"],
  },
  {
    id: "6",
    title: "SpaceX Starship Successfully Orbits",
    excerpt: "After months of testing, the massive rocket has achieved stable orbit, marking a new era in spaceflight.",
    content: "Coverage of the launch...",
    source: "SpaceNews",
    author: "Elon M.",
    date: "2025-12-19T10:45:00Z",
    imageUrl: architecturalImage2, // Using abstract/archi as fallback for space
    relevancyScore: 92,
    readTime: 7,
    tags: ["Space", "Tech"],
  },
  {
    id: "7",
    title: "10 CSS Tricks You Didn't Know",
    excerpt: "Enhance your web projects with these modern CSS features that are now widely supported.",
    content: "List of CSS tricks...",
    source: "CSS Tricks",
    author: "Chris Coyier",
    date: "2025-12-15T16:30:00Z",
    relevancyScore: 55,
    readTime: 12,
    tags: ["Web Dev", "CSS"],
  },
  {
    id: "8",
    title: "Understanding Quantum Computing",
    excerpt: "A beginner's guide to qubits, superposition, and entanglement.",
    content: "Quantum physics explained...",
    source: "Science Daily",
    author: "Dr. Physics",
    date: "2025-12-14T09:15:00Z",
    relevancyScore: 30,
    readTime: 15,
    tags: ["Science", "Quantum"],
  },
  {
    id: "9",
    title: "New Electric Vehicle Battery Tech",
    excerpt: "Solid state batteries promise double the range and half the charging time.",
    content: "Battery tech breakdown...",
    source: "Car & Driver",
    author: "Auto Journalist",
    date: "2025-12-19T11:00:00Z",
    relevancyScore: 78,
    readTime: 5,
    tags: ["Tech", "Auto"],
  },
  {
    id: "10",
    title: "Local Restaurant Review: The Golden Spoon",
    excerpt: "A hidden gem in the downtown district serving authentic fusion cuisine.",
    content: "Restaurant review...",
    source: "Local Gazette",
    author: "Foodie Jane",
    date: "2025-12-18T19:00:00Z",
    relevancyScore: 15,
    readTime: 3,
    tags: ["Food", "Local"],
  },
];
