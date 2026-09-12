/**
 * Stabilife Main Application Logic
 * Manages timeline feed, composer, quote tweets, retweet menu, polls,
 * real file attachments, bookmarks, direct messages, theme toggle,
 * modals, and profile view.
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.StabilifeStorage) return;

  const App = {
    currentUser: null,
    currentTab: 'home',
    currentFilter: null,
    searchQuery: '',
    selectedMediaUrl: '',
    pollActive: false,
    activeChatContact: 'johndoe',

    // Modal compose state
    modalSelectedMediaUrl: '',
    modalQuotedPost: null,

    // Mock chat histories per contact
    chatHistories: {
      johndoe: [
        { from: 'them', text: 'Hey Ajay! Loving the new interface you built on Stabilife.', time: '10:14 AM' },
        { from: 'me', text: 'Thanks John! We just added real-time feed interactions and full JavaScript features!', time: '10:15 AM' }
      ],
      mila: [
        { from: 'them', text: 'Check out the new design system guidelines when you get a chance.', time: 'Yesterday' },
        { from: 'me', text: 'On it! The typography hierarchy looks super clean.', time: 'Yesterday' }
      ],
      ariana: [
        { from: 'them', text: 'Hello! Excited to connect with you on Stabilife.', time: '2d ago' },
        { from: 'me', text: 'Great having you here, Ariana!', time: '2d ago' }
      ]
    },

    init() {
      this.currentUser = window.StabilifeStorage.getSession();
      this.bindDOM();
      this.setupThemeToggle();
      this.renderUserProfile();
      this.renderFeed();
      this.renderFollowList();
      this.setupComposer();
      this.setupNav();
      this.setupSearchAndTrending();
      this.setupModals();
      this.setupProfileMenu();
      this.setupMobileFAB();
    },

    bindDOM() {
      this.feedContainer = document.querySelector('.feed');
      this.composerTextarea = document.querySelector('.composer textarea');
      this.postBtn = document.querySelector('.post-btn');
      this.sidebarPostBtn = document.querySelector('.tweet-button');
      this.searchInput = document.querySelector('.search-box input');
      this.mainPanel = document.querySelector('.main-panel');
      this.topbarTitle = document.querySelector('.topbar h1');
      this.themeToggleBtn = document.getElementById('theme-toggle-btn');
      this.fileInput = document.getElementById('composer-file-input');
      this.mobileFabBtn = document.getElementById('mobile-fab-btn');
    },

    setupThemeToggle() {
      if (!this.themeToggleBtn) return;
      const currentTheme = window.StabilifeStorage.getTheme();
      this.themeToggleBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';

      this.themeToggleBtn.addEventListener('click', () => {
        const newTheme = window.StabilifeStorage.toggleTheme();
        this.themeToggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        if (window.showToast) {
          window.showToast(
            `Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode`,
            'info'
          );
        }
      });
    },

    setupMobileFAB() {
      if (!this.mobileFabBtn) return;
      this.mobileFabBtn.addEventListener('click', () => {
        this.openComposeModal();
      });
    },

    renderUserProfile() {
      const user = this.currentUser;
      if (!user) return;

      // Sidebar mini profile
      const miniProfile = document.querySelector('.profile-mini');
      if (miniProfile) {
        const avatar = miniProfile.querySelector('.avatar');
        const strong = miniProfile.querySelector('.profile-meta strong');
        const span = miniProfile.querySelector('.profile-meta span');

        if (avatar) {
          avatar.textContent = user.avatar || 'U';
          if (user.avatarGradient) avatar.style.background = user.avatarGradient;
        }
        if (strong) strong.textContent = user.name;
        if (span) span.textContent = user.handle;
      }

      // Composer avatar
      const composerAvatar = document.querySelector('.composer .avatar');
      if (composerAvatar) {
        composerAvatar.textContent = user.avatar || 'U';
        if (user.avatarGradient) composerAvatar.style.background = user.avatarGradient;
      }
    },

    setupProfileMenu() {
      const miniProfile = document.querySelector('.profile-mini');
      if (!miniProfile) return;

      miniProfile.style.cursor = 'pointer';
      miniProfile.title = 'Account options';

      let menu = document.getElementById('profile-popup-menu');
      if (!menu) {
        menu = document.createElement('div');
        menu.id = 'profile-popup-menu';
        menu.className = 'profile-dropdown-menu';
        menu.innerHTML = `
          <div class="menu-header">
            <div class="avatar small" style="background: ${this.currentUser.avatarGradient || '#1d9bf0'}">
              ${this.currentUser.avatar}
            </div>
            <div>
              <strong>${this.currentUser.name}</strong>
              <div class="muted-text">${this.currentUser.handle}</div>
            </div>
          </div>
          <div class="menu-divider"></div>
          <button class="menu-item" id="menu-view-profile">👤 View Profile</button>
          <button class="menu-item" id="menu-switch-account">⚡ Switch to Demo (Ajay)</button>
          <div class="menu-divider"></div>
          <button class="menu-item logout" id="menu-logout">🚪 Log out ${this.currentUser.handle}</button>
        `;
        document.body.appendChild(menu);
      }

      miniProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = miniProfile.getBoundingClientRect();
        const isVisible = menu.classList.contains('show');

        if (isVisible) {
          menu.classList.remove('show');
        } else {
          menu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
          menu.style.left = `${rect.left}px`;
          menu.classList.add('show');
        }
      });

      document.addEventListener('click', () => {
        menu.classList.remove('show');
      });

      menu.addEventListener('click', (e) => e.stopPropagation());

      document.getElementById('menu-view-profile')?.addEventListener('click', () => {
        menu.classList.remove('show');
        this.switchTab('profile');
      });

      document.getElementById('menu-switch-account')?.addEventListener('click', () => {
        menu.classList.remove('show');
        window.StabilifeStorage.setSession(window.StabilifeStorage.getUsers()[0]);
        window.location.reload();
      });

      document.getElementById('menu-logout')?.addEventListener('click', () => {
        menu.classList.remove('show');
        if (window.StabilifeAuth) {
          window.StabilifeAuth.logout();
        } else {
          window.StabilifeStorage.clearSession();
          window.location.href = 'login.html';
        }
      });
    },

    setupNav() {
      const navItems = document.querySelectorAll('.nav .nav-item');
      navItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          navItems.forEach(i => i.classList.remove('active'));
          item.classList.add('active');

          const tabText = item.textContent.trim().toLowerCase();
          if (tabText.includes('home')) this.switchTab('home');
          else if (tabText.includes('explore')) this.switchTab('explore');
          else if (tabText.includes('notifications')) this.switchTab('notifications');
          else if (tabText.includes('messages')) this.switchTab('messages');
          else if (tabText.includes('bookmarks')) this.switchTab('bookmarks');
          else if (tabText.includes('profile')) this.switchTab('profile');
          else if (tabText.includes('more')) this.switchTab('more');
        });
      });

      // Sidebar "Post" button: opens floating compose modal
      if (this.sidebarPostBtn) {
        this.sidebarPostBtn.addEventListener('click', () => {
          this.openComposeModal();
        });
      }
    },

    switchTab(tab) {
      this.currentTab = tab;
      const composer = document.querySelector('.composer');

      const navItems = document.querySelectorAll('.nav .nav-item');
      navItems.forEach(i => {
        const text = i.textContent.trim().toLowerCase();
        i.classList.toggle('active', text.includes(tab));
      });

      if (tab === 'home') {
        if (this.topbarTitle) this.topbarTitle.textContent = 'Home';
        if (composer) composer.style.display = 'block';
        this.renderFeed();
      } else if (tab === 'explore') {
        if (this.topbarTitle) this.topbarTitle.textContent = 'Explore Trends';
        if (composer) composer.style.display = 'none';
        this.renderExploreView();
      } else if (tab === 'notifications') {
        if (this.topbarTitle) this.topbarTitle.textContent = 'Notifications';
        if (composer) composer.style.display = 'none';
        this.renderNotificationsView();
      } else if (tab === 'messages') {
        if (this.topbarTitle) this.topbarTitle.textContent = 'Messages';
        if (composer) composer.style.display = 'none';
        this.renderMessagesView();
      } else if (tab === 'bookmarks') {
        if (this.topbarTitle) this.topbarTitle.textContent = 'Bookmarks';
        if (composer) composer.style.display = 'none';
        this.renderBookmarksView();
      } else if (tab === 'profile') {
        if (this.topbarTitle) this.topbarTitle.textContent = this.currentUser.name;
        if (composer) composer.style.display = 'none';
        this.renderProfileView();
      } else if (tab === 'more') {
        if (this.topbarTitle) this.topbarTitle.textContent = 'More Settings';
        if (composer) composer.style.display = 'none';
        this.renderMoreView();
      }
    },

    setupComposer() {
      if (!this.composerTextarea || !this.postBtn) return;

      // Character counter
      let charCounter = document.getElementById('composer-char-count');
      if (!charCounter) {
        charCounter = document.createElement('span');
        charCounter.id = 'composer-char-count';
        charCounter.className = 'char-counter';
        charCounter.textContent = '280';
        this.postBtn.parentNode.insertBefore(charCounter, this.postBtn);
      }

      // Media preview container
      let mediaPreview = document.getElementById('composer-media-preview');
      if (!mediaPreview) {
        mediaPreview = document.createElement('div');
        mediaPreview.id = 'composer-media-preview';
        mediaPreview.className = 'media-preview-container';
        mediaPreview.style.display = 'none';
        const composerRow = document.querySelector('.composer-row');
        if (composerRow && composerRow.parentNode) {
          composerRow.parentNode.insertBefore(mediaPreview, composerRow.nextSibling);
        }
      }

      // Poll composer container
      let pollBox = document.getElementById('composer-poll-box');
      if (!pollBox) {
        pollBox = document.createElement('div');
        pollBox.id = 'composer-poll-box';
        pollBox.className = 'poll-composer-box';
        pollBox.style.display = 'none';
        pollBox.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-weight:600; font-size:0.85rem;">
            <span>📊 Create a Poll</span>
            <span id="close-poll-composer" style="cursor:pointer; color:var(--muted)">✕ Remove</span>
          </div>
          <input type="text" id="poll-opt-1" placeholder="Option 1" maxlength="50" />
          <input type="text" id="poll-opt-2" placeholder="Option 2" maxlength="50" />
        `;
        const composerRow = document.querySelector('.composer-row');
        if (composerRow && composerRow.parentNode) {
          composerRow.parentNode.insertBefore(pollBox, composerRow.nextSibling);
        }

        document.getElementById('close-poll-composer')?.addEventListener('click', () => {
          this.pollActive = false;
          pollBox.style.display = 'none';
          document.getElementById('poll-opt-1').value = '';
          document.getElementById('poll-opt-2').value = '';
        });
      }

      // Auto-expand textarea & update count
      this.composerTextarea.addEventListener('input', () => {
        this.composerTextarea.style.height = 'auto';
        this.composerTextarea.style.height = Math.max(90, this.composerTextarea.scrollHeight) + 'px';

        const remaining = 280 - this.composerTextarea.value.length;
        charCounter.textContent = remaining;
        charCounter.classList.toggle('over-limit', remaining < 0);
        charCounter.classList.toggle('near-limit', remaining <= 20 && remaining >= 0);
      });

      // Real File Input Listener
      if (this.fileInput) {
        this.fileInput.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              this.displayImagePreview(event.target.result, mediaPreview);
            };
            reader.readAsDataURL(file);
          }
        });
      }

      // Toolset button actions
      const tools = document.querySelectorAll('.composer .toolset span');
      if (tools.length >= 4) {
        tools[0].title = 'Add Image (Upload or URL)';
        tools[0].style.cursor = 'pointer';
        tools[0].addEventListener('click', () => {
          if (this.fileInput) {
            this.fileInput.click();
          } else {
            this.handleImagePrompt(mediaPreview);
          }
        });

        tools[1].title = 'Insert Emoji';
        tools[1].style.cursor = 'pointer';
        tools[1].addEventListener('click', (e) => this.toggleEmojiPicker(e, this.composerTextarea));

        tools[2].title = 'Create Poll';
        tools[2].style.cursor = 'pointer';
        tools[2].addEventListener('click', () => {
          this.pollActive = !this.pollActive;
          pollBox.style.display = this.pollActive ? 'block' : 'none';
          if (this.pollActive) {
            document.getElementById('poll-opt-1')?.focus();
          }
        });

        tools[3].title = 'Clear Composer';
        tools[3].style.cursor = 'pointer';
        tools[3].addEventListener('click', () => {
          this.composerTextarea.value = '';
          this.selectedMediaUrl = '';
          this.pollActive = false;
          mediaPreview.style.display = 'none';
          pollBox.style.display = 'none';
          this.composerTextarea.dispatchEvent(new Event('input'));
        });
      }

      // "Tweet" Post button click handler
      this.postBtn.addEventListener('click', () => {
        const text = this.composerTextarea.value.trim();
        if (!text && !this.selectedMediaUrl && !this.pollActive) {
          if (window.showToast) {
            window.showToast('Please write something or attach an image/poll to post!', 'info');
          }
          this.composerTextarea.focus();
          return;
        }
        this.submitPost(mediaPreview, pollBox);
      });

      // Shortcut: Ctrl+Enter
      this.composerTextarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          this.submitPost(mediaPreview, pollBox);
        }
      });
    },

    displayImagePreview(url, previewContainer) {
      this.selectedMediaUrl = url;
      previewContainer.innerHTML = `
        <div class="preview-wrap">
          <img src="${url}" alt="Attachment preview" />
          <button class="remove-media-btn" title="Remove image">✕</button>
        </div>
      `;
      previewContainer.style.display = 'block';

      previewContainer.querySelector('.remove-media-btn').addEventListener('click', () => {
        this.selectedMediaUrl = '';
        if (this.fileInput) this.fileInput.value = '';
        previewContainer.style.display = 'none';
        previewContainer.innerHTML = '';
        this.composerTextarea.dispatchEvent(new Event('input'));
      });

      this.composerTextarea.dispatchEvent(new Event('input'));
    },

    handleImagePrompt(previewContainer) {
      const choice = prompt('Enter image URL or select preset (1: Abstract, 2: Modern Art):', '1');
      if (!choice) return;
      let url = choice.trim();
      if (url === '1') url = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80';
      else if (url === '2') url = 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1000&q=80';
      this.displayImagePreview(url, previewContainer);
    },

    toggleEmojiPicker(event, targetTextarea) {
      let picker = document.getElementById('quick-emoji-picker');
      if (!picker) {
        picker = document.createElement('div');
        picker.id = 'quick-emoji-picker';
        picker.className = 'emoji-picker-popup';

        const emojis = ['✨', '🚀', '❤️', '🔥', '🎉', '💡', '👏', '💯', '🌟', '🌿', '💬', '☕', '🎯', '⚡'];
        picker.innerHTML = emojis.map(em => `<span class="emoji-opt">${em}</span>`).join('');
        document.body.appendChild(picker);
      }

      // Handle clicking an emoji
      picker.onclick = (e) => {
        if (e.target.classList.contains('emoji-opt')) {
          const emoji = e.target.textContent;
          if (targetTextarea) {
            targetTextarea.value += emoji;
            targetTextarea.dispatchEvent(new Event('input'));
            targetTextarea.focus();
          }
          picker.classList.remove('show');
        }
      };

      const rect = event.currentTarget.getBoundingClientRect();
      const isShown = picker.classList.contains('show');
      if (isShown) {
        picker.classList.remove('show');
      } else {
        picker.style.top = `${rect.bottom + 8}px`;
        picker.style.left = `${rect.left}px`;
        picker.classList.add('show');
      }

      const closePicker = (e) => {
        if (!picker.contains(e.target) && !event.currentTarget.contains(e.target)) {
          picker.classList.remove('show');
          document.removeEventListener('click', closePicker);
        }
      };
      setTimeout(() => document.addEventListener('click', closePicker), 10);
    },

    submitPost(previewContainer, pollBox) {
      const text = this.composerTextarea.value.trim();
      let pollData = null;

      if (this.pollActive) {
        const opt1 = document.getElementById('poll-opt-1')?.value.trim();
        const opt2 = document.getElementById('poll-opt-2')?.value.trim();
        if (opt1 && opt2) {
          pollData = {
            options: [
              { text: opt1, votes: [] },
              { text: opt2, votes: [] }
            ]
          };
        }
      }

      if (!text && !this.selectedMediaUrl && !pollData) return;

      window.StabilifeStorage.addPost({
        text: text || '📊 Community Poll:',
        mediaUrl: this.selectedMediaUrl,
        poll: pollData
      });

      this.composerTextarea.value = '';
      this.composerTextarea.style.height = '90px';
      this.selectedMediaUrl = '';
      this.pollActive = false;

      if (previewContainer) {
        previewContainer.style.display = 'none';
        previewContainer.innerHTML = '';
      }
      if (pollBox) {
        pollBox.style.display = 'none';
        document.getElementById('poll-opt-1').value = '';
        document.getElementById('poll-opt-2').value = '';
      }
      if (this.fileInput) this.fileInput.value = '';

      this.composerTextarea.dispatchEvent(new Event('input'));

      if (window.showToast) {
        window.showToast('Your post has been published!', 'success');
      }

      this.renderFeed();
    },

    renderFeed() {
      if (!this.feedContainer) return;
      let posts = window.StabilifeStorage.getPosts();

      if (this.currentFilter) {
        posts = posts.filter(p => p.tags && p.tags.includes(this.currentFilter));
      } else if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase().trim();
        posts = posts.filter(p =>
          p.text.toLowerCase().includes(q) ||
          p.author.name.toLowerCase().includes(q) ||
          p.author.handle.toLowerCase().includes(q)
        );
      }

      this.feedContainer.innerHTML = '';

      if (this.currentFilter || this.searchQuery.trim()) {
        const filterBanner = document.createElement('div');
        filterBanner.className = 'filter-active-banner';
        filterBanner.innerHTML = `
          <span>Showing results for: <strong>${this.currentFilter || this.searchQuery}</strong></span>
          <button class="clear-filter-btn">✕ Clear</button>
        `;
        filterBanner.querySelector('.clear-filter-btn').addEventListener('click', () => {
          this.currentFilter = null;
          this.searchQuery = '';
          if (this.searchInput) this.searchInput.value = '';
          this.renderFeed();
        });
        this.feedContainer.appendChild(filterBanner);
      }

      if (posts.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-feed-state';
        emptyState.innerHTML = `
          <div class="empty-icon">💬</div>
          <h3>No posts found</h3>
          <p>Try searching for different keywords or post the first update!</p>
        `;
        this.feedContainer.appendChild(emptyState);
        return;
      }

      posts.forEach(post => {
        const postElement = this.createPostElement(post);
        this.feedContainer.appendChild(postElement);
      });
    },

    createPostElement(post) {
      const article = document.createElement('article');
      article.className = 'tweet';
      article.dataset.postId = post.id;

      const userHandle = this.currentUser.handle;
      const isLiked = Array.isArray(post.likes) && post.likes.includes(userHandle);
      const isRetweeted = Array.isArray(post.retweets) && post.retweets.includes(userHandle);
      const isBookmarked = window.StabilifeStorage.isBookmarked(post.id);
      const isOwnPost = post.author.handle === userHandle;

      const formattedText = post.text.replace(
        /(#[a-zA-Z0-9_]+)/g,
        `<span class="post-hashtag">$1</span>`
      );

      let mediaHTML = '';
      if (post.mediaUrl) {
        mediaHTML = `<div class="tweet-media-img-wrap"><img src="${post.mediaUrl}" alt="Attachment" class="tweet-media-img"/></div>`;
      } else if (post.hasMedia) {
        mediaHTML = `<div class="tweet-media"></div>`;
      }

      // Quoted Tweet Embed
      let quotedHTML = '';
      if (post.quotePost) {
        quotedHTML = `
          <div class="quoted-tweet-card" data-quote-id="${post.quotePost.id}">
            <div class="quoted-head">
              <div class="avatar small" style="width:24px; height:24px; font-size:0.7rem; background:${post.quotePost.author.avatarGradient || '#1d9bf0'}">
                ${post.quotePost.author.avatar}
              </div>
              <span class="user-name">${post.quotePost.author.name}</span>
              <span class="handle">${post.quotePost.author.handle}</span>
              <span class="time">· ${post.quotePost.time || 'earlier'}</span>
            </div>
            <p class="quoted-text">${post.quotePost.text}</p>
          </div>
        `;
      }

      // Poll rendering
      let pollHTML = '';
      if (post.poll && Array.isArray(post.poll.options)) {
        const totalVotes = post.poll.options.reduce((sum, opt) => sum + (opt.votes ? opt.votes.length : 0), 0);
        const hasVoted = post.poll.options.some(opt => opt.votes && opt.votes.includes(userHandle));

        const optionsMarkup = post.poll.options.map((opt, idx) => {
          const count = opt.votes ? opt.votes.length : 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const userChoseThis = opt.votes && opt.votes.includes(userHandle);

          return `
            <div class="poll-option-btn ${userChoseThis ? 'voted' : ''}" data-opt-idx="${idx}">
              <div class="poll-bar" style="width: ${hasVoted ? pct : 0}%"></div>
              <span class="poll-opt-text">${opt.text} ${userChoseThis ? '✓' : ''}</span>
              ${hasVoted ? `<span class="poll-opt-pct">${pct}% (${count})</span>` : ''}
            </div>
          `;
        }).join('');

        pollHTML = `
          <div class="poll-box" data-poll-id="${post.id}">
            ${optionsMarkup}
            <div class="poll-meta-line">${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'} · ${hasVoted ? 'Final results' : 'Click an option to vote'}</div>
          </div>
        `;
      }

      article.innerHTML = `
        <div class="avatar small" style="background: ${post.author.avatarGradient || '#1d9bf0'}">
          ${post.author.avatar}
        </div>
        <div class="tweet-content-col">
          <div class="tweet-head">
            <div class="user-line">
              <span class="user-name">${post.author.name}</span>
              <span class="handle">${post.author.handle}</span>
              <span class="time">· ${post.time || 'now'}</span>
            </div>
            <div class="tweet-options-btn" title="Options">•••</div>
          </div>
          <p class="tweet-text">${formattedText}</p>
          ${quotedHTML}
          ${pollHTML}
          ${mediaHTML}
          <div class="tweet-actions">
            <div class="action-item comment-action" title="Post Reply / Comment">
              <span class="action-icon">💬</span>
              <span class="count">${(post.comments && post.comments.length) || 0}</span>
            </div>
            <div class="action-item retweet ${isRetweeted ? 'active' : ''}" title="Repost or Quote">
              <span class="action-icon">↻</span>
              <span class="count">${(post.retweets && post.retweets.length) || 0}</span>
            </div>
            <div class="action-item like ${isLiked ? 'active' : ''}" title="Like">
              <span class="action-icon">${isLiked ? '♥' : '♡'}</span>
              <span class="count">${(post.likes && post.likes.length) || 0}</span>
            </div>
            <div class="action-item share-action" title="Share">
              <span class="action-icon">↗</span>
            </div>
          </div>
        </div>
      `;

      // Hashtag filter
      article.querySelectorAll('.post-hashtag').forEach(tagEl => {
        tagEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.currentFilter = tagEl.textContent;
          this.renderFeed();
        });
      });

      // Poll voting interaction
      article.querySelectorAll('.poll-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const optIdx = parseInt(btn.dataset.optIdx, 10);
          const res = window.StabilifeStorage.votePoll(post.id, optIdx);
          if (res && res.success) {
            if (window.showToast) window.showToast('Vote recorded!', 'success');
            this.renderFeed();
          } else if (res && res.error) {
            if (window.showToast) window.showToast('You already voted on this poll.', 'info');
          }
        });
      });

      // Like toggle
      const likeBtn = article.querySelector('.action-item.like');
      likeBtn.addEventListener('click', () => {
        const res = window.StabilifeStorage.toggleLike(post.id);
        if (res) {
          likeBtn.classList.toggle('active', res.liked);
          likeBtn.querySelector('.action-icon').textContent = res.liked ? '♥' : '♡';
          likeBtn.querySelector('.count').textContent = res.count;
          likeBtn.classList.add('pop-anim');
          setTimeout(() => likeBtn.classList.remove('pop-anim'), 300);
        }
      });

      // Retweet Button: opens choice to Repost OR Quote Post
      const retweetBtn = article.querySelector('.action-item.retweet');
      retweetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showRetweetMenu(retweetBtn, post);
      });

      // Comment / Reply Button
      article.querySelector('.action-item.comment-action').addEventListener('click', () => {
        this.openCommentModal(post);
      });

      // Share
      article.querySelector('.action-item.share-action').addEventListener('click', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(`${post.author.name} on Stabilife: "${post.text}"`);
        }
        if (window.showToast) window.showToast('Post link copied to clipboard!', 'info');
      });

      // Options Menu
      const optionsBtn = article.querySelector('.tweet-options-btn');
      optionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showPostMenu(optionsBtn, post, isOwnPost, isBookmarked);
      });

      return article;
    },

    showRetweetMenu(anchorEl, post) {
      let existingMenu = document.getElementById('retweet-popup-menu');
      if (existingMenu) existingMenu.remove();

      const userHandle = this.currentUser.handle;
      const isRetweeted = Array.isArray(post.retweets) && post.retweets.includes(userHandle);

      const menu = document.createElement('div');
      menu.id = 'retweet-popup-menu';
      menu.className = 'retweet-popup-menu';
      menu.innerHTML = `
        <button class="menu-item do-repost-btn">
          ${isRetweeted ? '↻ Undo Repost' : '↻ Repost'}
        </button>
        <button class="menu-item do-quote-btn">
          ✏️ Quote Post (Tweet about this)
        </button>
      `;

      document.body.appendChild(menu);
      const rect = anchorEl.getBoundingClientRect();
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.left = `${Math.max(10, rect.left - 40)}px`;

      const removeHandler = () => {
        menu.remove();
        document.removeEventListener('click', removeHandler);
      };
      setTimeout(() => document.addEventListener('click', removeHandler), 10);

      // Instant Repost
      menu.querySelector('.do-repost-btn')?.addEventListener('click', () => {
        menu.remove();
        const res = window.StabilifeStorage.toggleRetweet(post.id);
        if (res) {
          anchorEl.classList.toggle('active', res.retweeted);
          anchorEl.querySelector('.count').textContent = res.count;
          anchorEl.classList.add('pop-anim');
          setTimeout(() => anchorEl.classList.remove('pop-anim'), 300);
          if (window.showToast) {
            window.showToast(res.retweeted ? 'Post reposted to your network!' : 'Repost removed.', 'success');
          }
        }
      });

      // Quote Post
      menu.querySelector('.do-quote-btn')?.addEventListener('click', () => {
        menu.remove();
        this.openComposeModal(post);
      });
    },

    showPostMenu(anchorEl, post, isOwnPost, isBookmarked) {
      let existingMenu = document.getElementById('post-context-menu');
      if (existingMenu) existingMenu.remove();

      const menu = document.createElement('div');
      menu.id = 'post-context-menu';
      menu.className = 'post-dropdown-menu';

      menu.innerHTML = `
        <button class="menu-item quote-post-opt">✏️ Quote Post</button>
        <button class="menu-item reply-post-opt">💬 Post Reply</button>
        <button class="menu-item bookmark-btn">${isBookmarked ? '🔖 Remove Bookmark' : '🔖 Bookmark'}</button>
        ${isOwnPost ? '<button class="menu-item delete-post-btn" style="color:var(--danger)">🗑 Delete Post</button>' : `<button class="menu-item mute-user-btn">🔇 Mute ${post.author.handle}</button>`}
      `;

      document.body.appendChild(menu);
      const rect = anchorEl.getBoundingClientRect();
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.left = `${rect.right - 170}px`;

      const removeHandler = () => {
        menu.remove();
        document.removeEventListener('click', removeHandler);
      };
      setTimeout(() => document.addEventListener('click', removeHandler), 10);

      menu.querySelector('.quote-post-opt')?.addEventListener('click', () => {
        menu.remove();
        this.openComposeModal(post);
      });

      menu.querySelector('.reply-post-opt')?.addEventListener('click', () => {
        menu.remove();
        this.openCommentModal(post);
      });

      menu.querySelector('.delete-post-btn')?.addEventListener('click', () => {
        if (confirm('Delete this post?')) {
          window.StabilifeStorage.deletePost(post.id);
          if (window.showToast) window.showToast('Post deleted.', 'info');
          this.renderFeed();
        }
      });

      menu.querySelector('.bookmark-btn')?.addEventListener('click', () => {
        const res = window.StabilifeStorage.toggleBookmark(post.id);
        if (window.showToast) {
          window.showToast(res.isBookmarked ? 'Saved to Bookmarks!' : 'Removed from Bookmarks.', 'info');
        }
        if (this.currentTab === 'bookmarks') this.renderBookmarksView();
      });

      menu.querySelector('.mute-user-btn')?.addEventListener('click', () => {
        if (window.showToast) window.showToast(`Muted ${post.author.handle}.`, 'info');
      });
    },

    setupSearchAndTrending() {
      if (this.searchInput) {
        this.searchInput.addEventListener('input', (e) => {
          this.searchQuery = e.target.value;
          this.currentFilter = null;
          if (this.currentTab !== 'home') this.switchTab('home');
          this.renderFeed();
        });
      }

      const trendItems = document.querySelectorAll('.trend-item');
      trendItems.forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
          const trendName = item.querySelector('.trend-name')?.textContent.trim();
          if (trendName) {
            this.currentFilter = trendName;
            this.searchQuery = '';
            if (this.searchInput) this.searchInput.value = trendName;
            this.switchTab('home');
            this.renderFeed();
          }
        });
      });
    },

    renderFollowList() {
      const followContainer = document.querySelector('.follow-list');
      if (!followContainer) return;

      const suggestions = window.StabilifeStorage.getFollowSuggestions();
      followContainer.innerHTML = '';

      suggestions.forEach(item => {
        const div = document.createElement('div');
        div.className = 'follow-item';
        div.innerHTML = `
          <div class="avatar small" style="background: ${item.avatarGradient || '#1d9bf0'}">${item.avatar}</div>
          <div class="profile-meta">
            <strong>${item.name}</strong>
            <span>${item.handle}</span>
          </div>
          <button class="follow-btn ${item.isFollowing ? 'following' : ''}">
            ${item.isFollowing ? 'Following' : 'Follow'}
          </button>
        `;

        const btn = div.querySelector('.follow-btn');
        btn.addEventListener('click', () => {
          const res = window.StabilifeStorage.toggleFollow(item.handle);
          btn.classList.toggle('following', res.isFollowing);
          btn.textContent = res.isFollowing ? 'Following' : 'Follow';
          if (window.showToast) {
            window.showToast(
              res.isFollowing ? `Following ${item.name}` : `Unfollowed ${item.name}`,
              'info'
            );
          }
        });

        followContainer.appendChild(div);
      });
    },

    setupModals() {
      // 1. Comment / Reply Modal
      let commentModal = document.getElementById('comment-modal');
      if (!commentModal) {
        commentModal = document.createElement('div');
        commentModal.id = 'comment-modal';
        commentModal.className = 'modal-backdrop';
        commentModal.innerHTML = `
          <div class="modal-card">
            <div class="modal-head">
              <h3>Post Reply</h3>
              <button class="modal-close-btn" id="modal-close">✕</button>
            </div>
            <div class="modal-post-snippet" id="modal-post-snippet"></div>
            <div class="modal-comment-list" id="modal-comments-list"></div>
            <div class="modal-reply-box">
              <div class="avatar small" id="reply-user-avatar">AK</div>
              <input type="text" id="reply-input" placeholder="Post your reply to this post..." />
              <button class="post-btn" id="reply-submit-btn">Post Reply</button>
            </div>
          </div>
        `;
        document.body.appendChild(commentModal);

        commentModal.querySelector('#modal-close').addEventListener('click', () => {
          commentModal.classList.remove('open');
        });
        commentModal.addEventListener('click', (e) => {
          if (e.target === commentModal) commentModal.classList.remove('open');
        });
      }

      // 2. Floating Compose / Quote Modal
      let composeModal = document.getElementById('compose-post-modal');
      if (!composeModal) {
        composeModal = document.createElement('div');
        composeModal.id = 'compose-post-modal';
        composeModal.className = 'modal-backdrop';
        composeModal.innerHTML = `
          <div class="modal-card compose-modal-card">
            <div class="modal-head">
              <h3 id="compose-modal-title">New Post</h3>
              <button class="modal-close-btn" id="compose-modal-close">✕</button>
            </div>
            <div class="compose-modal-body">
              <div class="composer-row">
                <div class="avatar small" id="compose-modal-avatar">AK</div>
                <textarea id="compose-modal-textarea" placeholder="What's happening?" style="flex:1; min-height:110px; border:none; outline:none; resize:vertical; font-size:1.05rem; background:transparent; color:var(--text);"></textarea>
              </div>
              <div id="compose-modal-quoted" style="display:none;" class="modal-quoted-preview"></div>
              <div id="compose-modal-media-preview" class="media-preview-container" style="display:none; padding:0;"></div>
              <div class="composer-controls" style="padding-left: 0; margin-top: 14px; border-top: 1px solid var(--border); padding-top: 12px;">
                <div class="toolset">
                  <span id="modal-tool-img" title="Add Image (URL or Presets)" style="cursor:pointer;">◧</span>
                  <span id="modal-tool-emoji" title="Insert Emoji" style="cursor:pointer;">◎</span>
                  <span id="modal-tool-tag" title="Add Tag" style="cursor:pointer;">#</span>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                  <span id="modal-char-counter" class="char-counter">280</span>
                  <button class="post-btn" id="modal-post-submit-btn">Post</button>
                </div>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(composeModal);

        composeModal.querySelector('#compose-modal-close').addEventListener('click', () => {
          composeModal.classList.remove('open');
        });
        composeModal.addEventListener('click', (e) => {
          if (e.target === composeModal) composeModal.classList.remove('open');
        });

        // Setup modal tools & submission
        const modalTextarea = document.getElementById('compose-modal-textarea');
        const modalCharCount = document.getElementById('modal-char-counter');
        const modalPostBtn = document.getElementById('modal-post-submit-btn');

        modalTextarea.addEventListener('input', () => {
          modalTextarea.style.height = 'auto';
          modalTextarea.style.height = Math.max(110, modalTextarea.scrollHeight) + 'px';
          const rem = 280 - modalTextarea.value.length;
          modalCharCount.textContent = rem;
          modalCharCount.classList.toggle('over-limit', rem < 0);
          modalCharCount.classList.toggle('near-limit', rem <= 20 && rem >= 0);
        });

        document.getElementById('modal-tool-emoji')?.addEventListener('click', (e) => {
          this.toggleEmojiPicker(e, modalTextarea);
        });

        document.getElementById('modal-tool-tag')?.addEventListener('click', () => {
          modalTextarea.value += ' #Stabilife ';
          modalTextarea.dispatchEvent(new Event('input'));
          modalTextarea.focus();
        });

        document.getElementById('modal-tool-img')?.addEventListener('click', () => {
          const choice = prompt('Enter image URL or preset (1: Abstract Waves, 2: Modern Art):', '1');
          if (!choice) return;
          let url = choice.trim();
          if (url === '1') url = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80';
          else if (url === '2') url = 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1000&q=80';

          this.modalSelectedMediaUrl = url;
          const mediaPrev = document.getElementById('compose-modal-media-preview');
          mediaPrev.innerHTML = `
            <div class="preview-wrap">
              <img src="${url}" alt="Modal preview" />
              <button class="remove-media-btn" id="remove-modal-img">✕</button>
            </div>
          `;
          mediaPrev.style.display = 'block';
          document.getElementById('remove-modal-img')?.addEventListener('click', () => {
            this.modalSelectedMediaUrl = '';
            mediaPrev.style.display = 'none';
            mediaPrev.innerHTML = '';
          });
        });

        modalPostBtn.addEventListener('click', () => {
          const text = modalTextarea.value.trim();
          if (!text && !this.modalSelectedMediaUrl && !this.modalQuotedPost) {
            if (window.showToast) window.showToast('Please type your post to publish!', 'info');
            modalTextarea.focus();
            return;
          }

          let quoteData = null;
          if (this.modalQuotedPost) {
            quoteData = {
              id: this.modalQuotedPost.id,
              author: this.modalQuotedPost.author,
              text: this.modalQuotedPost.text,
              time: this.modalQuotedPost.time
            };
          }

          window.StabilifeStorage.addPost({
            text: text,
            mediaUrl: this.modalSelectedMediaUrl,
            quotePost: quoteData
          });

          modalTextarea.value = '';
          this.modalSelectedMediaUrl = '';
          this.modalQuotedPost = null;
          document.getElementById('compose-modal-media-preview').style.display = 'none';
          document.getElementById('compose-modal-quoted').style.display = 'none';
          composeModal.classList.remove('open');

          if (window.showToast) {
            window.showToast(quoteData ? 'Quote post published!' : 'Your post has been published!', 'success');
          }

          if (this.currentTab !== 'home') this.switchTab('home');
          else this.renderFeed();
        });
      }

      // 3. Edit Profile Modal
      let profileModal = document.getElementById('edit-profile-modal');
      if (!profileModal) {
        profileModal = document.createElement('div');
        profileModal.id = 'edit-profile-modal';
        profileModal.className = 'modal-backdrop';
        profileModal.innerHTML = `
          <div class="modal-card profile-edit-modal-card">
            <div class="modal-head">
              <h3>Edit Profile</h3>
              <button class="modal-close-btn" id="profile-modal-close">✕</button>
            </div>
            <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto;">
              <div class="form-group" style="margin:0;">
                <label>Display Name</label>
                <input id="edit-name-input" type="text" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid var(--border);" />
              </div>
              <div class="form-group" style="margin:0;">
                <label>Bio</label>
                <textarea id="edit-bio-input" style="width:100%; min-height:80px; padding:10px 14px; border-radius:10px; border:1px solid var(--border); font:inherit; resize:vertical;"></textarea>
              </div>
              <div class="form-group" style="margin:0;">
                <label>Location</label>
                <input id="edit-loc-input" type="text" placeholder="e.g. San Francisco, CA" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid var(--border);" />
              </div>
              <div class="form-group" style="margin:0;">
                <label>Avatar Color Theme</label>
                <div class="gradient-picker-row" id="gradient-picker">
                  <div class="gradient-swatch" data-gradient="linear-gradient(135deg, #7c3aed, #f43f5e)" style="background: linear-gradient(135deg, #7c3aed, #f43f5e)"></div>
                  <div class="gradient-swatch" data-gradient="linear-gradient(135deg, #1d9bf0, #38bdf8)" style="background: linear-gradient(135deg, #1d9bf0, #38bdf8)"></div>
                  <div class="gradient-swatch" data-gradient="linear-gradient(135deg, #10b981, #059669)" style="background: linear-gradient(135deg, #10b981, #059669)"></div>
                  <div class="gradient-swatch" data-gradient="linear-gradient(135deg, #f59e0b, #ef4444)" style="background: linear-gradient(135deg, #f59e0b, #ef4444)"></div>
                  <div class="gradient-swatch" data-gradient="linear-gradient(135deg, #8b5cf6, #d946ef)" style="background: linear-gradient(135deg, #8b5cf6, #d946ef)"></div>
                </div>
              </div>
              <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
                <button class="secondary-btn" id="cancel-profile-edit">Cancel</button>
                <button class="primary-btn" id="save-profile-edit">Save Changes</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(profileModal);

        profileModal.querySelector('#profile-modal-close').addEventListener('click', () => {
          profileModal.classList.remove('open');
        });
        profileModal.querySelector('#cancel-profile-edit').addEventListener('click', () => {
          profileModal.classList.remove('open');
        });
        profileModal.addEventListener('click', (e) => {
          if (e.target === profileModal) profileModal.classList.remove('open');
        });
      }
    },

    openComposeModal(quotedPost = null) {
      const modal = document.getElementById('compose-post-modal');
      const title = document.getElementById('compose-modal-title');
      const textarea = document.getElementById('compose-modal-textarea');
      const avatar = document.getElementById('compose-modal-avatar');
      const quotedPreview = document.getElementById('compose-modal-quoted');
      const submitBtn = document.getElementById('modal-post-submit-btn');

      if (!modal) return;

      if (avatar) {
        avatar.textContent = this.currentUser.avatar;
        avatar.style.background = this.currentUser.avatarGradient || '#1d9bf0';
      }

      this.modalQuotedPost = quotedPost;
      this.modalSelectedMediaUrl = '';
      document.getElementById('compose-modal-media-preview').style.display = 'none';

      if (quotedPost) {
        title.textContent = 'Quote Post';
        submitBtn.textContent = 'Post Quote';
        textarea.placeholder = 'Add a comment about this post...';
        quotedPreview.innerHTML = `
          <button class="remove-quote-btn" id="remove-quote-btn" title="Remove quote">✕</button>
          <div class="quoted-head">
            <span class="user-name">${quotedPost.author.name}</span>
            <span class="handle">${quotedPost.author.handle}</span>
            <span class="time">· ${quotedPost.time || 'earlier'}</span>
          </div>
          <p class="quoted-text">${quotedPost.text}</p>
        `;
        quotedPreview.style.display = 'block';

        document.getElementById('remove-quote-btn')?.addEventListener('click', () => {
          this.modalQuotedPost = null;
          quotedPreview.style.display = 'none';
          title.textContent = 'New Post';
          submitBtn.textContent = 'Post';
          textarea.placeholder = "What's happening?";
        });
      } else {
        title.textContent = 'New Post';
        submitBtn.textContent = 'Post';
        textarea.placeholder = "What's happening?";
        quotedPreview.style.display = 'none';
      }

      textarea.value = '';
      document.getElementById('modal-char-counter').textContent = '280';
      modal.classList.add('open');
      setTimeout(() => textarea.focus(), 150);
    },

    openCommentModal(post) {
      const modal = document.getElementById('comment-modal');
      const snippet = document.getElementById('modal-post-snippet');
      const list = document.getElementById('modal-comments-list');
      const replyInput = document.getElementById('reply-input');
      const replyBtn = document.getElementById('reply-submit-btn');
      const userAvatar = document.getElementById('reply-user-avatar');

      if (!modal) return;

      if (userAvatar) {
        userAvatar.textContent = this.currentUser.avatar;
        userAvatar.style.background = this.currentUser.avatarGradient || '#1d9bf0';
      }

      snippet.innerHTML = `
        <div class="avatar small" style="background: ${post.author.avatarGradient || '#1d9bf0'}">
          ${post.author.avatar}
        </div>
        <div>
          <div class="user-line">
            <span class="user-name">${post.author.name}</span>
            <span class="handle">${post.author.handle}</span>
            <span class="time">· ${post.time || 'now'}</span>
          </div>
          <p class="snippet-text">${post.text}</p>
        </div>
      `;

      const renderComments = () => {
        const currentPost = window.StabilifeStorage.getPosts().find(p => p.id === post.id);
        const comments = (currentPost && currentPost.comments) || [];

        if (comments.length === 0) {
          list.innerHTML = `<div class="no-comments">No replies yet. Be the first to post a reply!</div>`;
          return;
        }

        list.innerHTML = comments.map(c => `
          <div class="comment-item">
            <div class="avatar small" style="background: ${c.author.avatarGradient || '#7c3aed'}">${c.author.avatar}</div>
            <div class="comment-body">
              <div class="user-line">
                <span class="user-name">${c.author.name}</span>
                <span class="handle">${c.author.handle}</span>
                <span class="time">· ${c.time || 'now'}</span>
              </div>
              <p class="comment-text">${c.text}</p>
            </div>
          </div>
        `).join('');
      };

      renderComments();

      replyBtn.onclick = () => {
        const text = replyInput.value.trim();
        if (!text) {
          if (window.showToast) window.showToast('Please enter a reply to post!', 'info');
          replyInput.focus();
          return;
        }

        window.StabilifeStorage.addComment(post.id, text);
        replyInput.value = '';
        renderComments();
        this.renderFeed();
        if (window.showToast) window.showToast('Reply published!', 'success');
      };

      replyInput.onkeydown = (e) => {
        if (e.key === 'Enter') replyBtn.click();
      };

      modal.classList.add('open');
      setTimeout(() => replyInput.focus(), 150);
    },

    openEditProfileModal() {
      const modal = document.getElementById('edit-profile-modal');
      const nameInp = document.getElementById('edit-name-input');
      const bioInp = document.getElementById('edit-bio-input');
      const locInp = document.getElementById('edit-loc-input');
      const saveBtn = document.getElementById('save-profile-edit');
      const swatches = document.querySelectorAll('.gradient-swatch');

      if (!modal) return;

      let selectedGrad = this.currentUser.avatarGradient || 'linear-gradient(135deg, #7c3aed, #f43f5e)';

      nameInp.value = this.currentUser.name || '';
      bioInp.value = this.currentUser.bio || '';
      locInp.value = this.currentUser.location || 'San Francisco, CA';

      swatches.forEach(sw => {
        sw.classList.toggle('selected', sw.dataset.gradient === selectedGrad);
        sw.onclick = () => {
          swatches.forEach(s => s.classList.remove('selected'));
          sw.classList.add('selected');
          selectedGrad = sw.dataset.gradient;
        };
      });

      saveBtn.onclick = () => {
        const newName = nameInp.value.trim() || this.currentUser.name;
        const newBio = bioInp.value.trim();
        const newLoc = locInp.value.trim();

        const updated = window.StabilifeStorage.updateUserProfile({
          name: newName,
          bio: newBio,
          location: newLoc,
          avatarGradient: selectedGrad
        });

        this.currentUser = updated;
        this.renderUserProfile();
        modal.classList.remove('open');
        if (window.showToast) window.showToast('Profile updated!', 'success');
        this.renderProfileView();
      };

      modal.classList.add('open');
    },

    // VIEWS
    renderBookmarksView() {
      const bookmarkIds = window.StabilifeStorage.getBookmarks();
      const allPosts = window.StabilifeStorage.getPosts();
      const bookmarkedPosts = allPosts.filter(p => bookmarkIds.includes(p.id));

      this.feedContainer.innerHTML = `
        <div class="notif-header">
          <h2>Your Bookmarks (${bookmarkedPosts.length})</h2>
          <p style="margin:4px 0 0; color:var(--muted); font-size:0.88rem;">Posts you saved for later</p>
        </div>
      `;

      if (bookmarkedPosts.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-feed-state';
        emptyState.innerHTML = `
          <div class="empty-icon">🔖</div>
          <h3>No bookmarks saved</h3>
          <p>Click the ••• options button on any post and select "Bookmark" to collect posts here!</p>
        `;
        this.feedContainer.appendChild(emptyState);
        return;
      }

      bookmarkedPosts.forEach(post => {
        const el = this.createPostElement(post);
        this.feedContainer.appendChild(el);
      });
    },

    renderExploreView() {
      this.feedContainer.innerHTML = `
        <div class="explore-hero">
          <h2>Trending Topics & Conversations</h2>
          <p>See what everyone in technology, design, and product is talking about right now.</p>
        </div>
        <div class="explore-grid">
          <div class="explore-card" data-tag="#Frontend">
            <span class="explore-badge">Trending in Tech</span>
            <h3>#Frontend</h3>
            <p>18,204 discussions · React, Vue, CSS Glassmorphism</p>
          </div>
          <div class="explore-card" data-tag="#UIUX">
            <span class="explore-badge">Trending in Design</span>
            <h3>#UIUX</h3>
            <p>9,410 discussions · Micro-interactions & design systems</p>
          </div>
          <div class="explore-card" data-tag="#Product">
            <span class="explore-badge">Trending in Business</span>
            <h3>#Product</h3>
            <p>23,718 discussions · Rapid prototyping and startups</p>
          </div>
          <div class="explore-card" data-tag="#Stabilife">
            <span class="explore-badge">Community Spotlight</span>
            <h3>#Stabilife</h3>
            <p>1,450 discussions · New community members and ideas</p>
          </div>
        </div>
      `;

      this.feedContainer.querySelectorAll('.explore-card').forEach(card => {
        card.addEventListener('click', () => {
          this.currentFilter = card.dataset.tag;
          this.switchTab('home');
        });
      });
    },

    renderNotificationsView() {
      const notifs = window.StabilifeStorage.getNotifications();
      this.feedContainer.innerHTML = `
        <div class="notif-header">
          <h2>Activity & Alerts</h2>
        </div>
        <div class="notif-list">
          ${notifs.map(n => `
            <div class="notif-item">
              <div class="notif-icon-bubble ${n.type}">${n.icon}</div>
              <div class="avatar small" style="background: ${n.user.avatarGradient || '#1d9bf0'}">${n.user.avatar}</div>
              <div class="notif-content">
                <strong>${n.user.name}</strong> <span>${n.text}</span>
                <div class="time">${n.time}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    },

    renderMessagesView() {
      const contacts = [
        { id: 'johndoe', name: 'John Doe', handle: '@johndoe', avatar: 'JD', grad: '#2563eb' },
        { id: 'mila', name: 'Mila Smith', handle: '@mila', avatar: 'MS', grad: '#ec4899' },
        { id: 'ariana', name: 'Ariana Reed', handle: '@ariana', avatar: 'AR', grad: '#8b5cf6' }
      ];

      const currentContact = contacts.find(c => c.id === this.activeChatContact) || contacts[0];
      const messages = this.chatHistories[currentContact.id] || [];

      this.feedContainer.innerHTML = `
        <div class="messages-container">
          <div class="messages-sidebar">
            <div class="messages-head"><h3>Chats</h3></div>
            <div class="chat-contact-list">
              ${contacts.map(c => `
                <div class="contact-item ${c.id === currentContact.id ? 'active' : ''}" data-contact-id="${c.id}">
                  <div class="avatar small" style="background: ${c.grad}">${c.avatar}</div>
                  <div class="contact-info">
                    <strong>${c.name}</strong>
                    <span class="preview-msg">${c.handle}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="messages-chatbox">
            <div class="chat-head">
              <strong>${currentContact.name}</strong>
              <span class="handle">${currentContact.handle}</span>
            </div>
            <div class="chat-messages" id="chat-messages-area">
              ${messages.map(m => `
                <div class="msg-bubble ${m.from === 'me' ? 'outgoing' : 'incoming'}">
                  <p>${m.text}</p>
                  <span class="time">${m.time}</span>
                </div>
              `).join('')}
            </div>
            <div class="chat-input-row">
              <input type="text" id="chat-type-input" placeholder="Type a message..." />
              <button class="post-btn" id="send-chat-btn">Send</button>
            </div>
          </div>
        </div>
      `;

      this.feedContainer.querySelectorAll('.contact-item').forEach(el => {
        el.addEventListener('click', () => {
          this.activeChatContact = el.dataset.contactId;
          this.renderMessagesView();
        });
      });

      const chatInput = document.getElementById('chat-type-input');
      const sendBtn = document.getElementById('send-chat-btn');
      const chatArea = document.getElementById('chat-messages-area');

      const sendMsg = () => {
        const text = chatInput.value.trim();
        if (!text) return;

        const newMsg = { from: 'me', text, time: 'Just now' };
        if (!this.chatHistories[currentContact.id]) this.chatHistories[currentContact.id] = [];
        this.chatHistories[currentContact.id].push(newMsg);

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble outgoing';
        bubble.innerHTML = `<p>${text}</p><span class="time">Just now</span>`;
        chatArea.appendChild(bubble);
        chatInput.value = '';
        chatArea.scrollTop = chatArea.scrollHeight;

        setTimeout(() => {
          const replies = [
            `Got your message! Stabilife feels incredibly snappy. 🚀`,
            `Awesome! Let me review this and get right back to you.`,
            `Love the design and smooth animations on this feed! ✨`
          ];
          const randomReply = replies[Math.floor(Math.random() * replies.length)];
          const replyMsg = { from: 'them', text: randomReply, time: 'Just now' };
          this.chatHistories[currentContact.id].push(replyMsg);

          const replyBubble = document.createElement('div');
          replyBubble.className = 'msg-bubble incoming';
          replyBubble.innerHTML = `<p>${randomReply}</p><span class="time">Just now</span>`;
          chatArea.appendChild(replyBubble);
          chatArea.scrollTop = chatArea.scrollHeight;
        }, 800);
      };

      sendBtn.addEventListener('click', sendMsg);
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMsg();
      });
    },

    renderProfileView() {
      const user = this.currentUser;
      const allPosts = window.StabilifeStorage.getPosts();
      const userPosts = allPosts.filter(p => p.author.handle === user.handle);

      this.feedContainer.innerHTML = `
        <div class="profile-header-card">
          <div class="profile-cover"></div>
          <div class="profile-details-row">
            <div class="avatar profile-large" style="background: ${user.avatarGradient || '#1d9bf0'}">
              ${user.avatar}
            </div>
            <button class="secondary-btn edit-profile-btn" id="edit-profile-btn">Edit Profile</button>
          </div>
          <div class="profile-info-text">
            <h2>${user.name}</h2>
            <div class="muted-handle">${user.handle}</div>
            <p class="profile-bio">${user.bio || 'Exploring ideas and connecting on Stabilife.'}</p>
            <div class="profile-meta-row">
              <span>📍 ${user.location || 'San Francisco, CA'}</span>
              <span>📅 Joined ${user.joined || 'September 2026'}</span>
            </div>
            <div class="profile-counts">
              <span><strong>${user.followingCount || 89}</strong> Following</span>
              <span><strong>${user.followersCount || 142}</strong> Followers</span>
              <span><strong>${userPosts.length}</strong> Posts</span>
            </div>
          </div>
        </div>
        <div class="profile-tabs">
          <div class="profile-tab active">Posts (${userPosts.length})</div>
          <div class="profile-tab">Replies</div>
          <div class="profile-tab">Likes</div>
        </div>
        <div class="profile-posts-list"></div>
      `;

      const postsContainer = this.feedContainer.querySelector('.profile-posts-list');
      if (userPosts.length === 0) {
        postsContainer.innerHTML = `
          <div class="empty-feed-state">
            <div class="empty-icon">✍️</div>
            <h3>No posts yet</h3>
            <p>You haven't posted any updates yet. Share your thoughts with your network!</p>
          </div>
        `;
      } else {
        userPosts.forEach(post => {
          const el = this.createPostElement(post);
          postsContainer.appendChild(el);
        });
      }

      document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
        this.openEditProfileModal();
      });
    },

    renderMoreView() {
      this.feedContainer.innerHTML = `
        <div class="more-settings-card">
          <h2>Application Settings</h2>
          <div class="settings-group">
            <h3>Theme & Appearance</h3>
            <p>Choose your preferred interface theme.</p>
            <button class="secondary-btn" id="settings-theme-toggle">
              ${window.StabilifeStorage.getTheme() === 'dark' ? '☀️ Switch to Light Theme' : '🌙 Switch to Dark Theme'}
            </button>
          </div>
          <div class="settings-group">
            <h3>Storage & Data</h3>
            <p>Reset local data back to the original demo seed data.</p>
            <button class="secondary-btn" id="reset-data-btn">↺ Reset Demo Data to Default</button>
          </div>
          <div class="settings-group">
            <h3>Active Account</h3>
            <p>Signed in as <strong>${this.currentUser.name}</strong> (${this.currentUser.email})</p>
            <button class="primary-btn" id="settings-logout-btn">Log Out</button>
          </div>
        </div>
      `;

      document.getElementById('settings-theme-toggle')?.addEventListener('click', () => {
        const newTheme = window.StabilifeStorage.toggleTheme();
        if (this.themeToggleBtn) this.themeToggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        this.renderMoreView();
      });

      document.getElementById('reset-data-btn')?.addEventListener('click', () => {
        if (confirm('Reset all posts, users, bookmarks, and follows back to initial demo state?')) {
          localStorage.clear();
          window.location.reload();
        }
      });

      document.getElementById('settings-logout-btn')?.addEventListener('click', () => {
        if (window.StabilifeAuth) window.StabilifeAuth.logout();
      });
    }
  };

  App.init();
  window.StabilifeApp = App;
});
