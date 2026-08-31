// ============================================
// WATCHMORE - Home Page
// ============================================

const HomePage = {
    initialized: false,
    heroInterval: null,

    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.loadData();
    },

    async loadData() {
        // Load hero movies (multiple for slider)
        const trending = await TMDB.fetch('/trending/movie/day');
        if (trending && trending.results.length > 0) {
            AppState.featuredMovies = trending.results.slice(0, 5);
            this.renderHeroSlider(AppState.featuredMovies);
            this.startHeroSlider();
        }

        // Load carousels in parallel
        await Promise.all([
            this.loadCarousel('trending-today', '/trending/movie/day'),
            this.loadCarousel('trending-week', '/trending/movie/week'),
            this.loadCarousel('popular', '/movie/popular'),
            this.loadCarousel('now-playing', '/movie/now_playing'),
            this.loadCarousel('top-rated', '/movie/top_rated')
        ]);
    },

    renderHeroSlider(movies) {
        const slidesContainer = document.getElementById('hero-slides');
        const indicatorsContainer = document.getElementById('hero-indicators');

        if (!slidesContainer || !indicatorsContainer) return;

        // Create slides
        slidesContainer.innerHTML = movies.map((movie, index) => {
            const backdrop = TMDB.backdrop(movie.backdrop_path);
            return `<div class="hero-slide ${index === 0 ? 'active' : ''}" data-index="${index}" style="background-image: url(${backdrop})"></div>`;
        }).join('');

        // Create indicators
        indicatorsContainer.innerHTML = movies.map((_, index) => 
            `<button class="hero-indicator ${index === 0 ? 'active' : ''}" data-index="${index}" onclick="HomePage.goToSlide(${index})"></button>`
        ).join('');

        // Render first movie info
        this.renderHeroContent(movies[0], 0);
    },

    renderHeroContent(movie, index) {
        const genres = (movie.genre_ids || []).slice(0, 2).map(g => UI.getGenreName(g)).join(', ');

        document.getElementById('hero-title').textContent = movie.title;
        document.getElementById('hero-meta').innerHTML = `
            <div class="rating"><i class="fas fa-star"></i> ${movie.vote_average.toFixed(1)}</div>
            <span class="year">${UI.getYear(movie.release_date)}</span>
            <span class="genre">${genres}</span>
        `;
        document.getElementById('hero-desc').textContent = movie.overview;

        // Store current featured for play button
        AppState.currentHeroIndex = index;
    },

    startHeroSlider() {
        this.stopHeroSlider();
        this.heroInterval = setInterval(() => {
            const nextIndex = (AppState.currentHeroIndex + 1) % AppState.featuredMovies.length;
            this.goToSlide(nextIndex);
        }, 6000);
    },

    stopHeroSlider() {
        if (this.heroInterval) {
            clearInterval(this.heroInterval);
            this.heroInterval = null;
        }
    },

    goToSlide(index) {
        if (!AppState.featuredMovies[index]) return;

        AppState.currentHeroIndex = index;

        // Update slides
        document.querySelectorAll('.hero-slide').forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });

        // Update indicators
        document.querySelectorAll('.hero-indicator').forEach((ind, i) => {
            ind.classList.toggle('active', i === index);
        });

        // Update content with fade
        this.renderHeroContent(AppState.featuredMovies[index], index);

        // Restart timer
        this.startHeroSlider();
    },

    async loadCarousel(id, endpoint, params = {}) {
        const container = document.getElementById(id);
        if (!container) return;

        UI.showLoading(id, 6);

        const data = await TMDB.fetch(endpoint, params);
        if (data && data.results) {
            container.innerHTML = data.results.slice(0, 12).map(m => Components.movieCard(m)).join('');
        }
    },

    playFeatured() {
        const movie = AppState.featuredMovies[AppState.currentHeroIndex];
        if (!movie) return;
        PlayerManager.open(movie.id, 'movie', movie.title);
    },

    showFeaturedDetail() {
        const movie = AppState.featuredMovies[AppState.currentHeroIndex];
        if (movie) {
            Router.toDetail(movie.id, 'movie');
        }
    }
};

window.HomePage = HomePage;
