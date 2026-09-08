// ============================================
// WATCHMORE - Utilities
// ============================================

const CONFIG = {
    TMDB_API_KEY: 'becc030248ec01bad5e0a45c4239fac3',
    TMDB_BASE_URL: 'https://api.themoviedb.org/3',
    TMDB_IMAGE_BASE: 'https://image.tmdb.org/t/p',
    FIREBASE_CONFIG: {
        apiKey: "YOUR_FIREBASE_API_KEY",
        authDomain: "your-project.firebaseapp.com",
        projectId: "your-project",
        storageBucket: "your-project.appspot.com",
        messagingSenderId: "123456789",
        appId: "1:123456789:web:abcdef"
    }
};

const GENRE_MAP = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
    99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
    27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
    10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
    10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
    10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

const AppState = {
    currentPage: 'home',
    currentContentType: 'movie',
    currentFilter: 'discover',
    currentDetail: null,
    currentUser: null,
    watchlist: JSON.parse(localStorage.getItem('watchmore_watchlist') || '[]'),
    authMode: 'signin',
    discoverPage: 1,
    tvPage: 1,
    tvFilter: 'popular',
    searchQuery: '',
    featuredMovies: [],
    currentHeroIndex: 0,
    heroInterval: null,
    apiError: false,

    setPage(page) { this.currentPage = page; },
    setContentType(type) { this.currentContentType = type; },
    setFilter(filter) { this.currentFilter = filter; },
    setTVFilter(filter) { this.tvFilter = filter; this.tvPage = 1; },
    setDetail(id, type) { this.currentDetail = { id, type }; },

    addToWatchlist(item) {
        const exists = this.watchlist.some(w => w.id === item.id && w.type === item.type);
        if (!exists) {
            this.watchlist.push({ ...item, saved_date: new Date().toISOString() });
            this.saveWatchlist();
            return true;
        }
        return false;
    },

    removeFromWatchlist(id, type) {
        const index = this.watchlist.findIndex(w => w.id === id && w.type === type);
        if (index > -1) {
            this.watchlist.splice(index, 1);
            this.saveWatchlist();
            return true;
        }
        return false;
    },

    isInWatchlist(id, type) {
        return this.watchlist.some(w => w.id === id && w.type === type);
    },

    saveWatchlist() {
        localStorage.setItem('watchmore_watchlist', JSON.stringify(this.watchlist));
        if (this.currentUser && typeof firebase !== 'undefined') {
            firebase.firestore().collection('users').doc(this.currentUser.uid)
                .set({ watchlist: this.watchlist }, { merge: true })
                .catch(() => {});
        }
    },

    async loadWatchlistFromFirebase() {
        if (!this.currentUser || typeof firebase === 'undefined') return;
        try {
            const doc = await firebase.firestore().collection('users').doc(this.currentUser.uid).get();
            if (doc.exists && doc.data().watchlist) {
                this.watchlist = doc.data().watchlist;
                localStorage.setItem('watchmore_watchlist', JSON.stringify(this.watchlist));
            }
        } catch (e) {
            console.log('Could not load from Firebase');
        }
    }
};

const TMDB = {
    async fetch(endpoint, params = {}) {
        const queryParams = new URLSearchParams({ 
            ...params, 
            api_key: CONFIG.TMDB_API_KEY,
            language: 'en-US' 
        });
        const url = `${CONFIG.TMDB_BASE_URL}${endpoint}?${queryParams}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HTTP ${response.status}: ${errorData.status_message || 'Unknown error'}`);
            }

            const data = await response.json();
            AppState.apiError = false;
            return data;

        } catch (error) {
            console.error('TMDB Error:', error);
            AppState.apiError = true;

            if (error.message.includes('401')) {
                UI.showToast('Invalid API key. Please get your own at themoviedb.org/settings/api', 'error', 6000);
            } else if (error.message.includes('429')) {
                UI.showToast('Rate limit exceeded. Please wait a moment.', 'warning', 4000);
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                UI.showToast('Network error. Check your internet connection.', 'error', 5000);
            } else {
                UI.showToast('Failed to load: ' + error.message, 'error', 5000);
            }
            return null;
        }
    },

    image(path, size = 'w500') {
        if (!path) {
            return `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect fill="%231a1a28" width="200" height="300"/><text fill="%235a5a72" x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="14">No Image</text></svg>')}`;
        }
        return `${CONFIG.TMDB_IMAGE_BASE}/${size}${path}`;
    },

    backdrop(path) {
        return this.image(path, 'original');
    }
};

