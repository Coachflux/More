// ============================================
// WATCHMORE - Utilities (PRODUCTION VERSION)
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
    },
    REPORT_EMAIL: 'watchmore.support@example.com'
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
// ENHANCED PLAYER - 15 Sources + Sandbox (Blocks Redirects)
// ============================================
const PlayerManager = {
    currentId: null,
    currentType: null,
    currentTitle: '',
    currentSeason: null,
    currentEpisode: null,
    sourceIndex: 0,
    isLoading: false,
    loadTimeout: null,

    sources: [
        { name: '2Embed', movie: (id) => `https://www.2embed.cc/embed/${id}`, tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}` },
        { name: 'VidLink', movie: (id) => `https://vidlink.pro/movie/${id}`, tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}` },
        { name: 'Embed.su', movie: (id) => `https://embed.su/embed/movie/${id}`, tv: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}` },
        { name: 'AutoEmbed', movie: (id) => `https://autoembed.co/movie/tmdb/${id}`, tv: (id, s, e) => `https://autoembed.co/tv/tmdb/${id}-${s}-${e}` },
        { name: 'MultiEmbed', movie: (id) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`, tv: (id, s, e) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${s}&e=${e}` },
        { name: 'VidSrc.me', movie: (id) => `https://vidsrc.me/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.me/embed/tv/${id}/${s}-${e}` },
        { name: 'VidSrc.cc', movie: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}` },
        { name: 'VidSrc.to', movie: (id) => `https://vidsrc.to/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
        { name: 'VidSrc.xyz', movie: (id) => `https://vidsrc.xyz/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}-${e}` },
        { name: 'VidSrc.net', movie: (id) => `https://vidsrc.net/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.net/embed/tv/${id}/${s}/${e}` },
        { name: 'VidSrc.in', movie: (id) => `https://vidsrc.in/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.in/embed/tv/${id}/${s}/${e}` },
        { name: 'VidSrc.pm', movie: (id) => `https://vidsrc.pm/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.pm/embed/tv/${id}/${s}/${e}` },
        { name: 'VidSrc.icu', movie: (id) => `https://vidsrc.icu/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.icu/embed/tv/${id}/${s}/${e}` },
        { name: 'VidSrc.dev', movie: (id) => `https://vidsrc.dev/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.dev/embed/tv/${id}/${s}/${e}` },
        { name: 'SuperEmbed', movie: (id) => `https://multiembed.mov/?tmdb=1&video_id=${id}`, tv: (id, s, e) => `https://multiembed.mov/?tmdb=1&video_id=${id}&s=${s}&e=${e}` }
    ],

    getUrl(index, id, type, season, episode) {
        const source = this.sources[index];
        if (!source) return null;
        if (season && episode) return source.tv(id, season, episode);
        return source.movie(id);
    },

    open(id, type = 'movie', title = '', season = null, episode = null) {
        this.currentId = id;
        this.currentType = type;
        this.currentTitle = title;
        this.currentSeason = season;
        this.currentEpisode = episode;
        this.sourceIndex = 0;
        this.isLoading = true;

        const src = this.getUrl(0, id, type, season, episode);
        if (!src) {
            UI.showToast('No video sources available', 'error');
            return;
        }

        const iframe = document.getElementById('player-iframe');
        const titleEl = document.getElementById('player-title');
        const infoEl = document.getElementById('player-info-text');
        const statusEl = document.getElementById('player-status');
        const sourceNameEl = document.getElementById('player-source-name');
        const sourceCounterEl = document.getElementById('player-source-counter');

        if (iframe) {
            // CRITICAL: Sandbox attributes block redirects/popups while allowing video
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-autoplay');
            iframe.setAttribute('referrerpolicy', 'no-referrer');
            iframe.setAttribute('loading', 'eager');
            iframe.src = src;

            iframe.onload = () => {
                this.isLoading = false;
                if (statusEl) {
                    statusEl.textContent = `Connected to ${this.sources[0].name}`;
                    statusEl.classList.add('visible');
                    setTimeout(() => statusEl.classList.remove('visible'), 3000);
                }
            };
            iframe.onerror = () => { this.handleSourceError(); };
        }

        if (titleEl) titleEl.textContent = title || 'Now Playing';
        if (infoEl) {
            const info = season ? `S${season} E${episode}` : (type === 'tv' ? 'TV Show' : 'Movie');
            infoEl.textContent = info;
        }
        if (sourceNameEl) sourceNameEl.textContent = this.sources[0].name;
        if (sourceCounterEl) sourceCounterEl.textContent = `1 / ${this.sources.length}`;
        if (statusEl) {
            statusEl.textContent = `Connecting to ${this.sources[0].name}...`;
            statusEl.classList.add('visible');
        }

        this.clearLoadTimeout();
        this.loadTimeout = setTimeout(() => {
            if (this.isLoading) this.handleSourceError();
        }, 8000);

        UI.showModal('player-modal');

        if (window.innerWidth <= 768) {
            setTimeout(() => this.toggleFullscreen(), 800);
        }
    },

    handleSourceError() {
        this.isLoading = false;
        this.clearLoadTimeout();
        const statusEl = document.getElementById('player-status');
        if (statusEl) {
            statusEl.textContent = `Source failed. Trying next...`;
            statusEl.classList.add('visible');
        }
        this.switchSource();
    },

    clearLoadTimeout() {
        if (this.loadTimeout) { clearTimeout(this.loadTimeout); this.loadTimeout = null; }
    },

    switchSource() {
        this.sourceIndex++;
        this.isLoading = true;

        if (this.sourceIndex < this.sources.length) {
            const iframe = document.getElementById('player-iframe');
            const statusEl = document.getElementById('player-status');
            const sourceNameEl = document.getElementById('player-source-name');
            const sourceCounterEl = document.getElementById('player-source-counter');

            if (iframe) {
                const src = this.getUrl(this.sourceIndex, this.currentId, this.currentType, this.currentSeason, this.currentEpisode);
                if (src) {
                    iframe.src = src;
                    iframe.onload = () => {
                        this.isLoading = false;
                        if (statusEl) {
                            statusEl.textContent = `Connected to ${this.sources[this.sourceIndex].name}`;
                            statusEl.classList.add('visible');
                            setTimeout(() => statusEl.classList.remove('visible'), 3000);
                        }
                    };
                    iframe.onerror = () => { this.handleSourceError(); };

                    const sourceName = this.sources[this.sourceIndex].name;
                    UI.showToast(`Switched to ${sourceName}`, 'info', 2000);
                    if (sourceNameEl) sourceNameEl.textContent = sourceName;
                    if (sourceCounterEl) sourceCounterEl.textContent = `${this.sourceIndex + 1} / ${this.sources.length}`;
                    if (statusEl) {
                        statusEl.textContent = `Connecting to ${sourceName}...`;
                        statusEl.classList.add('visible');
                    }

                    this.clearLoadTimeout();
                    this.loadTimeout = setTimeout(() => {
                        if (this.isLoading) this.handleSourceError();
                    }, 8000);
                }
            }
        } else {
            this.sourceIndex = 0;
            this.isLoading = false;
            this.clearLoadTimeout();
            UI.showToast('All sources tried. Please try again later.', 'error', 5000);
            if (statusEl) {
                statusEl.textContent = 'All sources unavailable';
                statusEl.classList.add('visible');
            }
        }
    },

    prevSource() {
        if (this.sourceIndex > 0) {
            this.sourceIndex--;
            this.isLoading = true;
            const iframe = document.getElementById('player-iframe');
            const statusEl = document.getElementById('player-status');
            const sourceNameEl = document.getElementById('player-source-name');
            const sourceCounterEl = document.getElementById('player-source-counter');

            if (iframe) {
                const src = this.getUrl(this.sourceIndex, this.currentId, this.currentType, this.currentSeason, this.currentEpisode);
                if (src) {
                    iframe.src = src;
                    iframe.onload = () => {
                        this.isLoading = false;
                        if (statusEl) {
                            statusEl.textContent = `Connected to ${this.sources[this.sourceIndex].name}`;
                            statusEl.classList.add('visible');
                            setTimeout(() => statusEl.classList.remove('visible'), 3000);
                        }
                    };
                    const sourceName = this.sources[this.sourceIndex].name;
                    UI.showToast(`Switched to ${sourceName}`, 'info', 2000);
                    if (sourceNameEl) sourceNameEl.textContent = sourceName;
                    if (sourceCounterEl) sourceCounterEl.textContent = `${this.sourceIndex + 1} / ${this.sources.length}`;
                    if (statusEl) {
                        statusEl.textContent = `Connecting to ${sourceName}...`;
                        statusEl.classList.add('visible');
                    }
                    this.clearLoadTimeout();
                    this.loadTimeout = setTimeout(() => {
                        if (this.isLoading) this.handleSourceError();
                    }, 8000);
                }
            }
        }
    },

    close() {
        this.clearLoadTimeout();
        this.isLoading = false;
        UI.hideModal('player-modal');
        const iframe = document.getElementById('player-iframe');
        if (iframe) {
            iframe.removeAttribute('sandbox');
            iframe.src = '';
            iframe.onload = null;
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
            list.innerHTML = seasonData.episodes.map((ep) => `
                <div class="episode-item" onclick="PlayerManager.open(${tvId}, 'tv', '${tvTitle.replace(/'/g, "\\'")}', ${seasonNumber}, ${ep.episode_number})">
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

// ============================================
// DOWNLOAD MANAGER - REAL DEVICE DOWNLOADS
// ============================================
const DownloadManager = {
    activeDownloads: new Map(),

    // Generate direct download URLs and torrent/magnet fallbacks
    getDownloadOptions(id, type, title, season, episode) {
        const safeTitle = encodeURIComponent(title || 'WatchMore_Download');
        const options = [];

        if (type === 'tv' && season && episode) {
            // TV Episode downloads
            options.push({
                name: 'Direct Stream DL',
                desc: 'Download episode via streaming server',
                url: `https://vidsrc.to/download/tv?tmdb=${id}&season=${season}&episode=${episode}`,
                type: 'direct',
                filename: `${safeTitle}_S${season}E${episode}.mp4`
            });
            options.push({
                name: 'Mirror Server 1',
                desc: 'Alternative download source',
                url: `https://www.2embed.cc/download/${id}`,
                type: 'direct',
                filename: `${safeTitle}_S${season}E${episode}.mp4`
            });
            options.push({
                name: 'Torrent Search',
                desc: 'Find torrents for this episode',
                url: `https://1337x.to/search/${safeTitle}+s${String(season).padStart(2,'0')}e${String(episode).padStart(2,'0')}/1/`,
                type: 'external',
                filename: null
            });
        } else {
            // Movie downloads
            options.push({
                name: 'Direct Stream DL',
                desc: 'Download movie via streaming server',
                url: `https://vidsrc.to/download/movie?tmdb=${id}`,
                type: 'direct',
                filename: `${safeTitle}.mp4`
            });
            options.push({
                name: 'Mirror Server 1',
                desc: 'Alternative download source',
                url: `https://www.2embed.cc/download/${id}`,
                type: 'direct',
                filename: `${safeTitle}.mp4`
            });
            options.push({
                name: 'Mirror Server 2',
                desc: 'High quality alternative',
                url: `https://multiembed.mov/download/?tmdb=1&video_id=${id}`,
                type: 'direct',
                filename: `${safeTitle}.mp4`
            });
            options.push({
                name: 'Torrent Search',
                desc: 'Find torrents for this movie',
                url: `https://1337x.to/search/${safeTitle}/1/`,
                type: 'external',
                filename: null
            });
        }

        // Always add YTS as movie torrent option
        if (type === 'movie') {
            options.push({
                name: 'YTS Torrents',
                desc: 'High quality movie torrents',
                url: `https://yts.mx/browse-movies/${safeTitle}/all/all/0/latest/0/all`,
                type: 'external',
                filename: null
            });
        }

        return options;
    },

    open(id, type = 'movie', title = '', season = null, episode = null) {
        const modal = document.getElementById('download-modal');
        const titleEl = document.getElementById('download-title');
        const linksEl = document.getElementById('download-links');

        const displayTitle = title || 'Download';
        if (titleEl) titleEl.textContent = displayTitle;

        const options = this.getDownloadOptions(id, type, title, season, episode);

        if (linksEl) {
            let html = '';

            options.forEach((opt, idx) => {
                const isPrimary = idx === 0;
                const icon = opt.type === 'direct' ? 'fa-download' : 'fa-magnet';
                const btnClass = isPrimary ? 'download-link primary' : 'download-link';

                html += `
                    <div class="${btnClass}" onclick="DownloadManager.handleDownload(${id}, '${type}', '${title.replace(/'/g, "\\'")}', ${season || 'null'}, ${episode || 'null'}, ${idx})">
                        <i class="fas ${icon}"></i>
                        <div class="download-link-info">
                            <span class="download-link-name">${opt.name}</span>
                            <span class="download-link-desc">${opt.desc}</span>
                        </div>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                `;
            });

            html += `
                <div class="download-note">
                    <i class="fas fa-info-circle"></i>
                    <span><strong>How to download:</strong> Direct links open the video file — on mobile, long-press the video and select "Download". On desktop, right-click → "Save video as". Torrent links require a torrent client like <em>Flud</em> (Android) or <em>qBittorrent</em> (Desktop).</span>
                </div>

                <div class="download-note warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Downloads are provided by third-party sources. WatchMore does not host any files. Use a VPN for privacy.</span>
                </div>
            `;

            linksEl.innerHTML = html;
        }

        UI.showModal('download-modal');
    },

    handleDownload(id, type, title, season, episode, optionIndex) {
        const options = this.getDownloadOptions(id, type, title, season, episode);
        const opt = options[optionIndex];

        if (!opt) return;

        if (opt.type === 'external') {
            // Open torrent/search sites in new tab
            window.open(opt.url, '_blank', 'noopener,noreferrer');
            UI.showToast('Opened torrent search in new tab', 'info', 3000);
            return;
        }

        // For direct links, try to fetch and trigger actual download
        this.attemptDirectDownload(opt.url, opt.filename, title);
    },

    async attemptDirectDownload(url, filename, title) {
        UI.showToast('Fetching download link...', 'info', 2000);

        // Method 1: Try to open in a way that triggers browser download
        // Create a hidden iframe to load the URL, which might trigger download
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);

        // Also open in new tab as fallback
        const newTab = window.open(url, '_blank', 'noopener,noreferrer');

        // Show instructions
        setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);

            // Show platform-specific download instructions
            const isMobile = /Android|iPhone|iPad|iPod/.test(navigator.userAgent);
            if (isMobile) {
                UI.showToast('Video opened! Long-press the video → Download', 'success', 5000);
            } else {
                UI.showToast('Video opened! Right-click → Save video as', 'success', 5000);
            }
        }, 2000);
    },

    close() {
        UI.hideModal('download-modal');
    }
};

