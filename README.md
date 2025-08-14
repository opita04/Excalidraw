# Excalidraw with Vercel Blob Storage

A Next.js application that integrates Excalidraw drawing capabilities with Vercel Blob storage for persistent file management.

## Features

- 🎨 **Excalidraw Integration**: Full-featured drawing canvas
- ☁️ **Vercel Blob Storage**: Cloud-based file persistence
- 💾 **Auto-save**: Save drawings to cloud storage
- 📁 **File Management**: List and load saved drawings
- 🚀 **Vercel Optimized**: Built for seamless Vercel deployment

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Drawing**: @excalidraw/excalidraw
- **Storage**: Vercel Blob
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Local Development

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Vercel account (for blob storage)

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up Vercel Blob**:
   - Create a Vercel project
   - Add Blob storage to your project
   - Copy your Blob store URL and token

3. **Environment variables**:
   Create `.env.local`:
   ```env
   BLOB_READ_WRITE_TOKEN=your_blob_token_here
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

5. **Open browser**:
   Navigate to `http://localhost:3000`

## Deployment to Vercel

### Automatic Deployment

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**:
   - Connect your GitHub repository to Vercel
   - Vercel will automatically detect Next.js
   - Add your Blob environment variables in Vercel dashboard

### Manual Deployment

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Set environment variables**:
   ```bash
   vercel env add BLOB_READ_WRITE_TOKEN
   ```

## API Endpoints

### Save Drawing
- **POST** `/api/save-drawing`
- **Body**: FormData with file
- **Response**: Blob URL and metadata

### List Drawings
- **GET** `/api/list-drawings`
- **Response**: Array of saved drawings

## File Structure

```
├── app/
│   ├── api/
│   │   ├── save-drawing/
│   │   │   └── route.ts
│   │   └── list-drawings/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── package.json
├── next.config.js
├── tsconfig.json
├── vercel.json
└── README.md
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access token | Yes |

## Troubleshooting

### Common Issues

1. **Blob Storage Errors**:
   - Verify your `BLOB_READ_WRITE_TOKEN` is set correctly
   - Check that Blob storage is enabled in your Vercel project

2. **Build Errors**:
   - Ensure Node.js version is 18+
   - Clear `.next` folder and reinstall dependencies

3. **CORS Issues**:
   - This app is designed for Vercel deployment
   - Local development uses Next.js dev server (no CORS issues)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create a GitHub issue
- Check Vercel documentation
- Review Excalidraw documentation
