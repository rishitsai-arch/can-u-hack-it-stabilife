/**
 * Stabilife Data & Storage Manager
 * Handles localStorage persistence, mock seed data, and reactive data operations.
 */

const STORAGE_KEYS = {
  USERS: 'stabilife_users',
  SESSION: 'stabilife_session',
  POSTS: 'stabilife_posts',
  FOLLOWS: 'stabilife_follows',
  NOTIFICATIONS: 'stabilife_notifications',
  BOOKMARKS: 'stabilife_bookmarks',
  THEME: 'stabilife_theme'
};

// Default Demo User
const DEFAULT_USER = {
  id: 'user_ajayk',
  name: 'Ajay Kumar',
  handle: '@ajayk',
  email: 'ajay@stabilife.com',
  password: 'password123',
  avatar: 'AK',
  avatarGradient: 'linear-gradient(135deg, #7c3aed, #f43f5e)',
  bio: 'Product builder & design engineer | Exploring mindful social tech at Stabilife ✨',
  location: 'San Francisco, CA',
  website: 'https://stabilife.app',
  joined: 'September 2026',
  followingCount: 89,
  followersCount: 142
};

// Default Seed Posts
const INITIAL_POSTS = [
  {
    id: 'post_1',
    author: {
      name: 'John Doe',
      handle: '@johndoe',
      avatar: 'JD',
      avatarGradient: 'linear-gradient(135deg, #2563eb, #38bdf8)'
    },
    time: '2h',
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    text: 'Building something amazing with a clean UI and a strong product story. Frontend-only mockups are a great way to validate ideas fast. #Frontend #Design',
    hasMedia: true,
    mediaUrl: '', // Uses dynamic gradient placeholder in render if empty
    likes: ['@mila', '@priya'],
    retweets: ['@priya'],
    comments: [
      {
        id: 'c1',
        author: { name: 'Mila Smith', handle: '@mila', avatar: 'MS', avatarGradient: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
        time: '1h',
        text: 'Totally agree! Fast prototypes help align teams much quicker.'
      }
    ],
    tags: ['#Frontend', '#Design']
  },
  {
    id: 'post_2',
    author: {
      name: 'Mila Smith',
      handle: '@mila',
      avatar: 'MS',
      avatarGradient: 'linear-gradient(135deg, #ec4899, #f43f5e)'
    },
    time: '4h',
    timestamp: Date.now() - 4 * 60 * 60 * 1000,
    text: 'A simple timeline with thoughtful spacing, good hierarchy, and mobile-friendly behavior can make a big difference in user experience. #UIUX #WebDev',
    hasMedia: false,
    mediaUrl: '',
    likes: ['@johndoe', '@ajayk', '@priya'],
    retweets: ['@johndoe'],
    comments: [
      {
        id: 'c2',
        author: { name: 'Ajay Kumar', handle: '@ajayk', avatar: 'AK', avatarGradient: 'linear-gradient(135deg, #7c3aed, #f43f5e)' },
        time: '3h',
        text: 'The micro-interactions on the feed feel so fluid!'
      }
    ],
    tags: ['#UIUX', '#WebDev']
  },
  {
    id: 'post_3',
    author: {
      name: 'Priya Kumar',
      handle: '@priya',
      avatar: 'PK',
      avatarGradient: 'linear-gradient(135deg, #059669, #10b981)'
    },
    time: '8h',
    timestamp: Date.now() - 8 * 60 * 60 * 1000,
    text: 'Love seeing product ideas turn into prototypes quickly. The best part is that the interface feels real even before the backend is connected. #Product #Startup',
    hasMedia: false,
    mediaUrl: '',
    likes: ['@johndoe', '@mila'],
    retweets: ['@mila'],
    comments: [],
    tags: ['#Product', '#Startup']
  }
];

// Default Follow Recommendations
const INITIAL_FOLLOW_SUGGESTIONS = [
  {
    id: 'follow_1',
    name: 'Ariana Reed',
    handle: '@ariana',
    avatar: 'AR',
    avatarGradient: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
    bio: 'Design Systems lead & UI enthusiast'
  },
  {
    id: 'follow_2',
    name: 'Leo Tate',
    handle: '@leo',
    avatar: 'LT',
    avatarGradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
    bio: 'Fullstack developer & open source builder'
  },
  {
    id: 'follow_3',
    name: 'Sophia Chen',
    handle: '@sophia',
    avatar: 'SC',
    avatarGradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    bio: 'AI researcher and web accessibility advocate'
  }
];

const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif_1',
    type: 'like',
    icon: '♥',
    user: { name: 'Mila Smith', handle: '@mila', avatar: 'MS' },
    text: 'liked your post "The micro-interactions on the feed feel so fluid!"',
    time: '1h ago'
  },
  {
    id: 'notif_2',
    type: 'retweet',
    icon: '↻',
    user: { name: 'John Doe', handle: '@johndoe', avatar: 'JD' },
    text: 'reposted your update',
    time: '3h ago'
  },
  {
    id: 'notif_3',
    type: 'follow',
    icon: '👤',
    user: { name: 'Ariana Reed', handle: '@ariana', avatar: 'AR' },
    text: 'started following you',
    time: '1d ago'
  }
];