// ============================================
// REPORT ISSUE MANAGER
// ============================================
const ReportManager = {
    show() {
        UI.showModal('report-modal');
    },

    hide() {
        UI.hideModal('report-modal');
    },

    async submit(e) {
        e.preventDefault();

        const nameInput = document.getElementById('report-name');
        const emailInput = document.getElementById('report-email');
        const typeInput = document.getElementById('report-type');
        const messageInput = document.getElementById('report-message');

        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const type = typeInput ? typeInput.value : 'bug';
        const message = messageInput ? messageInput.value.trim() : '';

        if (!message) {
            UI.showToast('Please describe your issue', 'warning');
            if (messageInput) messageInput.focus();
            return;
        }

        const currentPage = AppState.currentPage;
        const currentDetail = AppState.currentDetail;
        const userAgent = navigator.userAgent;
        const timestamp = new Date().toISOString();

        const subject = encodeURIComponent(`[WatchMore Report] ${type.toUpperCase()}: ${message.substring(0, 50)}...`);
        const body = encodeURIComponent(
            `Name: ${name || 'Anonymous'}\n` +
            `Email: ${email || 'Not provided'}\n` +
            `Issue Type: ${type}\n` +
            `Current Page: ${currentPage}\n` +
            `Current Content: ${currentDetail ? `${currentDetail.type} ID: ${currentDetail.id}` : 'None'}\n` +
            `User Agent: ${userAgent}\n` +
            `Timestamp: ${timestamp}\n\n` +
            `Message:\n${message}\n\n` +
            `---\nSent from WatchMore App`
        );

        const mailtoLink = `mailto:${CONFIG.REPORT_EMAIL}?subject=${subject}&body=${body}`;
        window.location.href = mailtoLink;

        const reports = JSON.parse(localStorage.getItem('watchmore_reports') || '[]');
        reports.push({
            name, email, type, message, currentPage, currentDetail, userAgent, timestamp,
            status: 'pending'
        });
        localStorage.setItem('watchmore_reports', JSON.stringify(reports));

        UI.showToast('Report prepared! Your email app should open.', 'success', 4000);
        this.hide();

        if (nameInput) nameInput.value = '';
        if (emailInput) emailInput.value = '';
        if (messageInput) messageInput.value = '';
    }
};

