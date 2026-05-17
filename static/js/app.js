import { initExplore } from './components/explore.js';

const App = {
    data: null,
    progress: {},
    currentView: '',
    currentCleanup: null,
    
    async init() {
        this.setupTheme();
        this.setupMobileMenu();
        this.setupGlobalClose();
        
        // Fetch DB and progress
        await this.fetchData();
        
        // Setup Router
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute(); // initial
    },

    setupTheme() {
        const toggle = document.getElementById('theme-toggle');
        const isDark = localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        toggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            if (document.documentElement.classList.contains('dark')) {
                localStorage.setItem('theme', 'dark');
            } else {
                localStorage.setItem('theme', 'light');
            }
        });
    },

    setupMobileMenu() {
        const btn = document.getElementById('mobile-menu-btn');
        const sidebar = document.getElementById('sidebar');
        
        btn.addEventListener('click', () => {
            if (sidebar.classList.contains('hidden')) {
                sidebar.classList.remove('hidden');
                sidebar.classList.add('absolute', 'z-30', 'h-full');
            } else {
                sidebar.classList.add('hidden');
                sidebar.classList.remove('absolute', 'z-30');
            }
        });
    },

    setupGlobalClose() {
        // Close 3D modal when pressing Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('global-3d-panel');
                if (modal && !modal.classList.contains('hidden')) {
                    modal.classList.add('hidden');
                    document.body.style.overflow = '';
                }
            }
        });
    },

    async fetchData() {
        try {
            const dbRes = await fetch('/api/explore');
            this.data = await dbRes.json();
            
            const progRes = await fetch('/api/progress/all');
            this.progress = await progRes.json();
        } catch (e) {
            console.error("Failed to load data", e);
        }
    },

    async handleRoute() {
        let hash = window.location.hash || '#explore';
        
        // Run cleanup for the previous view
        if (this.currentCleanup) {
            this.currentCleanup();
            this.currentCleanup = null;
        }
        
        this.currentView = hash;
        window.__CUBASE_PROGRESS__ = this.progress;
        
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.toggle('active', l.getAttribute('href') === hash);
        });

        const viewContainer = document.getElementById('app-view');
        const treeMenuDom = document.getElementById('tree-menu');
        
        // Close 3D modal if open (navigating away)
        const modal = document.getElementById('global-3d-panel');
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
        
        if (hash === '#explore') {
            treeMenuDom.classList.remove('hidden');
            initExplore(viewContainer, this.data, this.progress);
        } else if (hash === '#playground') {
            treeMenuDom.classList.add('hidden');
            try {
                const mod = await import('./components/playground.js');
                mod.initPlayground(viewContainer);
                this.currentCleanup = mod.destroyPlayground;
            } catch (e) {
                console.error('Failed to load playground', e);
                viewContainer.innerHTML = '<p class="text-red-500">Failed to load Playground.</p>';
            }
        } else {
            treeMenuDom.classList.add('hidden');
            viewContainer.innerHTML = `<h2 class="text-2xl font-bold text-light-text dark:text-dark-text font-serif">Coming soon: ${hash}</h2>`;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());