const Storage = {
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([DEFAULT_USER]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.POSTS)) {
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(INITIAL_POSTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.FOLLOWS)) {
      localStorage.setItem(STORAGE_KEYS.FOLLOWS, JSON.stringify(['@ariana']));
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
    }
  },

  // USERS
  getUsers() {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [DEFAULT_USER];
    } catch {
      return [DEFAULT_USER];
    }
  },

  saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  registerUser(userData) {
    const users = this.getUsers();
    const existing = users.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existing) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    const initials = userData.name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

    const gradients = [
      'linear-gradient(135deg, #7c3aed, #f43f5e)',
      'linear-gradient(135deg, #1d9bf0, #38bdf8)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #f59e0b, #ef4444)',
      'linear-gradient(135deg, #8b5cf6, #d946ef)'
    ];
    const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];

    const handle = '@' + userData.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);

    const newUser = {
      id: 'user_' + Date.now(),
      name: userData.name,
      handle: handle,
      email: userData.email.toLowerCase(),
      password: userData.password,
      avatar: initials,
      avatarGradient: randomGradient,
      bio: 'New member of Stabilife. Excited to share and connect! 🌟',
      location: 'Earth',
      website: '',
      joined: 'September 2026',
      followingCount: 1,
      followersCount: 0
    };

    users.push(newUser);
    this.saveUsers(users);
    this.setSession(newUser);
    return { success: true, user: newUser };
  },

  // AUTH SESSION
  getSession() {
    this.init();
    try {
      const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION));
      if (session) return session;
    } catch (e) {}
    return DEFAULT_USER;
  },

  hasActiveSession() {
    try {
      return !!localStorage.getItem(STORAGE_KEYS.SESSION);
    } catch {
      return false;
    }
  },

  setSession(user) {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  },

  login(email, password) {
    const users = this.getUsers();
    const user = users.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!user) {
      return { success: false, error: 'Invalid email or password.' };
    }
    this.setSession(user);
    return { success: true, user };
  },

  // POSTS
  getPosts() {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS)) || INITIAL_POSTS;
    } catch {
      return INITIAL_POSTS;
    }
  },

  savePosts(posts) {
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
  },

  addPost(newPostData) {
    const posts = this.getPosts();
    const user = this.getSession();

    const post = {
      id: 'post_' + Date.now(),
      author: {
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
        avatarGradient: user.avatarGradient || 'linear-gradient(135deg, #7c3aed, #f43f5e)'
      },
      time: 'Just now',
      timestamp: Date.now(),
      text: newPostData.text.trim(),
      hasMedia: !!newPostData.mediaUrl,
      mediaUrl: newPostData.mediaUrl || '',
      likes: [],
      retweets: [],
      comments: [],
      tags: this.extractHashtags(newPostData.text),
      poll: newPostData.poll || null,
      quotePost: newPostData.quotePost || null
    };

    posts.unshift(post);
    this.savePosts(posts);
    return post;
  },

  extractHashtags(text) {
    const matches = text.match(/#[a-zA-Z0-9_]+/g);
    return matches ? Array.from(new Set(matches)) : [];
  },

  deletePost(postId) {
    let posts = this.getPosts();
    posts = posts.filter(p => p.id !== postId);
    this.savePosts(posts);
    return posts;
  },

  toggleLike(postId) {
    const posts = this.getPosts();
    const user = this.getSession();
    const post = posts.find(p => p.id === postId);
    if (!post) return null;

    if (!Array.isArray(post.likes)) post.likes = [];
    const index = post.likes.indexOf(user.handle);
    const wasLiked = index !== -1;

    if (wasLiked) {
      post.likes.splice(index, 1);
    } else {
      post.likes.push(user.handle);
      if (post.author.handle !== user.handle) {
        this.addNotification({
          type: 'like',
          icon: '♥',
          user: { name: user.name, handle: user.handle, avatar: user.avatar },
          text: `liked your post: "${post.text.slice(0, 45)}..."`,
          time: 'Just now'
        });
      }
    }

    this.savePosts(posts);
    return { post, liked: !wasLiked, count: post.likes.length };
  },

  toggleRetweet(postId) {
    const posts = this.getPosts();
    const user = this.getSession();
    const post = posts.find(p => p.id === postId);
    if (!post) return null;

    if (!Array.isArray(post.retweets)) post.retweets = [];
    const index = post.retweets.indexOf(user.handle);
    const wasRetweeted = index !== -1;

    if (wasRetweeted) {
      post.retweets.splice(index, 1);
    } else {
      post.retweets.push(user.handle);
      if (post.author.handle !== user.handle) {
        this.addNotification({
          type: 'retweet',
          icon: '↻',
          user: { name: user.name, handle: user.handle, avatar: user.avatar },
          text: `reposted your post: "${post.text.slice(0, 45)}..."`,
          time: 'Just now'
        });
      }
    }

    this.savePosts(posts);
    return { post, retweeted: !wasRetweeted, count: post.retweets.length };
  },

  addComment(postId, commentText) {
    const posts = this.getPosts();
    const user = this.getSession();
    const post = posts.find(p => p.id === postId);
    if (!post) return null;

    if (!Array.isArray(post.comments)) post.comments = [];

    const newComment = {
      id: 'c_' + Date.now(),
      author: {
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
        avatarGradient: user.avatarGradient || 'linear-gradient(135deg, #7c3aed, #f43f5e)'
      },
      time: 'Just now',
      timestamp: Date.now(),
      text: commentText.trim()
    };

    post.comments.push(newComment);
    this.savePosts(posts);

    if (post.author.handle !== user.handle) {
      this.addNotification({
        type: 'comment',
        icon: '💬',
        user: { name: user.name, handle: user.handle, avatar: user.avatar },
        text: `replied to your post: "${commentText.slice(0, 40)}..."`,
        time: 'Just now'
      });
    }

    return { post, comment: newComment };
  },

  // FOLLOWS
  getFollows() {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.FOLLOWS)) || ['@ariana'];
    } catch {
      return ['@ariana'];
    }
  },

  toggleFollow(targetHandle) {
    let follows = this.getFollows();
    const isFollowing = follows.includes(targetHandle);

    if (isFollowing) {
      follows = follows.filter(h => h !== targetHandle);
    } else {
      follows.push(targetHandle);
    }

    localStorage.setItem(STORAGE_KEYS.FOLLOWS, JSON.stringify(follows));
    return { isFollowing: !isFollowing, follows };
  },

  // NOTIFICATIONS
  getNotifications() {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) || INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  },

  addNotification(notif) {
    const notifs = this.getNotifications();
    notif.id = 'notif_' + Date.now();
    notifs.unshift(notif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs.slice(0, 30)));
  },

  getFollowSuggestions() {
    const follows = this.getFollows();
    return INITIAL_FOLLOW_SUGGESTIONS.map(s => ({
      ...s,
      isFollowing: follows.includes(s.handle)
    }));
  },

  // BOOKMARKS
  getBookmarks() {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS)) || [];
    } catch {
      return [];
    }
  },

  toggleBookmark(postId) {
    let bookmarks = this.getBookmarks();
    const index = bookmarks.indexOf(postId);
    const isBookmarked = index !== -1;

    if (isBookmarked) {
      bookmarks.splice(index, 1);
    } else {
      bookmarks.push(postId);
    }

    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    return { isBookmarked: !isBookmarked, count: bookmarks.length };
  },

  isBookmarked(postId) {
    return this.getBookmarks().includes(postId);
  },

  // POLL VOTING
  votePoll(postId, optionIndex) {
    const posts = this.getPosts();
    const user = this.getSession();
    const post = posts.find(p => p.id === postId);
    if (!post || !post.poll || !post.poll.options[optionIndex]) return null;

    // Check if user already voted on any option in this poll
    const alreadyVoted = post.poll.options.some(opt => opt.votes.includes(user.handle));
    if (alreadyVoted) return { post, error: 'Already voted' };

    post.poll.options[optionIndex].votes.push(user.handle);
    this.savePosts(posts);
    return { post, success: true };
  },

  // UPDATE PROFILE
  updateUserProfile(updatedData) {
    const user = this.getSession();
    const users = this.getUsers();

    const merged = { ...user, ...updatedData };
    this.setSession(merged);

    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex] = merged;
      this.saveUsers(users);
    }

    // Also update author info on existing posts by this user
    let posts = this.getPosts();
    let updatedPosts = false;
    posts.forEach(p => {
      if (p.author.handle === user.handle) {
        if (updatedData.name) p.author.name = updatedData.name;
        if (updatedData.avatarGradient) p.author.avatarGradient = updatedData.avatarGradient;
        if (updatedData.avatar) p.author.avatar = updatedData.avatar;
        updatedPosts = true;
      }
    });
    if (updatedPosts) this.savePosts(posts);

    return merged;
  },

  // THEME
  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  },

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  },

  toggleTheme() {
    const current = this.getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    return next;
  }
};

// Auto initialize theme on load
if (typeof document !== 'undefined') {
  if (Storage.getTheme() === 'dark') {
    document.body.classList.add('dark-theme');
  }
}

// Export globally for browser scripts
window.StabilifeStorage = Storage;