// ============================================
// PWA INSTALL MANAGER (FIXED)
// ============================================
const InstallManager = {
    deferredPrompt: null,
    isInstalled: false,
    isIOS: false,
    isAndroid: false,
    isChrome: false,
    isSafari: false,

    init() {
        // Detect platform
        const ua = navigator.userAgent;
        this.isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
        this.isAndroid = /Android/.test(ua);
        this.isChrome = /Chrome/.test(ua) && !/Edg/.test(ua);
        this.isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone === true) {
            this.isInstalled = true;
            console.log('WatchMore: Running as installed PWA');
            return;
        }

        // Check if previously dismissed
        const dismissed = localStorage.getItem('watchmore_install_dismissed');
        if (dismissed) {
            const daysSince = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
            if (daysSince < 7) {
                console.log('WatchMore: Install banner dismissed recently');
                return;
            }
        }

        // Listen for native install prompt (Chrome/Android)
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            console.log('WatchMore: Native install prompt available');
            this.showInstallBanner();
        });

        // Listen for app installed
        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.deferredPrompt = null;
            this.hideInstallBanner();
            UI.showToast('WatchMore installed successfully!', 'success', 4000);
            localStorage.removeItem('watchmore_install_dismissed');
        });

        // For iOS or browsers without native prompt, show manual instructions after delay
        setTimeout(() => {
            if (!this.isInstalled && !this.deferredPrompt) {
                this.showManualInstallBanner();
            }
        }, 3000);
    },

    showInstallBanner() {
        if (this.isInstalled) return;
        const banner = document.getElementById('install-banner');
        const btn = document.getElementById('install-btn');
        const text = document.getElementById('install-text');

        if (!banner) return;

        if (this.deferredPrompt && btn && text) {
            // Native prompt available (Chrome/Android)
            text.innerHTML = '<strong>Install WatchMore</strong><br>Add to your home screen for instant access';
            btn.innerHTML = '<i class="fas fa-download"></i> Install Now';
            btn.onclick = () => this.installNative();
        } else {
            this.updateBannerForPlatform();
        }

        banner.classList.add('active');
    },

    showManualInstallBanner() {
        if (this.isInstalled) return;
        const banner = document.getElementById('install-banner');
        if (banner) {
            this.updateBannerForPlatform();
            banner.classList.add('active');
        }
    },

    updateBannerForPlatform() {
        const btn = document.getElementById('install-btn');
        const text = document.getElementById('install-text');

        if (!btn || !text) return;

        if (this.isIOS) {
            text.innerHTML = '<strong>Install WatchMore on iOS</strong><br>Tap below for step-by-step instructions';
            btn.innerHTML = '<i class="fas fa-mobile-alt"></i> How to Install';
            btn.onclick = () => this.showInstallModal('ios');
        } else if (this.isAndroid) {
            text.innerHTML = '<strong>Install WatchMore on Android</strong><br>Add to your home screen for the best experience';
            btn.innerHTML = '<i class="fas fa-download"></i> Install App';
            btn.onclick = () => this.showInstallModal('android');
        } else {
            text.innerHTML = '<strong>Install WatchMore</strong><br>Add to your home screen for quick access';
            btn.innerHTML = '<i class="fas fa-download"></i> Install';
            btn.onclick = () => this.showInstallModal('desktop');
        }
    },

    hideInstallBanner() {
        const banner = document.getElementById('install-banner');
        if (banner) banner.classList.remove('active');
    },

    async installNative() {
        if (!this.deferredPrompt) {
            this.showInstallModal(this.isIOS ? 'ios' : this.isAndroid ? 'android' : 'desktop');
            return;
        }

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('User accepted install');
        } else {
            console.log('User dismissed install');
            this.hideInstallBanner();
        }
        this.deferredPrompt = null;
    },

    showInstallModal(platform) {
        const modal = document.getElementById('install-instructions-modal');
        const title = document.getElementById('install-instructions-title');
        const content = document.getElementById('install-instructions-content');

        if (!modal || !content) return;

        let steps = '';
        let modalTitle = 'Install WatchMore';

        if (platform === 'ios') {
            modalTitle = 'Install on iPhone/iPad';
            steps = `
                <div class="install-instruction-step">
                    <div class="install-step-num">1</div>
                    <div class="install-step-content">
                        <strong>Open in Safari</strong>
                        <p>Make sure you're using Safari browser (Chrome on iOS won't work)</p>
                        <div class="install-step-visual"><i class="fab fa-safari" style="font-size:32px;color:#00bfff;"></i></div>
                    </div>
                </div>
                <div class="install-instruction-step">
                    <div class="install-step-num">2</div>
                    <div class="install-step-content">
                        <strong>Tap the Share button</strong>
                        <p>Look for the <i class="fas fa-share-square" style="color:var(--accent);"></i> icon at the bottom of Safari</p>
                        <div class="install-step-visual" style="background:var(--bg-tertiary);padding:12px;border-radius:12px;text-align:center;">
                            <i class="fas fa-share-square" style="font-size:28px;color:#007aff;"></i>
                        </div>
                    </div>
                </div>
                <div class="install-instruction-step">
                    <div class="install-step-num">3</div>
                    <div class="install-step-content">
                        <strong>Scroll and tap "Add to Home Screen"</strong>
                        <p>You may need to scroll down in the share sheet to find this option</p>
                        <div class="install-step-visual" style="background:var(--bg-tertiary);padding:12px 16px;border-radius:12px;">
                            <span style="color:var(--accent);font-weight:600;"><i class="fas fa-plus-square"></i> Add to Home Screen</span>
                        </div>
                    </div>
                </div>
                <div class="install-instruction-step">
                    <div class="install-step-num">4</div>
                    <div class="install-step-content">
                        <strong>Tap "Add" in the top right</strong>
                        <p>The WatchMore icon will appear on your home screen like a real app!</p>
                        <div class="install-step-visual" style="background:var(--bg-tertiary);padding:12px;border-radius:12px;text-align:center;">
                            <span style="background:var(--accent);color:white;padding:6px 16px;border-radius:8px;font-weight:600;">Add</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (platform === 'android') {
            modalTitle = 'Install on Android';
            steps = `
                <div class="install-instruction-step">
                    <div class="install-step-num">1</div>
                    <div class="install-step-content">
                        <strong>Open Chrome menu</strong>
                        <p>Tap the <i class="fas fa-ellipsis-v" style="color:var(--accent);"></i> three dots in the top right corner</p>
                        <div class="install-step-visual" style="background:var(--bg-tertiary);padding:12px;border-radius:12px;text-align:center;">
                            <i class="fas fa-ellipsis-v" style="font-size:28px;color:var(--text-primary);"></i>
                        </div>
                    </div>
                </div>
                <div class="install-instruction-step">
                    <div class="install-step-num">2</div>
                    <div class="install-step-content">
                        <strong>Tap "Add to Home screen" or "Install app"</strong>
                        <p>Chrome may show "Install WatchMore" as a direct option</p>
                        <div class="install-step-visual" style="background:var(--bg-tertiary);padding:12px 16px;border-radius:12px;">
                            <span style="color:#22c55e;font-weight:600;"><i class="fas fa-download"></i> Install WatchMore</span>
                        </div>
                    </div>
                </div>
                <div class="install-instruction-step">
                    <div class="install-step-num">3</div>
                    <div class="install-step-content">
                        <strong>Tap "Install" or "Add"</strong>
                        <p>The app will be added to your home screen and app drawer</p>
                        <div class="install-step-visual" style="background:var(--bg-tertiary);padding:12px;border-radius:12px;text-align:center;">
                            <span style="background:#22c55e;color:white;padding:6px 16px;border-radius:8px;font-weight:600;">Install</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            modalTitle = 'Install WatchMore';
            steps = `
                <div class="install-instruction-step">
                    <div class="install-step-num">1</div>
                    <div class="install-step-content">
                        <strong>Look for the install icon</strong>
                        <p>In Chrome/Edge, look for an <i class="fas fa-download" style="color:var(--accent);"></i> icon in the address bar</p>
                    </div>
                </div>
                <div class="install-instruction-step">
                    <div class="install-step-num">2</div>
                    <div class="install-step-content">
                        <strong>Or use the browser menu</strong>
                        <p>Click the menu (⋮) and select "Install WatchMore" or "Add to Home Screen"</p>
                    </div>
                </div>
                <div class="install-instruction-step">
                    <div class="install-step-num">3</div>
                    <div class="install-step-content">
                        <strong>Follow the prompts</strong>
                        <p>The app will install and appear in your Start Menu / Desktop / Apps folder</p>
                    </div>
                </div>
            `;
        }

        if (title) title.textContent = modalTitle;
        content.innerHTML = steps;

        UI.showModal('install-instructions-modal');
    },

    dismiss() {
        this.hideInstallBanner();
        localStorage.setItem('watchmore_install_dismissed', Date.now().toString());
    }
};

