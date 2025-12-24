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
- `app.js` - Vue 3 application (featured breeder & table components)
- `directory-info.json` - Breeder/supplier directory data (editable)
- `ct_backyard_chickens_2025.jpg` - Connecticut Backyard Chickens logo
- `README.md` - This file

## Technology Stack

- **Vue 3** - Progressive JavaScript framework
- **Bootstrap 5** - CSS framework
- **Bootstrap-Vue-Next** - Vue 3 compatible Bootstrap components
- Vanilla HTML/CSS for static sections

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

### Managing the Breeder Directory

The breeder/supplier directory is managed through the `directory-info.json` file. 

#### Featured Breeder (Paid Listing)

Edit the `featured` section for the paid featured breeder:

```json
{
  "featured": {
    "name": "Farm Name",
    "location": "Town, CT",
    "selling": "Breeds or products",
    "verified": true,
    "contact_link": "mailto:farm@example.com",
    "info_link": "https://example.com/farm",
    "reviews": [
      {
        "type": "positive",
        "from": "Customer Name",
        "comment": "Review comment here",
        "date": "2024-12-23"
      }
    ]
  }
}
```

**Featured Breeder Fields:**
- `contact_link`: Email (mailto:) or phone link for contacting the breeder
- `info_link`: URL to farm website or Facebook page for more information

#### Directory Listings

Add, edit, or remove breeders in the `directory_info` array:

```json
{
  "directory_info": [
    {
      "name": "Your Farm Name",
      "location": "Your Town, CT",
      "selling": "Silkies, Orpingtons, Hatching Eggs",
      "verified": true,
      "contact_link": "mailto:farm@example.com",
      "info_link": "https://example.com",
      "updated": "2024-12-23",
      "reviews": [
        {
          "type": "positive",
          "from": "Customer Name",
          "comment": "Review comment",
          "date": "2024-12-23"
        }
      ]
    }
  ]
}
```

**Standard Fields (All Breeders):**
- `name`: Farm/breeder name
- `location`: Town, CT format
- `selling`: Breeds or products offered
- `verified`: true/false - shows verified badge
- `contact_link`: Email (mailto:) or phone (tel:) link
- `info_link`: Website, Facebook, or "#" if none
- `updated`: Last updated date (YYYY-MM-DD)
- `reviews`: Array of review objects

**Review Fields:**
- `type`: "positive" or "negative"
- `from`: Customer name/initials
- `comment`: Brief review text
- `date`: YYYY-MM-DD format

**Important Notes:**
- The table is automatically sortable and filterable
- Date format must be YYYY-MM-DD (e.g., 2024-12-23)
- Don't forget commas between entries
- The last entry in the list should NOT have a comma after it
- You can validate your JSON at https://jsonlint.com/ before saving

## Local Development

To test the site locally (required for JSON loading):

```bash
cd /path/to/ctchickens.com
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

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


