# Connecticut Backyard Chickens Website

Welcome to the official website for the Connecticut Backyard Chickens Facebook group!

## Overview

This website serves as a companion to our [Facebook group](https://www.facebook.com/groups/1465813350383274) with over 12,000 active members. It provides visitors with information about our community, recommended products, and helpful resources for chicken keeping in Connecticut.

## Features

- **Hero Section**: Showcases our logo and provides quick access to join the Facebook group
- **About Section**: Explains why people should join our community with feature highlights
- **Recommended Products**: Curated list of essential chicken-keeping supplies with Amazon links
- **Resources Section**: Helpful links to guides, regulations, health information, and building plans
- **Responsive Design**: Built with Bootstrap 5 for perfect display on all devices

## Files

- `index.html` - Main website page
- `styles.css` - Custom styling and theme
- `logo.jpg` - Connecticut Backyard Chickens logo
- `README.md` - This file

## Customization

### Updating Product Links

To add or modify recommended products, edit the `#products` section in `index.html`. Each product card follows this structure:

```html
<div class="col-md-6 col-lg-4">
    <div class="card h-100 shadow-sm product-card">
        <div class="card-body">
            <div class="product-icon mb-3">
                <i class="bi bi-[ICON-NAME]"></i>
            </div>
            <h5 class="card-title">Product Title</h5>
            <p class="card-text">Product description</p>
            <a href="[AMAZON-URL]" target="_blank" class="btn btn-outline-primary">
                View on Amazon <i class="bi bi-box-arrow-up-right"></i>
            </a>
        </div>
    </div>
</div>
```

### Adding New Resources

To add more resources, edit the `#resources` section in `index.html`. You can add new resource cards or list items following the existing pattern.

### Customizing Colors

The color scheme can be adjusted in `styles.css` by modifying the CSS variables at the top:

```css
:root {
    --primary-color: #1e3a8a;      /* Main blue color */
    --secondary-color: #b91c1c;     /* Red accent */
    --accent-color: #f59e0b;        /* Gold/amber accent */
    --text-dark: #1f2937;           /* Text color */
    --bg-cream: #fefce8;            /* Background cream */
}
```

## Future Features

- Listings page for chickens and eggs for sale (coming soon)
- Member directory
- Event calendar
- Photo gallery

## Deployment

This is a static website that can be hosted on:
- **GitHub Pages** (free)
- **Netlify** (free)
- **Vercel** (free)
- Any web hosting service

Simply upload all files to your hosting provider.

## Browser Support

Works on all modern browsers including:
- Chrome
- Firefox
- Safari
- Edge

## Questions or Suggestions?

Visit our [Facebook group](https://www.facebook.com/groups/1465813350383274) to share feedback!

---

*Website built for the Connecticut Backyard Chickens community - 2025*

