// ============================================
// WATCHMORE - Detail Page (FIXED & ROBUST)
// ============================================

const DetailPage = {
    currentId: null,
    currentType: null,
    currentData: null,
    isLoading: false,

    async init(params = {}) {
        const { id, type = 'movie' } = params;
        if (!id) {
            console.error('DetailPage.init: No ID provided');
            this.showError('No movie or show selected');
            return;
        }

        this.currentId = id;
        this.currentType = type;
        AppState.setDetail(id, type);

        // Show loading state immediately
        this.showLoading();

        // Try to fetch with append_to_response first
        let data = await this.fetchDetail(id, type, true);

        // If that fails, try without append_to_response
        if (!data) {
            console.log('DetailPage: Retry without append_to_response...');
            data = await this.fetchDetail(id, type, false);
        }

        if (!data) {
            this.showError('Failed to load details. Please check your connection and try again.');
            return;
        }

        this.currentData = data;
        this.renderDetail(data, type);
    },

    async fetchDetail(id, type, useAppend = true) {
        const endpoint = type === 'tv' ? `/tv/${id}` : `/movie/${id}`;
        const params = useAppend 
            ? { append_to_response: 'credits,recommendations,videos' }
            : {};

        try {
            const data = await TMDB.fetch(endpoint, params);

            // If we didn't use append_to_response, fetch extras separately
            if (data && !useAppend) {
                const [creditsData, recommendationsData] = await Promise.all([
                    TMDB.fetch(`${endpoint}/credits`).catch(() => null),
                    TMDB.fetch(`${endpoint}/recommendations`).catch(() => null)
                ]);
                if (creditsData) data.credits = creditsData;
                if (recommendationsData) data.recommendations = recommendationsData;
            }

            return data;
        } catch (e) {
            console.error('DetailPage fetch error:', e);
            return null;
        }
    },

    showLoading() {
        const poster = document.getElementById('detail-poster-img');
        const title = document.getElementById('detail-title');
        const overview = document.getElementById('detail-overview');
        const cast = document.getElementById('detail-cast');
        const related = document.getElementById('related');

        if (poster) {
            poster.src = '';
            poster.style.background = 'var(--bg-tertiary)';
        }
        if (title) title.textContent = 'Loading...';
        if (overview) overview.textContent = 'Fetching movie details...';
        if (cast) cast.innerHTML = '<div class="loading-center" style="min-height:200px;"><div class="spinner"></div></div>';
        if (related) related.innerHTML = '';

        // Reset stats to defaults
        this.setText('detail-rating', '0.0');
        this.setText('detail-year', '----');
        this.setText('detail-runtime', '--');
        this.setText('detail-status', '---');
        this.setText('detail-budget', '-');
        this.setText('detail-revenue', '-');
        this.setText('detail-votes', '0');

        // Hide episodes badge
        const episodesBadge = document.getElementById('detail-episodes');
        if (episodesBadge) episodesBadge.style.display = 'none';

        // Clear genres
        const genresContainer = document.getElementById('detail-genres');
        if (genresContainer) genresContainer.innerHTML = '';

        // Clear backdrop
        const backdrop = document.getElementById('detail-backdrop');
        if (backdrop) backdrop.style.backgroundImage = '';
    },

    showError(message) {
        const title = document.getElementById('detail-title');
        const overview = document.getElementById('detail-overview');
        const cast = document.getElementById('detail-cast');

        if (title) title.textContent = 'Error Loading Content';
        if (overview) {
            overview.innerHTML = `<div style="color:var(--accent);margin-bottom:16px;"><i class="fas fa-exclamation-circle"></i> ${message}</div>
                <button class="btn btn-primary" onclick="DetailPage.retry()" style="margin-top:12px;">
                    <i class="fas fa-redo"></i> Try Again
                </button>`;
        }
        if (cast) cast.innerHTML = '';
    },

    retry() {
        if (this.currentId && this.currentType) {
            this.init({ id: this.currentId, type: this.currentType });
        }
    },

    renderDetail(data, type) {
        if (!data) return;

        try {
            // Backdrop
            const backdropEl = document.getElementById('detail-backdrop');
            if (backdropEl) {
                const backdrop = TMDB.backdrop(data.backdrop_path);
                backdropEl.style.backgroundImage = `url(${backdrop})`;
            }

            // Poster
            const posterEl = document.getElementById('detail-poster-img');
            if (posterEl) {
                const poster = TMDB.image(data.poster_path, 'w500');
                posterEl.src = poster;
                posterEl.alt = data.title || data.name || 'Poster';
                posterEl.style.background = '';
            }

            // Type badge
            this.setText('detail-type', type === 'tv' ? 'TV Show' : 'Movie');

            // Title
            this.setText('detail-title', data.title || data.name || 'Untitled');

            // Meta
            this.setText('detail-rating', data.vote_average ? data.vote_average.toFixed(1) : '0.0');
            this.setText('detail-year', UI.getYear(data.release_date || data.first_air_date));
            this.setText('detail-runtime', UI.formatRuntime(data.runtime || (data.episode_run_time && data.episode_run_time[0])));

            // Episodes badge for TV
            const episodesBadge = document.getElementById('detail-episodes');
            if (type === 'tv' && data.number_of_episodes && episodesBadge) {
                episodesBadge.textContent = `${data.number_of_episodes} Episodes`;
                episodesBadge.style.display = 'inline-flex';
            } else if (episodesBadge) {
                episodesBadge.style.display = 'none';
            }

            // Genres
            const genresContainer = document.getElementById('detail-genres');
            if (genresContainer) {
                const genres = (data.genres || []).map(g => Components.genreTag(g.name)).join('');
                genresContainer.innerHTML = genres || '<span class="genre-tag">Unknown Genre</span>';
            }

            // Overview
            this.setText('detail-overview', data.overview || 'No overview available for this title.');

            // Stats
            this.setText('detail-status', data.status || 'Unknown');
            this.setText('detail-budget', UI.formatCurrency(data.budget));
            this.setText('detail-revenue', UI.formatCurrency(data.revenue));
            this.setText('detail-votes', UI.formatNumber(data.vote_count || 0));

            // Cast
            const castContainer = document.getElementById('detail-cast');
            if (castContainer) {
                const cast = (data.credits && data.credits.cast) || [];
                if (cast.length > 0) {
                    castContainer.innerHTML = cast.slice(0, 12).map(p => Components.castCard(p)).join('');
                } else {
                    castContainer.innerHTML = '<div class="no-results" style="padding:40px 20px;"><i class="fas fa-users"></i><h3>No cast info</h3><p>Cast information is not available</p></div>';
                }
            }

            // Related
            const related = (data.recommendations && data.recommendations.results) || [];
            const relatedSection = document.getElementById('related-section');
            const relatedContainer = document.getElementById('related');

            if (related.length > 0 && relatedContainer) {
                relatedContainer.innerHTML = related.slice(0, 12).map(item => Components.movieCard(item, item.media_type || type)).join('');
                if (relatedSection) relatedSection.style.display = 'block';
            } else if (relatedSection) {
                relatedSection.style.display = 'none';
            }

            // Seasons for TV
            const seasonsSection = document.getElementById('seasons-section');
            const seasonsGrid = document.getElementById('seasons-grid');

            if (type === 'tv' && data.seasons && data.seasons.length > 0) {
                if (seasonsSection) seasonsSection.style.display = 'block';
                if (seasonsGrid) {
                    const tvName = (data.name || 'Show').replace(/'/g, "\\'");
                    seasonsGrid.innerHTML = data.seasons
                        .filter(s => s.season_number > 0)
                        .map(season => 
                            `<button class="season-btn" onclick="DetailPage.showSeason(${season.season_number}, '${tvName}')">${season.name}</button>`
                        ).join('');
                }
            } else {
                if (seasonsSection) seasonsSection.style.display = 'none';
            }

            // Watchlist button
            this.updateWatchlistButton();

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (e) {
            console.error('DetailPage.renderDetail error:', e);
            this.showError('Something went wrong while displaying the details.');
        }
    },

    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    async showSeason(seasonNumber, tvTitle) {
        if (!this.currentId) return;

        UI.showToast('Loading episodes...', 'info', 1500);
        const data = await TMDB.fetch(`/tv/${this.currentId}/season/${seasonNumber}`);

        if (data) {
            SeasonManager.show(seasonNumber, data, this.currentId, tvTitle);
        } else {
            UI.showToast('Could not load episodes', 'error');
        }
    },

    updateWatchlistButton() {
        const btn = document.getElementById('detail-watchlist-btn');
        if (!btn || !AppState.currentDetail) return;

        const isSaved = AppState.isInWatchlist(AppState.currentDetail.id, AppState.currentDetail.type);

        if (isSaved) {
            btn.innerHTML = '<i class="fas fa-check"></i> In Watchlist';
            btn.classList.add('active');
        } else {
            btn.innerHTML = '<i class="fas fa-bookmark"></i> Add to Watchlist';
            btn.classList.remove('active');
        }
    },

    toggleWatchlist() {
        if (!AppState.currentDetail) return;

        const { id, type } = AppState.currentDetail;
        const titleEl = document.getElementById('detail-title');
        const title = titleEl ? titleEl.textContent : 'Unknown';

        if (AppState.isInWatchlist(id, type)) {
            AppState.removeFromWatchlist(id, type);
            UI.showToast('Removed from watchlist', 'info');
        } else {
            AppState.addToWatchlist({ id, type, title });
            UI.showToast('Added to watchlist', 'success');
        }

        this.updateWatchlistButton();
    },

    play() {
        if (!AppState.currentDetail) return;
        const titleEl = document.getElementById('detail-title');
        const title = titleEl ? titleEl.textContent : 'Now Playing';
        PlayerManager.open(AppState.currentDetail.id, AppState.currentDetail.type, title);
    },

    download() {
        if (!AppState.currentDetail) return;
        const titleEl = document.getElementById('detail-title');
        const title = titleEl ? titleEl.textContent : 'Download';
        DownloadManager.open(AppState.currentDetail.id, AppState.currentDetail.type, title);
    },

    share() {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            UI.showToast('Link copied to clipboard!', 'success');
        }).catch(() => {
            UI.showToast('Could not copy link', 'error');
        });
    }
};

window.DetailPage = DetailPage;