// ============================================
// NOTIFICATION MANAGER
// ============================================
const NotificationManager = {
    subscribed: false,

    init() {
        if ('Notification' in window && Notification.permission === 'granted') {
            this.subscribed = true;
            this.updateBadges();
        }
    },

    async subscribe() {
        if (!('Notification' in window)) {
            UI.showToast('Notifications not supported in this browser', 'warning');
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                this.subscribed = true;
                this.updateBadges();
                UI.showToast('Notifications enabled!', 'success');

                if ('serviceWorker' in navigator) {
                    const reg = await navigator.serviceWorker.ready;
                    reg.active.postMessage('start-demo-notifications');
                }
            } else {
                UI.showToast('Notification permission denied', 'warning');
            }
        } catch (e) {
            UI.showToast('Could not enable notifications', 'error');
        }
    },

    updateBadges() {
        document.querySelectorAll('.notif-badge').forEach(badge => {
            badge.classList.toggle('active', this.subscribed);
        });
    },

    send(title, body, ad = '') {
        if (!this.subscribed || Notification.permission !== 'granted') return;

        const options = {
            body: ad ? `${body}\n\n${ad}` : body,
            icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎬</text></svg>",
            badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎬</text></svg>",
            tag: 'watchmore-' + Date.now(),
            requireInteraction: false,
            actions: [
                { action: 'open', title: 'Open App' },
                { action: 'dismiss', title: 'Dismiss' }
            ]
        };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(title, options);
            });
        } else {
            new Notification(title, options);
        }
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
window.DownloadManager = DownloadManager;
window.ReportManager = ReportManager;
window.InstallManager = InstallManager;
window.NotificationManager = NotificationManager;
