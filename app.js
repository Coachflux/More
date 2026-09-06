// ============================================
// WATCHMORE - Main App Controller
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    FirebaseManager.init();
    Router.init();
    NotificationManager.init();
    setupGlobalEvents();
    setupVisibilityNotifications();
    console.log('🎬 WatchMore initialized');
});

function setupGlobalEvents() {
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.addEventListener('input', UI.debounce((e) => {
            const query = e.target.value.trim();
            if (query.length > 2) {
                AppState.searchQuery = query;
                Router.go('search');
                SearchPage.performSearch(query);
            }
        }, 500));

        searchInput.addEventListener('focus', () => {
            const shortcut = document.querySelector('.search-shortcut');
            if (shortcut) shortcut.style.display = 'none';
        });
    }

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('global-search');
            if (searchInput) searchInput.focus();
        }

        if (e.key === 'Escape') {
            AuthManager.hide();
            PlayerManager.close();
            SeasonManager.hide();
        }
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                if (overlay.id === 'auth-modal') AuthManager.hide();
                if (overlay.id === 'season-modal') SeasonManager.hide();
            }
        });
    });

    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', (e) => AuthManager.handleSubmit(e));
    }

    // Handle visibility change to pause hero slider
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            HomePage.stopHeroSlider();
        } else {
            HomePage.startHeroSlider();
        }
    });
}

// Send notifications when user leaves the tab (with ads)
function setupVisibilityNotifications() {
    if (!('Notification' in window)) return;

    const messages = [
        { title: 'Come back to WatchMore! 🍿', body: 'Your movie is waiting for you.', ad: 'Ad: Premium upgrade — 50% OFF today!' },
        { title: 'New trending content 🔥', body: 'Check out what\'s hot right now.', ad: 'Ad: Stream on all devices — Install now!' },
        { title: 'Don\'t miss out! ⭐', body: 'Top-rated movies were just added.', ad: 'Ad: VPN Special — 70% off limited deal!' }
    ];

    let lastNotifTime = 0;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && NotificationManager.subscribed && Notification.permission === 'granted') {
            const now = Date.now();
            if (now - lastNotifTime > 60000) { // Max once per minute
                lastNotifTime = now;
                const msg = messages[Math.floor(Math.random() * messages.length)];
                NotificationManager.send(msg.title, msg.body, msg.ad);
            }
        }
    });
}

// Global helper functions
window.navigateTo = (page) => Router.go(page);
window.toggleTheme = () => ThemeManager.toggle();
window.showAuthModal = () => AuthManager.show();
window.closeAuthModal = () => AuthManager.hide();
window.toggleAuthMode = () => AuthManager.toggleMode();
window.handleAuth = (e) => AuthManager.handleSubmit(e);
window.scrollCarousel = (id, dir) => Carousel.scroll(id, dir);
window.setContentType = (type) => DiscoverPage.setContentType(type);
window.setFilter = (filter) => DiscoverPage.setFilter(filter);
window.changePage = (page) => DiscoverPage.changePage(page);
window.showDetail = (id, type) => Router.toDetail(id, type);
window.playFeatured = () => HomePage.playFeatured();
window.showFeaturedDetail = () => HomePage.showFeaturedDetail();
window.playCurrent = () => DetailPage.play();
window.toggleWatchlistCurrent = () => DetailPage.toggleWatchlist();
window.shareCurrent = () => DetailPage.share();
window.closePlayer = () => PlayerManager.close();
window.closeSeasonModal = () => SeasonManager.hide();
window.toggleFullscreen = () => PlayerManager.toggleFullscreen();

// Report Issue Modal
window.showReportModal = () => {
    const modal = document.getElementById('report-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
};
window.closeReportModal = () => {
    const modal = document.getElementById('report-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
};
window.handleReport = (e) => {
    e.preventDefault();
    const type = document.getElementById('report-type')?.value;
    const desc = document.getElementById('report-desc')?.value;
    const email = document.getElementById('report-email')?.value;

    if (!type || !desc) return;

    // Store report in localStorage queue
    const reports = JSON.parse(localStorage.getItem('watchmore_reports') || '[]');
    reports.push({
        type,
        desc,
        email: email || 'anonymous',
        date: new Date().toISOString(),
        url: window.location.href
    });
    localStorage.setItem('watchmore_reports', JSON.stringify(reports));

    UI.showToast('Report sent. Thank you for your feedback!', 'success');
    closeReportModal();
    e.target.reset();
};