const UI = {
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };

        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <div class="toast-content">
                <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('removing');
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    },

    showModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    hideModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    showLoading(containerId, count = 6) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = Array(count).fill(0).map(() => `
            <div class="movie-card">
                <div class="skeleton skeleton-poster"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text short"></div>
            </div>
        `).join('');
    },

    showSpinner(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = `
            <div class="loading-center">
                <div class="spinner"></div>
                <p>Loading...</p>
            </div>
        `;
    },

    formatNumber(num) {
        if (!num) return '0';
        if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toString();
    },

    formatCurrency(num) {
        if (!num || num === 0) return '-';
        return '$' + this.formatNumber(num);
    },

    formatRuntime(minutes) {
        if (!minutes) return '-';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    },

    formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    },

    getGenreName(id) {
        return GENRE_MAP[id] || 'Movie';
    },

    getYear(dateStr) {
        return dateStr ? dateStr.split('-')[0] : 'N/A';
    },

    debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
    },

    setImageFallback(img, type = 'poster') {
        const svg = type === 'poster' 
            ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect fill="%231a1a28" width="200" height="300"/><text fill="%235a5a72" x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="14">No Image</text></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140"><circle cx="70" cy="70" r="70" fill="%231a1a28"/><text fill="%235a5a72" x="70" y="75" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold">?</text></svg>`;
        img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
};

const ThemeManager = {
    init() {
        const saved = localStorage.getItem('watchmore_theme') || 'dark';
        this.set(saved);
    },

    set(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('watchmore_theme', theme);
        this.updateIcons(theme);
    },

    toggle() {
        const current = document.body.getAttribute('data-theme');
        this.set(current === 'dark' ? 'light' : 'dark');
    },

    updateIcons(theme) {
        const icon = theme === 'dark' ? 'fa-moon' : 'fa-sun';
        document.querySelectorAll('[id^="theme-icon"], [id^="mobile-theme-icon"], [id^="top-theme-icon"]').forEach(el => {
            el.className = `fas ${icon}`;
        });
    }
};

const FirebaseManager = {
    initialized: false,

    init() {
        try {
            if (typeof firebase === 'undefined') {
                console.log('Firebase SDK not loaded');
                return;
            }
            if (firebase.apps.length === 0) {
                firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
            }
            this.initialized = true;

            firebase.auth().onAuthStateChanged(user => {
                AppState.currentUser = user;
                AuthManager.updateUI();
                if (user) {
                    AppState.loadWatchlistFromFirebase();
                    UI.showToast(`Welcome back!`, 'success');
                }
            });
        } catch (e) {
            console.log('Firebase not available:', e.message);
        }
    },

    async signIn(email, password) {
        if (!this.initialized) throw new Error('Firebase not initialized');
        return await firebase.auth().signInWithEmailAndPassword(email, password);
    },

    async signUp(email, password) {
        if (!this.initialized) throw new Error('Firebase not initialized');
        return await firebase.auth().createUserWithEmailAndPassword(email, password);
    },

    async signOut() {
        if (!this.initialized) return;
        await firebase.auth().signOut();
    }
};

const AuthManager = {
    mode: 'signin',

    show() {
        if (AppState.currentUser) {
            if (confirm('Sign out of your account?')) {
                FirebaseManager.signOut().then(() => {
                    UI.showToast('Signed out successfully', 'info');
                });
            }
            return;
        }
        this.setMode('signin');
        UI.showModal('auth-modal');
    },

    hide() {
        UI.hideModal('auth-modal');
    },

    setMode(mode) {
        this.mode = mode;
        const isSignIn = mode === 'signin';

        const title = document.getElementById('auth-title');
        const subtitle = document.getElementById('auth-subtitle');
        const btn = document.getElementById('auth-btn');
        const footerText = document.getElementById('auth-footer-text');
        const toggle = document.getElementById('auth-toggle');

        if (title) title.textContent = isSignIn ? 'Welcome Back' : 'Create Account';
        if (subtitle) subtitle.textContent = isSignIn ? 'Sign in to access your library' : 'Join WatchMore today';
        if (btn) btn.innerHTML = isSignIn ? '<i class="fas fa-sign-in-alt"></i> Sign In' : '<i class="fas fa-user-plus"></i> Sign Up';
        if (footerText) footerText.textContent = isSignIn ? "Don't have an account?" : 'Already have an account?';
        if (toggle) toggle.textContent = isSignIn ? 'Sign Up' : 'Sign In';
    },

    toggleMode() {
        this.setMode(this.mode === 'signin' ? 'signup' : 'signin');
    },

    async handleSubmit(e) {
        e.preventDefault();
        const email = document.getElementById('auth-email');
        const password = document.getElementById('auth-password');

        if (!email || !password) return;

        if (!FirebaseManager.initialized) {
            UI.showToast('Please configure Firebase first', 'error');
            return;
        }

        try {
            if (this.mode === 'signin') {
                await FirebaseManager.signIn(email.value, password.value);
                UI.showToast('Welcome back!', 'success');
            } else {
                await FirebaseManager.signUp(email.value, password.value);
                UI.showToast('Account created successfully!', 'success');
            }
            this.hide();
        } catch (error) {
            UI.showToast(error.message, 'error');
        }
    },

    updateUI() {
        const loginBtn = document.getElementById('login-btn');
        const mobileLoginBtn = document.getElementById('mobile-login-btn');
        const userAvatar = document.getElementById('user-avatar');
        const mobileUserAvatar = document.getElementById('mobile-user-avatar');
        const userInitial = document.getElementById('user-initial');
        const mobileUserInitial = document.getElementById('mobile-user-initial');

        if (AppState.currentUser) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
            if (userAvatar) userAvatar.style.display = 'flex';
            if (mobileUserAvatar) mobileUserAvatar.style.display = 'flex';
            const initial = (AppState.currentUser.displayName || AppState.currentUser.email || 'U').charAt(0).toUpperCase();
            if (userInitial) userInitial.textContent = initial;
            if (mobileUserInitial) mobileUserInitial.textContent = initial;
        } else {
            if (loginBtn) loginBtn.style.display = 'flex';
            if (mobileLoginBtn) mobileLoginBtn.style.display = 'flex';
            if (userAvatar) userAvatar.style.display = 'none';
            if (mobileUserAvatar) mobileUserAvatar.style.display = 'none';
        }
    }
};

// ============================================
// FIXED PLAYER - Multiple working embed sources using TMDB IDs
// ============================================
const PlayerManager = {
    currentId: null,
    currentType: null,
    currentTitle: '',
    currentSeason: null,
    currentEpisode: null,
    sourceIndex: 0,

    // Working embed sources that accept TMDB IDs directly
    sources: [
        { 
            name: 'StreamSrc', 
            movie: (id) => `https://streamsrc.cc/watch/movie/tmdbid=${id}`,
            tv: (id, s, e) => `https://streamsrc.cc/watch/series/tmdbid=${id}&season=${s}&episode=${e}`
        },
        { 
            name: 'Embed.su', 
            movie: (id) => `https://embed.su/embed/movie/${id}`,
            tv: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`
        },
        { 
            name: 'VidBinge', 
            movie: (id) => `https://vidbinge.to/movie/${id}`,
            tv: (id, s, e) => `https://vidbinge.to/tv/${id}/${s}/${e}`
        },
        { 
            name: 'VidLink', 
            movie: (id) => `https://vidlink.pro/movie/${id}`,
            tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`
        },
        { 
            name: 'MultiEmbed', 
            movie: (id) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`,
            tv: (id, s, e) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${s}&e=${e}`
        },
        { 
            name: '2Embed', 
            movie: (id) => `https://www.2embed.cc/embed/${id}`,
            tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`
        }
    ],

    getUrl(index, id, type, season, episode) {
        const source = this.sources[index];
        if (!source) return null;
        if (season && episode) {
            return source.tv(id, season, episode);
        }
        return source.movie(id);
    },

    open(id, type = 'movie', title = '', season = null, episode = null) {
        this.currentId = id;
        this.currentType = type;
        this.currentTitle = title;
        this.currentSeason = season;
        this.currentEpisode = episode;
        this.sourceIndex = 0;

        const src = this.getUrl(0, id, type, season, episode);
        if (!src) {
            UI.showToast('No video sources available', 'error');
            return;
        }

        const iframe = document.getElementById('player-iframe');
        const titleEl = document.getElementById('player-title');
        const infoEl = document.getElementById('player-info-text');

        if (iframe) {
            iframe.src = src;
            // Reset error handler
            iframe.onerror = null;
            // Set up load timeout to detect if source fails
            setTimeout(() => {
                try {
                    // Try to check if iframe loaded content
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (!iframeDoc || iframeDoc.body.innerHTML === '') {
                        // Might be blocked, try next source
                        console.log('Source may be blocked, will try fallback on next play');
                    }
                } catch (e) {
                    // Cross-origin, can't check - assume it loaded
                }
            }, 3000);
        }
        if (titleEl) titleEl.textContent = title || 'Now Playing';
        if (infoEl) {
            const info = season ? `S${season} E${episode}` : (type === 'tv' ? 'TV Show' : 'Movie');
            infoEl.textContent = info;
        }

        UI.showModal('player-modal');

        // Request fullscreen on mobile for better experience
        if (window.innerWidth <= 768) {
            setTimeout(() => this.toggleFullscreen(), 800);
        }
    },

    switchSource() {
        this.sourceIndex++;

        if (this.sourceIndex < this.sources.length) {
            const iframe = document.getElementById('player-iframe');
            if (iframe) {
                const src = this.getUrl(
                    this.sourceIndex, 
                    this.currentId, 
                    this.currentType, 
                    this.currentSeason, 
                    this.currentEpisode
                );
                if (src) {
                    iframe.src = src;
                    UI.showToast(`Switched to ${this.sources[this.sourceIndex].name}`, 'info', 2000);
                }
            }
        } else {
            this.sourceIndex = 0;
            UI.showToast('All sources tried. Please try again later.', 'error', 5000);
        }
    },

    close() {
        UI.hideModal('player-modal');
        const iframe = document.getElementById('player-iframe');
        if (iframe) {
            iframe.src = '';
            iframe.onerror = null;
        }
    },

    toggleFullscreen() {
        const container = document.querySelector('.player-container');
        if (!container) return;

        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen().catch(() => {});
        }
    }
};

const SeasonManager = {
    show(seasonNumber, seasonData, tvId, tvTitle) {
        const modal = document.getElementById('season-modal');
        const title = document.getElementById('season-title');
        const list = document.getElementById('episodes-list');

        if (title) title.textContent = `Season ${seasonNumber}`;

        if (list && seasonData.episodes) {
            list.innerHTML = seasonData.episodes.map((ep, i) => `
                <div class="episode-item" onclick="PlayerManager.open(${tvId}, 'tv', '${tvTitle.replace(/'/g, "\'")}', ${seasonNumber}, ${ep.episode_number})">
                    <div class="episode-number">${ep.episode_number}</div>
                    <div class="episode-info">
                        <h4>${ep.name || `Episode ${ep.episode_number}`}</h4>
                        <p>${ep.overview ? ep.overview.substring(0, 80) + '...' : 'No description'}</p>
                    </div>
                    <button class="episode-play"><i class="fas fa-play"></i></button>
                </div>
            `).join('');
        }

        UI.showModal('season-modal');
    },

    hide() {
        UI.hideModal('season-modal');
    }
};

window.CONFIG = CONFIG;
window.AppState = AppState;
window.TMDB = TMDB;
window.UI = UI;
window.ThemeManager = ThemeManager;
window.FirebaseManager = FirebaseManager;
window.AuthManager = AuthManager;
window.PlayerManager = PlayerManager;
window.SeasonManager = SeasonManager;
