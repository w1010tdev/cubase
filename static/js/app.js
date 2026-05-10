import { initExplore } from './components/explore.js';

const App = {
    data: null,
    progress: {},
    currentView: '',
    
    async init() {
        this.setupTheme();
        this.setupMobileMenu();
        
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

    handleRoute() {
        let hash = window.location.hash || '#explore';
        this.currentView = hash;
        
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.toggle('active', l.getAttribute('href') === hash);
        });

        const viewContainer = document.getElementById('app-view');
        const treeMenuDom = document.getElementById('tree-menu');
        
        if (hash === '#explore') {
            treeMenuDom.classList.remove('hidden');
            initExplore(viewContainer, this.data, this.progress);
        } else {
            treeMenuDom.classList.add('hidden');
            viewContainer.innerHTML = `<h2 class="text-2xl font-bold text-light-text dark:text-dark-text font-serif">Coming soon: ${hash}</h2>`;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());