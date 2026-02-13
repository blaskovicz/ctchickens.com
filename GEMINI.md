# GEMINI.md: Project Overview and Development Guide

This document provides a comprehensive overview of the Connecticut Backyard Chickens website project, its architecture, and development conventions.

## Project Overview

This project is the official website for the Connecticut Backyard Chickens Facebook group. It's a Vue.js single-page application (SPA) built with Vite, TypeScript, and Bootstrap. The site serves as a central hub for community members, providing a directory of local breeders and suppliers, recommended products, and helpful resources for chicken keepers in Connecticut.

The application's main functionality is a searchable and filterable directory of breeders and suppliers. This data is fetched from a Google Apps Script, which acts as a simple, obfuscated API. The data is then cached in the browser's local storage to reduce network requests.

### Key Technologies

*   **Frontend Framework:** Vue.js 3
*   **Build Tool:** Vite
*   **Language:** TypeScript
*   **Styling:** Bootstrap 5 and Bootstrap Icons
*   **State Management:** Vuex
*   **API:** Google Apps Script

## Building and Running

The project uses `npm` for package management.

### Development

To run the development server:

```bash
npm install
npm run dev
```

This will start a local development server, typically at `http://localhost:5173`.

### Production Build

To create a production-ready build:

```bash
npm run build
```

This will generate a `dist` directory with the compiled and minified assets. The site can then be deployed to any static web hosting service.

### Preview

To preview the production build locally:

```bash
npm run preview
```

## Development Conventions

*   **Component-Based Architecture:** The application is structured around Vue.js single-file components, located in `src/components`.
*   **State Management:** Vuex is used for centralized state management. The store is defined in `src/store/index.ts` and handles fetching and caching the breeder directory data.
*   **Styling:** Global styles are defined in `src/style.css`, with component-specific styles scoped within the `.vue` files. The project heavily utilizes Bootstrap 5 for its responsive grid system and UI components.
*   **Data Fetching:** The breeder directory data is fetched from a Google Apps Script URL. The URL is obfuscated within the `src/store/index.ts` file to deter simple scraping.
*   **Caching:** The fetched data is cached in the browser's local storage to improve performance and reduce API calls. The caching logic is implemented in `src/store/cache.ts`.
*   **Types:** TypeScript types are defined in `src/types.ts`.
*   **Linting and Formatting:** The project is set up with `vue-tsc` for TypeScript checking, but there are no explicit linting or formatting rules defined in `package.json`. It is recommended to use a tool like Prettier or ESLint to maintain a consistent code style.
